import { GoogleGenAI, Type } from "@google/genai";
import { Paper, ComparisonResult, KnowledgeGraphData, SinglePaperAnalysisResult } from '../types';

// This function safely initializes and returns the AI client.
// It is called only when an API request is made.
const getClient = () => {
    // Fix: Per guidelines, use process.env.API_KEY instead of Vite-specific import.meta.env. This resolves the TypeScript error 'Property 'env' does not exist on type 'ImportMeta''.
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        // This error will be thrown if the environment variable is not set.
        throw new Error(
            "Configuration Error: The API_KEY environment variable is not set. Please ensure it is configured in your environment. The application cannot function without it."
        );
    }

    return new GoogleGenAI({ apiKey });
}


export const generateSuggestions = async (query: string): Promise<string[]> => {
    try {
        const ai = getClient();
        const prompt = `Based on the user's search for "${query}", generate a JSON array of 3 distinct, high-quality search queries that logically follow the input topic or address potential research gaps.

        Rules:
        - The output must be a single, raw JSON array of strings.
        - Do not include any surrounding text or markdown.
        - Example output: ["Related Query 1", "Alternative perspective query", "Future trends query"]`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            }
        });
        const jsonStr = response.text.trim();
        return JSON.parse(jsonStr);
    } catch (error) {
        console.error("Error generating suggestions:", error);
        // Return an empty array on failure as this is a non-critical feature
        return [];
    }
};

const getComparisonPrompt = (papers: Paper[]) => {
    const paperDetails = papers.map(p => `
        ---
        ID: ${p.id}
        Title: ${p.title}
        Authors: ${p.authors.join(', ')}
        Year: ${p.year}
        Abstract: ${p.abstract}
        ---
    `).join('\n');

    return `You are a world-class research analyst AI. Your task is to perform a detailed comparative analysis of the following academic papers.

    **Input Papers:**
    ${paperDetails}

    **Required Output:**
    Your entire response must be a single, raw JSON object. Do not include any surrounding text or markdown.

    **JSON Schema:**
    {
      "summary": "A concise, high-level summary of the entire set of papers, highlighting the core theme and evolution of ideas.",
      "comparison": {
        "methodology": "Compare the research methods, datasets, and evaluation metrics used across the papers. Note similarities and key differences.",
        "keyFindings": "Compare and contrast the primary conclusions and results. What are the main takeaways from each paper?",
        "contributions": "Analyze the significance and impact of each paper's contribution to its field. Which paper is most influential and why?",
        "contradictions": "Identify any direct conflicts in findings or conclusions. If there are no conflicts, explain how the findings are complementary.",
        "researchGaps": "Identify the collective limitations and unanswered questions. Suggest 2-3 specific future research directions that emerge from analyzing these papers together."
      }
    }`;
};

export const generateComparison = async (papers: Paper[]): Promise<ComparisonResult> => {
    const prompt = getComparisonPrompt(papers);
    try {
        const ai = getClient();
        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro", // Use a more powerful model for deep analysis
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        summary: { type: Type.STRING },
                        comparison: {
                            type: Type.OBJECT,
                            properties: {
                                methodology: { type: Type.STRING },
                                keyFindings: { type: Type.STRING },
                                contributions: { type: Type.STRING },
                                contradictions: { type: Type.STRING },
                                researchGaps: { type: Type.STRING },
                            },
                             required: ["methodology", "keyFindings", "contributions", "contradictions", "researchGaps"]
                        }
                    },
                    required: ["summary", "comparison"]
                }
            }
        });
        const jsonStr = response.text.trim();
        return JSON.parse(jsonStr) as ComparisonResult;
    } catch (error) {
        console.error("Error generating comparison:", error);
        throw new Error("Failed to generate the paper comparison due to an AI processing error.");
    }
};

