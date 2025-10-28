// paperService.ts
// Handles all paper search and parsing using Gemini through your Cloudflare Worker proxy.

import { Paper } from "../types";

// 🌐 Cloudflare Worker proxy endpoint
const GEMINI_PROXY_URL = "https://ai-research-assistant.dharunnamikaze.workers.dev";

/* ────────────────────────────────────────────────
   Utility: Send Prompt to Cloudflare Worker Proxy
────────────────────────────────────────────────── */
const callGeminiProxy = async (
  prompt: string,
  model: string = "gemini-2.5-pro",
  extraConfig: Record<string, any> = {}
): Promise<string> => {
  try {
    const response = await fetch(GEMINI_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, model, ...extraConfig }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Proxy request failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    // Handle various Gemini output formats
    const output =
      data?.output ||
      data?.text ||
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "";

    if (!output.trim()) {
      throw new Error("⚠️ Empty response from Gemini proxy.");
    }

    return output.trim();
  } catch (error) {
    console.error("Gemini proxy call failed:", error);
    throw new Error("Failed to communicate with the Gemini proxy service.");
  }
};

/* ────────────────────────────────────────────────
   Stage 1️⃣: Retrieve Unstructured Paper Data
────────────────────────────────────────────────── */
const getRawPaperData = async (query: string): Promise<string> => {
  const prompt = `
You are an expert AI research assistant. Find up to **7** academic papers relevant to the following query:

"${query}"

Each paper should include:
- Title
- Authors
- Year
- Abstract
- Citation Count

Rules:
1. Simulate an academic paper search (assume internet access).
2. If information is missing:
   - Authors → ["Unknown Author"]
   - Year → Current year
   - Abstract → "Abstract not available."
   - Citation Count → 0
3. Output plain text only — NOT JSON or Markdown.
4. Make results realistic and diverse.
  `;

  try {
    const output = await callGeminiProxy(prompt, "gemini-2.5-pro");
    if (!output) {
      console.warn("⚠️ No raw data returned for query:", query);
      return "";
    }
    return output;
  } catch (error) {
    console.error("Error in Stage 1 (getRawPaperData):", error);
    throw new Error("Stage 1 failed: Could not fetch raw academic paper data.");
  }
};

/* ────────────────────────────────────────────────
   Stage 2️⃣: Convert Text → Structured JSON
────────────────────────────────────────────────── */
const formatPaperData = async (rawData: string): Promise<Paper[]> => {
  if (!rawData.trim()) return [];

  const prompt = `
You are a data extraction model. Convert the following unstructured paper info into a clean JSON array.

---
${rawData}
---

Schema:
[
  {
    "id": "unique-id",
    "title": "string",
    "authors": ["string"],
    "year": 2024,
    "abstract": "string",
    "citationCount": 42,
    "tldr": "string"
  }
]

Rules:
- If any field is missing, assign defaults:
  - authors → ["Unknown"]
  - year → current year
  - abstract → "Abstract not available."
  - citationCount → 0
  - tldr → first sentence of abstract
- Output only valid JSON, no markdown or explanation text.
`;

  try {
    const output = await callGeminiProxy(prompt, "gemini-2.5-flash");
    const parsed = JSON.parse(output);

    if (!Array.isArray(parsed)) {
      throw new Error("Invalid format: Expected a JSON array of papers.");
    }

    return parsed;
  } catch (error) {
    console.error("Error in Stage 2 (formatPaperData):", error);
    throw new Error("Stage 2 failed: Could not structure paper data correctly.");
  }
};

/* ────────────────────────────────────────────────
   Main Orchestrator Function
────────────────────────────────────────────────── */
export const searchPapers = async (query: string): Promise<Paper[]> => {
  try {
    console.log(`🔍 Starting Gemini-powered paper search for: ${query}`);

    const rawData = await getRawPaperData(query);
    const papers = await formatPaperData(rawData);

    if (!papers.length) {
      console.warn("⚠️ No structured papers extracted for query:", query);
    }

    return papers;
  } catch (error) {
    console.error("❌ Paper search pipeline failed:", error);
    throw error instanceof Error
      ? error
      : new Error("Unexpected error in paper search process.");
  }
};
