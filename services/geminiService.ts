import { GoogleGenAI, Type } from "@google/genai";
import { Paper, ComparisonResult, KnowledgeGraphData, SinglePaperAnalysisResult } from '../types';

const getAi = (): GoogleGenAI => {
    // Check if the 'process' object and 'process.env' are available.
    // This is crucial for browser environments where these are not standard.
    if (typeof process === 'undefined' || !process.env) {
        throw new Error(
            "Configuration Error: The application is in an environment where `process.env` is not available. " +
            "If deploying to a static host like Vercel, ensure your project is configured with a build step (e.g., using Vite or Next.js) " +
            "to properly expose environment variables to the client-side."
        );
    }
    
    if (!process.env.API_KEY) {
        throw new Error("Configuration Error: The API_KEY environment variable is not set. Please add your API_KEY to your project's environment variables in your hosting platform (e.g., Vercel).");
    }
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
}

export const generateSuggestions = async (query: string): Promise<string[]> => {
    try {
        const ai = getAi();
        const prompt = `Based on the research paper search query "${query}", generate 3 related but different search queries that a researcher might find useful. Return the result as a JSON array of strings.`;
        
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                },
            },
        });

        const jsonStr = response.text.trim();
        const suggestions = JSON.parse(jsonStr);
        return suggestions;
    } catch (error) {
        console.error("Error generating suggestions:", error);
        return [`alternative views on ${query}`, `historical context of ${query}`, `future of ${query}`];
    }
};

export const generateComparison = async (papers: Paper[]): Promise<ComparisonResult> => {
    const ai = getAi();
    const paperContext = papers.map(p => `
        PAPER ID: ${p.id}
        TITLE: ${p.title}
        AUTHORS: ${p.authors.join(', ')}
        YEAR: ${p.year}
        ABSTRACT: ${p.abstract}
    `).join('\n---\n');

    const prompt = `You are an expert academic reviewer AI. Your task is to conduct a rigorous, in-depth comparative analysis of the following research papers. Your output must be a JSON object that is both detailed and critically insightful.

        PAPERS:
        ${paperContext}

        TASK:
        Generate a JSON object with two main keys: "summary" and "comparison".

        1.  **summary**: A concise, executive summary that synthesizes the core themes, objectives, and collective significance of the provided papers. Go beyond a simple list of topics; identify the overarching narrative or research trajectory they represent.

        2.  **comparison**: A detailed object containing a critical analysis for each of the following fields. Do not simply describe; you must compare, contrast, and synthesize.

            *   **methodology**:
                - First, for each paper, individually identify and briefly describe its primary methodology, experimental setup, datasets used, and key evaluation metrics.
                - Then, critically compare and contrast these approaches. Are they standard for the field? Are they innovative? What are the potential strengths and weaknesses of each approach relative to the others?

            *   **keyFindings**:
                - For each paper, list its most significant findings and conclusions.
                - Compare these findings directly. Do they corroborate, complement, or challenge one another? Highlight specific points of convergence or divergence. Quantify results where possible.

            *   **contributions**:
                - Clearly articulate the primary contribution of each paper to its field. Is it a new model, a novel dataset, a theoretical insight, or a comprehensive survey?
                - Compare the *significance* and *impact* of these contributions. Which paper offers a more foundational or disruptive contribution and why?

            *   **contradictions**:
                - Scrutinize the papers for any direct contradictions in their claims, findings, or conclusions.
                - IMPORTANT: If no direct contradictions are found, you MUST state this explicitly and provide a nuanced explanation. For example: "No direct contradictions were found, as Paper A focuses on model efficiency while Paper B investigates theoretical underpinnings, making their findings complementary rather than conflicting." Do not leave this field empty or generic.

            *   **researchGaps**:
                - Synthesize the limitations acknowledged by the authors and the future work they propose.
                - From your expert perspective, identify any broader research gaps or unanswered questions that emerge from reading these papers together. What is the logical next step for research in this combined area?
    `;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    summary: { 
                        type: Type.STRING,
                        description: "A concise executive summary synthesizing the core themes, objectives, and collective significance of the provided papers."
                    },
                    comparison: {
                        type: Type.OBJECT,
                        properties: {
                            methodology: { 
                                type: Type.STRING,
                                description: "A critical comparison of the methodologies, experimental setups, datasets, and evaluation metrics used in each paper."
                            },
                            keyFindings: { 
                                type: Type.STRING,
                                description: "A direct comparison of the most significant findings and conclusions from each paper, highlighting points of convergence or divergence."
                            },
                            contributions: { 
                                type: Type.STRING,
                                description: "An analysis of the primary contribution of each paper and a comparison of their significance and impact."
                            },
                            contradictions: { 
                                type: Type.STRING,
                                description: "Identification of any direct contradictions. If none, an explicit statement and explanation for the lack of conflict."
                            },
                            researchGaps: { 
                                type: Type.STRING,
                                description: "A synthesis of limitations, proposed future work, and broader research gaps that emerge from reading the papers together."
                            },
                        },
                        required: ["methodology", "keyFindings", "contributions", "contradictions", "researchGaps"]
                    }
                },
                required: ["summary", "comparison"]
            }
        },
    });

    const jsonStr = response.text.trim();
    return JSON.parse(jsonStr) as ComparisonResult;
};