const getKnowledgeGraphPrompt = (papers: Paper[]) => {
    const paperDetails = papers.map(p => `
        ---
        ID: ${p.id}
        Title: ${p.title}
        Abstract: ${p.abstract}
        ---
    `).join('\n');

    return `You are an AI specializing in knowledge synthesis and graph theory. Your task is to create the data for a knowledge graph from a list of academic papers.

    **Input Papers:**
    ${paperDetails}

    **Instructions:**
    1.  Identify the core concepts and methodologies from all paper abstracts.
    2.  Create nodes for each paper title, each core concept, and each key methodology.
    3.  Create links to connect papers to the concepts and methodologies they discuss.
    4.  The entire output must be a single, raw JSON object adhering to the schema below.

    **JSON Schema:**
    {
      "nodes": [
        { "id": "unique_node_id", "label": "Node Label", "group": "paper_title|concept|methodology" }
      ],
      "links": [
        { "source": "source_node_id", "target": "target_node_id", "label": "describes|uses|builds_on" }
      ]
    }
    
    Example Node: { "id": "paper_1", "label": "Attention Is All You Need", "group": "paper_title" }
    Example Node: { "id": "concept_transformer", "label": "Transformer Architecture", "group": "concept" }
    Example Link: { "source": "paper_1", "target": "concept_transformer", "label": "describes" }
    `;
};


export const generateKnowledgeGraph = async (papers: Paper[]): Promise<KnowledgeGraphData> => {
     const prompt = getKnowledgeGraphPrompt(papers);
    try {
        const ai = getClient();
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        nodes: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    label: { type: Type.STRING },
                                    group: { type: Type.STRING },
                                },
                                required: ["id", "label", "group"]
                            }
                        },
                        links: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    source: { type: Type.STRING },
                                    target: { type: Type.STRING },
                                    label: { type: Type.STRING },
                                },
                                required: ["source", "target", "label"]
                            }
                        }
                    },
                    required: ["nodes", "links"]
                }
            }
        });
        const jsonStr = response.text.trim();
        return JSON.parse(jsonStr) as KnowledgeGraphData;
    } catch (error) {
        console.error("Error generating knowledge graph:", error);
        throw new Error("Failed to generate the knowledge graph due to an AI processing error.");
    }
};

const getSinglePaperAnalysisPrompt = (paper: Paper) => {
    return `You are a world-class research analyst AI. Your task is to perform a detailed analysis of the following academic paper based on its title, authors, year, and abstract.

    **Input Paper:**
    ---
    Title: ${paper.title}
    Authors: ${paper.authors.join(', ')}
    Year: ${paper.year}
    Abstract: ${paper.abstract}
    ---

    **Required Output:**
    Your entire response must be a single, raw JSON object. Do not include any surrounding text or markdown.

    **JSON Schema:**
    {
      "summary": "A concise summary of the paper's core topic, methodology, and findings.",
      "keyConcepts": "A bulleted list (using '\\n- ') of the most important concepts, terms, and theories introduced or utilized in the paper.",
      "methodology": "A detailed description of the research methodology, including the dataset, model architecture (if any), and evaluation metrics.",
      "contributions": "A bulleted list (using '\\n- ') analyzing the paper's main contributions to its field. What is novel or significant?",
      "futureWork": "A summary of the potential future work or research directions suggested by the authors or implied by the paper's limitations."
    }`;
};

export const generateSinglePaperAnalysis = async (paper: Paper): Promise<SinglePaperAnalysisResult> => {
    const prompt = getSinglePaperAnalysisPrompt(paper);
    try {
        const ai = getClient();
        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro", // Use Pro for higher quality analysis
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        summary: { type: Type.STRING },
                        keyConcepts: { type: Type.STRING },
                        methodology: { type: Type.STRING },
                        contributions: { type: Type.STRING },
                        futureWork: { type: Type.STRING },
                    },
                    required: ["summary", "keyConcepts", "methodology", "contributions", "futureWork"]
                }
            }
        });
        const jsonStr = response.text.trim();
        return JSON.parse(jsonStr) as SinglePaperAnalysisResult;
    } catch (error) {
        console.error("Error generating single paper analysis:", error);
        throw new Error("Failed to generate the paper analysis due to an AI processing error.");
    }
};
