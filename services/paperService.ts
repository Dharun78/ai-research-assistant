import { Paper } from '../types';
import { GoogleGenAI, Type } from "@google/genai";

const getAi = (): GoogleGenAI => {
    let apiKey: string | undefined;
    try {
        // This is the prescribed way to access the key.
        // It might be replaced by a build tool, or the environment might shim `process`.
        apiKey = process.env.API_KEY;
    } catch (e) {
        // This catch block will handle the "ReferenceError: process is not defined" case gracefully.
        console.error("Could not access process.env.API_KEY", e);
    }

    if (!apiKey) {
        // This will be triggered if process.env.API_KEY is undefined, null, or an empty string,
        // or if the try block failed.
        throw new Error(
            "Configuration Error: The API_KEY is not available. \n\n" +
            "If you have deployed this application, please ensure that the API_KEY environment variable is correctly set in your hosting provider's settings (e.g., Vercel, Netlify). \n\n" +
            "The application cannot function without the API key."
        );
    }

    return new GoogleGenAI({ apiKey });
}

// Stage 1: Gather raw, unstructured data using Google Search.
// This function is designed to be highly reliable by asking for a simple text output.
const getRawPaperData = async (ai: GoogleGenAI, query: string): Promise<string> => {
    const prompt = `You are an expert research assistant. Your task is to use Google Search to find academic papers related to the query: "${query}".
    
    Synthesize the information you find for up to 7 of the most relevant papers into a single, unstructured block of text.
    For each paper you find, include as much of the following information as possible:
    - The title
    - The authors
    - The publication year
    - A short abstract or summary
    - The number of citations
    
    It is okay if some information is missing. Just present what you find clearly. Do not format the output as JSON. Just return the text.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }]
            }
        });

        if (response.promptFeedback && response.promptFeedback.blockReason) {
            const { blockReason, safetyRatings } = response.promptFeedback;
            const blockedCategories = safetyRatings?.filter(r => r.blocked).map(r => r.category).join(', ') || 'N/A';
            throw new Error(
                `Search failed: The query was blocked for safety reasons.\nReason: ${blockReason}.\nCategories: ${blockedCategories}.`
            );
        }

        const text = response.text?.trim();
        if (!text) {
            console.warn("Stage 1 (Data Gathering) returned no text. This likely means no relevant papers were found on the web for the query.");
            return ""; 
        }

        return text;
    } catch(e) {
        console.error("Error in Stage 1 (getRawPaperData):", e);
        throw e; // Re-throw to be caught by the main search function
    }
};

// Stage 2: Parse the raw data into structured JSON.
// This function is highly reliable due to the use of responseMimeType and a schema.
const formatPaperData = async (ai: GoogleGenAI, rawData: string): Promise<Paper[]> => {
    if (!rawData.trim()) {
        return []; // If stage 1 found nothing, return an empty array.
    }

    const prompt = `You are a data extraction and formatting expert. You will be given a block of text containing unstructured information about academic papers. Your sole task is to parse this text and convert it into a structured JSON array of paper objects.

    **Input Text:**
    ---
    ${rawData}
    ---
    
    **Output JSON Schema:**
    For each paper you can identify in the text, create a JSON object with the following fields:
    - id: A unique identifier (e.g., arXiv ID or DOI if present). If unavailable, create a unique slug from the title and year.
    - title: The full title of the paper.
    - authors: An array of strings with the primary authors' names. If unavailable, use ["Unknown"].
    - year: The publication year as a number. If unavailable, use the current year.
    - abstract: A concise and informative abstract of the paper. If unavailable, use "Abstract not available."
    - citationCount: The number of citations. If unknown, use 0.
    - tldr: A one-sentence "Too Long; Didn't Read" summary based on the abstract. If you cannot create one, use the first sentence of the abstract.
    
    Your entire response MUST be a single, raw JSON array. If you cannot identify any valid papers in the input text, you MUST return an empty array \`[]\`.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING },
                            title: { type: Type.STRING },
                            authors: { type: Type.ARRAY, items: { type: Type.STRING } },
                            year: { type: Type.NUMBER },
                            abstract: { type: Type.STRING },
                            citationCount: { type: Type.NUMBER },
                            tldr: { type: Type.STRING },
                        },
                        required: ["id", "title", "authors", "year", "abstract", "citationCount", "tldr"]
                    }
                }
            }
        });

        const jsonStr = response.text.trim();
        return JSON.parse(jsonStr) as Paper[];
    } catch(e) {
        console.error("Error in Stage 2 (formatPaperData):", e);
        throw new Error("The AI failed to format the search results. This may be a temporary issue.");
    }
};


// The main exported function that orchestrates the two-stage pipeline.
export const searchPapers = async (query: string): Promise<Paper[]> => {
    const ai = getAi();
    try {
        console.log(`Starting two-stage search for: ${query}`);
        
        // Stage 1: Get raw, unstructured data from the web.
        const rawData = await getRawPaperData(ai, query);

        // Stage 2: Parse the raw data into structured JSON.
        const papers = await formatPaperData(ai, rawData);

        return papers;

    } catch (error) {
        console.error("Error in the two-step paper search pipeline:", error);
        if (error instanceof Error) {
            // Re-throw the original error message as it's now more specific.
            throw error;
        }
        throw new Error("An unexpected error occurred during the paper search.");
    }
};
