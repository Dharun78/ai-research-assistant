// geminiService.ts
// Unified, strongly typed Gemini service using Cloudflare Worker proxy.
// This mirrors the new structure and error handling you added in paperService.ts.

import { Paper, ComparisonResult, KnowledgeGraphData, SinglePaperAnalysisResult } from '../types';

// 🌐 Cloudflare Worker proxy endpoint (handles Gemini API calls securely)
const GEMINI_PROXY_URL = "https://ai-research-assistant.dharunnamikaze.workers.dev";

/* ────────────────────────────────────────────────
   Utility: Call the Cloudflare Worker Proxy
────────────────────────────────────────────────── */
const callGeminiProxy = async (
  prompt: string,
  model: string = "gemini-2.5-pro"
): Promise<string> => {
  try {
    const response = await fetch(GEMINI_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, model }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Proxy request failed (Status ${response.status}): ${errorText}`);
    }

    const data = await response.json();

    const output =
      data?.output ||
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      null;

    if (!output) {
      throw new Error("The Gemini proxy returned an empty response. Check prompt or Worker logs.");
    }

    return output.trim();
  } catch (error) {
    console.error("Error in Gemini proxy communication:", error);
    throw new Error("Gemini proxy request failed. Please try again later.");
  }
};

/* ────────────────────────────────────────────────
   1️⃣ Generate Research Query Suggestions
────────────────────────────────────────────────── */
export const generateSuggestions = async (query: string): Promise<string[]> => {
  const prompt = `
You are an AI research assistant. Based on the user's search for "${query}", generate 3 new, high-quality related research queries.

**Rules:**
- Output ONLY a JSON array of strings.
- Example: ["Applications of ${query}", "Future challenges in ${query}", "Comparative analysis of ${query} methods"]
  `;

  try {
    const output = await callGeminiProxy(prompt, "gemini-2.5-flash");
    return JSON.parse(output);
  } catch (error) {
    console.error("Error generating research suggestions:", error);
    return [];
  }
};

/* ────────────────────────────────────────────────
   2️⃣ Compare Multiple Papers
────────────────────────────────────────────────── */
const getComparisonPrompt = (papers: Paper[]) => `
You are a world-class AI research analyst. Compare the following academic papers comprehensively.

${papers
  .map(
    (p) => `
---
Title: ${p.title}
Authors: ${p.authors.join(", ")}
Year: ${p.year}
Abstract: ${p.abstract}
---
`
  )
  .join("\n")}

Return the response as **strict JSON** in this schema:
{
  "summary": "Overall comparison summary",
  "comparison": {
    "methodology": "Detailed comparison of methods",
    "keyFindings": "Core findings comparison",
    "contributions": "Unique contributions",
    "contradictions": "Differences or opposing results",
    "researchGaps": "Gaps or unexplored areas"
  }
}
`;

export const generateComparison = async (
  papers: Paper[]
): Promise<ComparisonResult> => {
  try {
    const prompt = getComparisonPrompt(papers);
    const output = await callGeminiProxy(prompt, "gemini-2.5-pro");
    return JSON.parse(output);
  } catch (error) {
    console.error("Error generating paper comparison:", error);
    throw new Error("Failed to generate paper comparison analysis.");
  }
};

/* ────────────────────────────────────────────────
   3️⃣ Generate Knowledge Graph
────────────────────────────────────────────────── */
const getKnowledgeGraphPrompt = (papers: Paper[]) => `
You are an AI that constructs knowledge graphs from research papers.

Extract entities and relationships from the following papers:
${papers
  .map(
    (p) => `
---
Title: ${p.title}
Abstract: ${p.abstract}
---
`
  )
  .join("\n")}

Return data in strict JSON format:
{
  "nodes": [
    { "id": "unique_id", "label": "Entity or concept", "group": "paper|concept|methodology" }
  ],
  "links": [
    { "source": "node_id", "target": "node_id", "label": "relates_to|builds_on|uses" }
  ]
}
`;

export const generateKnowledgeGraph = async (
  papers: Paper[]
): Promise<KnowledgeGraphData> => {
  try {
    const prompt = getKnowledgeGraphPrompt(papers);
    const output = await callGeminiProxy(prompt, "gemini-2.5-flash");
    return JSON.parse(output);
  } catch (error) {
    console.error("Error generating knowledge graph:", error);
    throw new Error("Failed to generate knowledge graph data.");
  }
};

/* ────────────────────────────────────────────────
   4️⃣ Analyze a Single Paper
────────────────────────────────────────────────── */
const getSinglePaperAnalysisPrompt = (paper: Paper) => `
Analyze this research paper and return structured insights in JSON.

---
Title: ${paper.title}
Authors: ${paper.authors.join(", ")}
Year: ${paper.year}
Abstract: ${paper.abstract}
---

Output JSON:
{
  "summary": "Brief summary of the paper",
  "keyConcepts": "- concept1\\n- concept2",
  "methodology": "Explain the approach or experiment used",
  "contributions": "- point1\\n- point2",
  "futureWork": "Suggestions or future research directions"
}
`;

export const generateSinglePaperAnalysis = async (
  paper: Paper
): Promise<SinglePaperAnalysisResult> => {
  try {
    const prompt = getSinglePaperAnalysisPrompt(paper);
    const output = await callGeminiProxy(prompt, "gemini-2.5-pro");
    return JSON.parse(output);
  } catch (error) {
    console.error("Error generating single paper analysis:", error);
    throw new Error("Failed to generate structured single paper analysis.");
  }
};
