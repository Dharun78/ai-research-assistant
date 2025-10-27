export interface Paper {
    id: string;
    title: string;
    authors: string[];
    year: number;
    abstract: string;
    citationCount: number;
    tldr: string;
}

export interface PaperComparison {
    methodology: string;
    keyFindings: string;
    contributions: string;
    contradictions: string;
    researchGaps: string;
}

export interface ComparisonResult {
    summary: string;
    comparison?: PaperComparison;
}

export interface KnowledgeGraphNode {
    id: string;
    label: string;
    group: string; // e.g., 'paper', 'concept', 'method'
}

export interface KnowledgeGraphLink {
    source: string;
    target: string;
    label: string;
}

export interface KnowledgeGraphData {
    nodes: KnowledgeGraphNode[];
    links: KnowledgeGraphLink[];
}

export interface SinglePaperAnalysisResult {
    summary: string;
    keyConcepts: string;
    methodology: string;
    contributions: string;
    futureWork: string;
}