import { GoogleGenAI, Type } from "@google/genai";
import { SearchResultItem } from "./api";

// Initialize the Gemini API client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface NlpAnalysis {
  optimizedQuery: string;
  extractedConcepts: string[];
}

export interface ScoredResult {
  id: string;
  score: number;
  summary: string;
}

/**
 * Uses Gemini as an NLP engine to analyze a natural language query,
 * extract core legal concepts, and generate an optimized keyword string
 * for traditional search engines.
 */
export async function analyzeQuery(query: string): Promise<NlpAnalysis> {
  // If the query is extremely short, it's likely already just keywords
  if (query.trim().split(/\s+/).length <= 2) {
    return {
      optimizedQuery: query,
      extractedConcepts: []
    };
  }

  const prompt = `
  You are an expert Canadian legal researcher and Natural Language Processing engine.
  Analyze the following user search query intended for a legal database.
  
  1. Extract the core legal concepts, entities, and causes of action.
  2. Create an optimized keyword search string. 
     - Remove conversational filler words (e.g., "what happens if", "can I"). 
     - Add highly relevant legal synonyms if they would improve search recall (e.g., if user says "fired", add "wrongful dismissal").
     - Keep the query concise and focused on the most important terms.
     - Do NOT use complex boolean operators (AND, OR, NOT) unless the user explicitly used them, as the underlying search engine might not support them perfectly. Space-separated keywords are best.
  
  User Query: "${query}"
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            optimizedQuery: { 
              type: Type.STRING, 
              description: "The optimized, space-separated keyword search string. Do not use complex boolean operators unless necessary." 
            },
            extractedConcepts: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING }, 
              description: "List of 2-5 core legal concepts or entities extracted from the query." 
            }
          },
          required: ["optimizedQuery", "extractedConcepts"]
        }
      }
    });
    
    const result = JSON.parse(response.text || "{}");
    return {
      optimizedQuery: result.optimizedQuery || query,
      extractedConcepts: result.extractedConcepts || []
    };
  } catch (error) {
    console.error("NLP Analysis failed:", error);
    // Fallback to original query if the AI fails
    return { 
      optimizedQuery: query, 
      extractedConcepts: [] 
    };
  }
}

/**
 * Scores and summarizes search results based on their alignment with the user's query.
 */
export async function scoreAndSummarizeResults(query: string, results: SearchResultItem[]): Promise<Record<string, ScoredResult>> {
  if (!results || results.length === 0) return {};

  // Take top 10 results to avoid exceeding token limits and keep response fast
  const topResults = results.slice(0, 10).map(r => ({
    id: r.citation || r.id || 'unknown',
    title: r.title_en || r.title_fr || r.name_en || r.name_fr || 'Untitled',
    snippet: r.snippet || (r.snippets && r.snippets.length > 0 ? r.snippets[0] : '')
  }));

  const prompt = `
  You are an expert legal AI assistant. Evaluate how well the following search results match the user's query.
  
  User Query: "${query}"
  
  Results to Evaluate:
  ${JSON.stringify(topResults, null, 2)}
  
  For each result, provide:
  1. An alignment score from 0 to 100 based on how well the result's title and snippet relate to the user's query.
  2. A brief 1-2 sentence summary explaining its relevance to the query.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING, description: "The ID of the result being evaluated." },
              score: { type: Type.NUMBER, description: "Alignment score from 0 to 100." },
              summary: { type: Type.STRING, description: "A brief 1-2 sentence summary of relevance." }
            },
            required: ["id", "score", "summary"]
          }
        }
      }
    });

    const parsedResults: ScoredResult[] = JSON.parse(response.text || "[]");
    
    // Convert array to a dictionary keyed by ID for easy lookup
    const scoredDict: Record<string, ScoredResult> = {};
    parsedResults.forEach(item => {
      scoredDict[item.id] = item;
    });
    
    return scoredDict;
  } catch (error) {
    console.error("Scoring and summarization failed:", error);
    return {};
  }
}

/**
 * Uses Gemini's Google Search grounding to search specific external legal websites.
 */
export async function searchExternalSites(query: string): Promise<SearchResultItem[]> {
  const prompt = `Search for information related to "${query}" strictly on the following websites using site: operators:
  - site:admiraltylaw.com
  - site:legaltree.ca
  - site:nyulawglobal.org/globalex/Canada1.html
  - site:publicrecords.searchsystems.net/Canada_Free_Public_Records/
  - site:policerecordhub.ca
  
  Provide a brief summary of the findings.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const results: SearchResultItem[] = [];
    const seenUris = new Set<string>();
    
    chunks.forEach((chunk: any, index: number) => {
      if (chunk.web?.uri && chunk.web?.title) {
        const uri = chunk.web.uri;
        if (!seenUris.has(uri)) {
          seenUris.add(uri);
          
          let dataset = 'Web Search';
          if (uri.includes('admiraltylaw.com')) dataset = 'AdmiraltyLaw.com';
          else if (uri.includes('legaltree.ca')) dataset = 'LegalTree.ca';
          else if (uri.includes('nyulawglobal.org')) dataset = 'Globalex (NYU)';
          else if (uri.includes('searchsystems.net')) dataset = 'Search Systems (Public Records)';
          else if (uri.includes('policerecordhub.ca')) dataset = 'Police Record Hub';

          results.push({
            id: `web-${index}-${Date.now()}`,
            citation: chunk.web.title,
            title_en: chunk.web.title,
            dataset: dataset,
            snippet: `Source document retrieved from ${uri}`,
            url_en: uri,
          });
        }
      }
    });

    return results;
  } catch (error) {
    console.error("Web search failed:", error);
    return [];
  }
}
