import { GoogleGenAI } from "@google/genai";
import { SearchResultItem } from "./api";

// Initialize the Gemini API client
// Note: In this specific environment, process.env.GEMINI_API_KEY is automatically handled
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function formatCitation(result: SearchResultItem): Promise<string> {
  const title = result.title_en || result.title_fr || result.name_en || result.name_fr || 'Untitled Document';
  const citation = result.citation || result.citation_en || result.id || 'Unknown Citation';
  const date = result.date || result.document_date_en || result.document_date_fr || 'Unknown Date';
  const dataset = result.dataset || 'Unknown Dataset';

  const prompt = `
You are an expert in Canadian legal citation, specifically the McGill Guide (Canadian Guide to Uniform Legal Citation, 10th ed).
Please format the following legal document metadata into a proper McGill Guide citation.
Return ONLY the formatted citation string as plain text. Do not include any markdown formatting, explanations, or quotes.

Metadata:
Title: ${title}
Citation/ID: ${citation}
Date: ${date}
Dataset/Court: ${dataset}
  `.trim();

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    
    return response.text?.trim() || citation;
  } catch (error) {
    console.error("Error formatting citation:", error);
    return citation; // Fallback to the raw citation if the AI fails
  }
}