export const generateKnowledgeGraph = async (papers: Paper[]): Promise<KnowledgeGraphData> => {
     const ai = getAi();
     const paperContext = papers.map(p => `
        PAPER ID: ${p.id}
        TITLE: ${p.title}
        ABSTRACT: ${p.abstract}
    `).join('\n---\n');

    const prompt = `Analyze the provided research paper abstracts to create a knowledge graph.
    
    PAPERS:
    ${paperContext}

    TASK:
    Your goal is to create a visual summary of the papers' core concepts. Generate a JSON object representing this graph with "nodes" and "links".
    - "nodes": An array of objects, each with "id" (unique string), "label" (concept name), and "group" ('paper_title', 'concept', or 'methodology'). You MUST create one 'paper_title' node for each paper. Then, identify the top 5-7 most important concepts or methods from all papers combined to create 'concept' or 'methodology' nodes.
    - "links": An array of objects, each with "source" (node id), "target" (node id), and "label" (relationship, e.g., "uses", "addresses"). Links must connect concepts to the paper they came from, or connect shared concepts between papers.

    IMPORTANT: A knowledge graph must always be generated. If the papers are on very different topics, create separate clusters of concept nodes for each paper, all linking back to their respective 'paper_title' node. Do not return an empty "nodes" or "links" array. The graph must visually represent the key ideas of the provided papers.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
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
                        },
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
                        },
                    },
                },
                required: ["nodes", "links"]
            },
        },
    });

    const jsonStr = response.text.trim();
    return JSON.parse(jsonStr) as KnowledgeGraphData;
};

export const generateSinglePaperAnalysis = async (paper: Paper): Promise<SinglePaperAnalysisResult> => {
    const ai = getAi();
    const prompt = `You are a research analyst AI. Provide a detailed analysis of the following research paper.

    PAPER:
    TITLE: ${paper.title}
    AUTHORS: ${paper.authors.join(', ')}
    YEAR: ${paper.year}
    ABSTRACT: ${paper.abstract}

    TASK:
    Generate a comprehensive analysis structured as a JSON object with the following keys:
    - "summary": A concise summary of the paper's core topic and findings.
    - "keyConcepts": A list or paragraph of the most important concepts, terms, and theories discussed.
    - "methodology": A description of the research methodology used in the paper.
    - "contributions": An analysis of the paper's main contributions to its field.
    - "futureWork": A summary of the potential future work or research directions suggested by the paper.

    Your analysis should be clear, insightful, and well-structured.
    `;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
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
        },
    });

    const jsonStr = response.text.trim();
    return JSON.parse(jsonStr) as SinglePaperAnalysisResult;
}