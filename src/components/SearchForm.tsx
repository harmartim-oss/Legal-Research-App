import React, { useState, useEffect } from 'react';
import { Search, Filter, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { SearchParams, getCoverage, CoverageItem } from '../lib/api';

interface SearchFormProps {
  onSearch: (params: SearchParams) => void;
  isLoading: boolean;
}

export function SearchForm({ onSearch, isLoading }: SearchFormProps) {
  const [query, setQuery] = useState('');
  const [docType, setDocType] = useState<'cases' | 'laws'>('cases');
  const [searchType, setSearchType] = useState<'full_text' | 'name'>('full_text');
  const [searchLanguage, setSearchLanguage] = useState<'en' | 'fr'>('en');
  const [sortResults, setSortResults] = useState<'default' | 'newest_first' | 'oldest_first'>('default');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [useNlp, setUseNlp] = useState(true);
  
  const [availableDatasets, setAvailableDatasets] = useState<CoverageItem[]>([]);
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>([]);
  const [isLoadingDatasets, setIsLoadingDatasets] = useState(false);
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    async function loadDatasets() {
      setIsLoadingDatasets(true);
      try {
        const response = await getCoverage(docType);
        if (response && response.results) {
          setAvailableDatasets(response.results);
        } else {
          setAvailableDatasets([]);
        }
      } catch (err) {
        console.error('Failed to load datasets', err);
        setAvailableDatasets([]);
      } finally {
        setIsLoadingDatasets(false);
      }
    }
    
    loadDatasets();
    setSelectedDatasets([]); // Reset selected datasets when docType changes
  }, [docType]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    onSearch({
      query,
      doc_type: docType,
      search_type: searchType,
      search_language: searchLanguage,
      sort_results: sortResults,
      dataset: selectedDatasets.length > 0 ? selectedDatasets.join(',') : undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      use_nlp: useNlp,
    });
  };

  const toggleDataset = (datasetCode: string) => {
    setSelectedDatasets(prev => 
      prev.includes(datasetCode) 
        ? prev.filter(d => d !== datasetCode)
        : [...prev, datasetCode]
    );
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
      <div className="flex flex-col md:flex-row gap-4 mb-2">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="Ask a legal question or search keywords across all databases..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            required
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Searching...' : 'Search All'}
        </button>
      </div>

      <div className="flex items-center mb-4 ml-1">
        <label className="flex items-center cursor-pointer group">
          <div className="relative flex items-center">
            <input
              type="checkbox"
              className="sr-only"
              checked={useNlp}
              onChange={() => setUseNlp(!useNlp)}
            />
            <div className={`block w-10 h-6 rounded-full transition-colors ${useNlp ? 'bg-indigo-500' : 'bg-gray-300'}`}></div>
            <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${useNlp ? 'transform translate-x-4' : ''}`}></div>
          </div>
          <div className="ml-3 flex items-center text-sm font-medium text-gray-700 group-hover:text-indigo-600 transition-colors">
            <Sparkles className={`h-4 w-4 mr-1.5 ${useNlp ? 'text-indigo-500' : 'text-gray-400'}`} />
            Enhance search with AI (NLP & Alignment Scoring)
          </div>
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Document Type</label>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value as 'cases' | 'laws')}
            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          >
            <option value="cases">Case Law</option>
            <option value="laws">Statutes & Regulations</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Search Type</label>
          <select
            value={searchType}
            onChange={(e) => setSearchType(e.target.value as 'full_text' | 'name')}
            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          >
            <option value="full_text">Full Text</option>
            <option value="name">Title / Name Only</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Language</label>
          <select
            value={searchLanguage}
            onChange={(e) => setSearchLanguage(e.target.value as 'en' | 'fr')}
            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          >
            <option value="en">English</option>
            <option value="fr">Français</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Sort By</label>
          <select
            value={sortResults}
            onChange={(e) => setSortResults(e.target.value as any)}
            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          >
            <option value="default">Relevance (Default)</option>
            <option value="newest_first">Newest First</option>
            <option value="oldest_first">Oldest First</option>
          </select>
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center text-sm text-indigo-600 hover:text-indigo-800 focus:outline-none"
        >
          <Filter className="h-4 w-4 mr-1" />
          {showAdvanced ? 'Hide Advanced Filters' : 'Show Advanced Filters'}
          {showAdvanced ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
        </button>

        {showAdvanced && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="md:col-span-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Dataset(s) {selectedDatasets.length > 0 && `(${selectedDatasets.length} selected)`}
              </label>
              <div className="border border-gray-300 rounded-md shadow-sm bg-white h-32 overflow-y-auto p-2">
                {isLoadingDatasets ? (
                  <div className="text-xs text-gray-500 p-1">Loading datasets...</div>
                ) : availableDatasets.length === 0 ? (
                  <div className="text-xs text-gray-500 p-1">No datasets available</div>
                ) : (
                  <div className="space-y-1">
                    {availableDatasets.map((ds) => (
                      <label key={ds.dataset} className="flex items-start space-x-2 p-1 hover:bg-gray-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          className="mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          checked={selectedDatasets.includes(ds.dataset)}
                          onChange={() => toggleDataset(ds.dataset)}
                        />
                        <span className="text-xs text-gray-700 leading-tight">
                          <span className="font-medium">{ds.dataset}</span>
                          {ds.description_en && <span className="text-gray-400 block truncate" title={ds.description_en}> {ds.description_en}</span>}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
