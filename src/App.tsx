import React, { useState } from 'react';
import { SearchForm } from './components/SearchForm';
import { SearchResults } from './components/SearchResults';
import { DocumentViewer } from './components/DocumentViewer';
import { CoverageTable } from './components/CoverageTable';
import { CanLIIViewer } from './components/CanLIIViewer';
import { TLADatabases } from './components/TLADatabases';
import { searchLegalData, SearchParams, SearchResultItem } from './lib/api';
import { analyzeQuery, NlpAnalysis, scoreAndSummarizeResults, searchExternalSites } from './lib/nlp';
import { Scale, Database, Search, AlertCircle, ExternalLink, Library, Sparkles } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'search' | 'coverage' | 'canlii' | 'tla'>('search');
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [lastQuery, setLastQuery] = useState<string>('');
  const [nlpData, setNlpData] = useState<NlpAnalysis | null>(null);
  const [isScoring, setIsScoring] = useState(false);
  
  const [selectedDocument, setSelectedDocument] = useState<{ citation: string; docType: 'cases' | 'laws'; url_en?: string; url_fr?: string } | null>(null);
  const [currentDocType, setCurrentDocType] = useState<'cases' | 'laws'>('cases');
  const [canliiUrl, setCanliiUrl] = useState<string>('https://www.canlii.org/en/');

  const handleSearch = async (params: SearchParams) => {
    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);
    setCurrentDocType(params.doc_type || 'cases');
    setLastQuery(params.query);
    setNlpData(null);
    setIsScoring(false);
    
    try {
      let finalQuery = params.query;
      
      // Apply NLP enhancement if requested
      if (params.use_nlp) {
        const analysis = await analyzeQuery(params.query);
        setNlpData(analysis);
        finalQuery = analysis.optimizedQuery;
      }

      // Search both databases concurrently
      const enhancedParams = { ...params, query: finalQuery };
      const { searchONLegis } = await import('./lib/api');
      
      const [a2ajResponse, onLegisResponse, webResponse] = await Promise.allSettled([
        searchLegalData(enhancedParams),
        searchONLegis(finalQuery),
        searchExternalSites(finalQuery)
      ]);

      let combinedResults: SearchResultItem[] = [];

      if (a2ajResponse.status === 'fulfilled' && a2ajResponse.value && a2ajResponse.value.results) {
        combinedResults = [...combinedResults, ...a2ajResponse.value.results];
      }

      if (onLegisResponse.status === 'fulfilled' && onLegisResponse.value && onLegisResponse.value.results && onLegisResponse.value.results.results) {
        const mappedONLegis: SearchResultItem[] = onLegisResponse.value.results.results.map((item: any) => ({
          id: item.searchId,
          citation: item.documentProductNumber,
          title_en: item.documentTitle,
          dataset: 'ONLegis',
          snippet: item.snippet,
          url_en: `https://qweri.lexum.com/w/onlegis/${item.documentProductNumber}`
        }));
        combinedResults = [...combinedResults, ...mappedONLegis];
      }

      if (webResponse.status === 'fulfilled' && webResponse.value && webResponse.value.length > 0) {
        combinedResults = [...combinedResults, ...webResponse.value];
      }

      // If NLP is enabled and we have results, score and summarize them
      if (params.use_nlp && combinedResults.length > 0) {
        setIsScoring(true);
        // Set initial results so user sees something while scoring happens
        setSearchResults(combinedResults);
        
        try {
          const scoredDict = await scoreAndSummarizeResults(params.query, combinedResults);
          
          // Apply scores and summaries
          const scoredResults = combinedResults.map(result => {
            const id = result.citation || result.id || 'unknown';
            const scoreInfo = scoredDict[id];
            if (scoreInfo) {
              return { ...result, alignmentScore: scoreInfo.score, aiSummary: scoreInfo.summary };
            }
            return result;
          });

          // Sort by alignment score if available, otherwise keep original order
          scoredResults.sort((a, b) => {
            if (a.alignmentScore !== undefined && b.alignmentScore !== undefined) {
              return b.alignmentScore - a.alignmentScore;
            }
            if (a.alignmentScore !== undefined) return -1;
            if (b.alignmentScore !== undefined) return 1;
            return 0;
          });

          setSearchResults(scoredResults);
        } catch (scoreErr) {
          console.error("Scoring failed, showing unscored results", scoreErr);
          // Keep the unscored results already set
        } finally {
          setIsScoring(false);
        }
      } else {
        setSearchResults(combinedResults);
      }

    } catch (err: any) {
      setSearchError(err.message || 'An error occurred while searching.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchCanLII = () => {
    const queryToUse = nlpData?.optimizedQuery || lastQuery;
    if (queryToUse) {
      setCanliiUrl(`https://www.canlii.org/en/#search/text=${encodeURIComponent(queryToUse)}`);
      setActiveTab('canlii');
    }
  };

  const handleViewOnCanLII = (url: string) => {
    setCanliiUrl(url);
    setActiveTab('canlii');
    setSelectedDocument(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <Scale className="h-8 w-8 text-indigo-600 mr-3" />
              <div>
                <h1 className="text-xl font-bold text-gray-900 leading-tight">Canadian Legal Data Explorer</h1>
                <p className="text-xs text-gray-500 font-medium tracking-wide">Powered by A2AJ & CanLII</p>
              </div>
            </div>
            <nav className="flex space-x-2 sm:space-x-4">
              <button
                onClick={() => setActiveTab('search')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center ${
                  activeTab === 'search'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Search className="h-4 w-4 mr-2" />
                Search
              </button>
              <button
                onClick={() => setActiveTab('coverage')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center ${
                  activeTab === 'coverage'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Database className="h-4 w-4 mr-2" />
                Coverage
              </button>
              <button
                onClick={() => setActiveTab('canlii')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center ${
                  activeTab === 'canlii'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                CanLII
              </button>
              <button
                onClick={() => setActiveTab('tla')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center ${
                  activeTab === 'tla'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Library className="h-4 w-4 mr-2" />
                External Resources
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'search' && (
          <div className="space-y-6">
            <SearchForm onSearch={handleSearch} isLoading={isSearching} />
            
            {searchError && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                  <p className="text-sm text-red-700">{searchError}</p>
                </div>
              </div>
            )}

            {hasSearched && !isSearching && !searchError && (
              <div>
                {nlpData && nlpData.extractedConcepts.length > 0 && (
                  <div className="mb-6 bg-indigo-50 border border-indigo-100 rounded-lg p-4">
                    <div className="flex items-start">
                      <Sparkles className="h-5 w-5 text-indigo-500 mr-2 mt-0.5" />
                      <div>
                        <h3 className="text-sm font-medium text-indigo-900">AI Query Optimization</h3>
                        <p className="text-xs text-indigo-700 mt-1 mb-2">
                          Your natural language query was analyzed to extract core legal concepts and optimize the search string for better results.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {nlpData.extractedConcepts.map((concept, idx) => (
                            <span key={idx} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                              {concept}
                            </span>
                          ))}
                        </div>
                        <div className="mt-3 text-xs text-indigo-600 font-mono bg-white/50 p-2 rounded border border-indigo-100">
                          <strong>Optimized Query:</strong> {nlpData.optimizedQuery}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-medium text-gray-900 flex items-center">
                    Search Results ({searchResults.length})
                    {isScoring && (
                      <span className="ml-3 inline-flex items-center text-xs font-medium text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                        <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        AI is scoring & summarizing top results...
                      </span>
                    )}
                  </h2>
                  <div className="flex space-x-3">
                    <button
                      onClick={handleSearchCanLII}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <ExternalLink className="h-4 w-4 mr-2 text-indigo-500" />
                      Search on CanLII
                    </button>
                    <button
                      onClick={() => setActiveTab('tla')}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <Library className="h-4 w-4 mr-2 text-indigo-500" />
                      Search External Resources
                    </button>
                  </div>
                </div>
                <SearchResults 
                  results={searchResults} 
                  docType={currentDocType}
                  query={nlpData ? nlpData.optimizedQuery : lastQuery}
                  onSelectResult={(citation, docType, url_en, url_fr) => {
                    const result = searchResults.find(r => r.citation === citation || r.citation_en === citation || r.id === citation);
                    if (result && (result.dataset === 'ONLegis' || result.dataset?.includes('Web Search') || result.dataset?.includes('AdmiraltyLaw') || result.dataset?.includes('LegalTree') || result.dataset?.includes('Globalex') || result.dataset?.includes('Search Systems') || result.dataset?.includes('Police Record Hub')) && url_en) {
                      window.open(url_en, '_blank');
                    } else {
                      setSelectedDocument({ citation, docType, url_en, url_fr });
                    }
                  }} 
                />
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'coverage' && (
          <div className="space-y-6">
            <CoverageTable />
          </div>
        )}

        {activeTab === 'canlii' && (
          <CanLIIViewer initialUrl={canliiUrl} />
        )}

        {activeTab === 'tla' && (
          <TLADatabases query={nlpData ? nlpData.optimizedQuery : lastQuery} />
        )}
      </main>

      {/* Document Viewer Modal */}
      {selectedDocument && (
        <DocumentViewer
          citation={selectedDocument.citation}
          docType={selectedDocument.docType}
          urlEn={selectedDocument.url_en}
          urlFr={selectedDocument.url_fr}
          onClose={() => setSelectedDocument(null)}
          onViewCanLII={handleViewOnCanLII}
        />
      )}
    </div>
  );
}
