import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function run() {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: "Search for 'Falun Gong' on site:canlii.org and return the top 3 case names and their URLs.",
    config: {
      tools: [{ googleSearch: {} }],
    },
  });
  
  console.log(response.text);
  console.log(JSON.stringify(response.candidates?.[0]?.groundingMetadata?.groundingChunks, null, 2));
}
run();
