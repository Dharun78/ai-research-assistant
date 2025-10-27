import React, { useRef, useState } from 'react';
import { Paper, ComparisonResult, KnowledgeGraphData } from '../types';
import { ArrowLeft, Download } from './Icons';
import { KnowledgeGraph } from './KnowledgeGraph';

declare var html2canvas: any;
declare var jspdf: any;

interface ComparisonDashboardProps {
    papers: Paper[];
    comparisonResult: ComparisonResult | null;
    knowledgeGraphData: KnowledgeGraphData | null;
    isLoading: boolean;
    onBack: () => void;
    error: string | null;
}

const ComparisonSection: React.FC<{ title: string; content?: string }> = ({ title, content }) => (
    <div className="bg-dark-surface p-6 rounded-lg border-2 border-dark-border">
        <h3 className="text-2xl font-bold text-neon-magenta mb-4">{title}</h3>
        <p className="text-light-text whitespace-pre-wrap leading-relaxed">{content || "No data available."}</p>
    </div>
);


export const ComparisonDashboard: React.FC<ComparisonDashboardProps> = ({ papers, comparisonResult, knowledgeGraphData, isLoading, onBack, error }) => {
    const dashboardRef = useRef<HTMLDivElement>(null);
    const [isExporting, setIsExporting] = useState(false);
    
    const handleExportPdf = async () => {
        if (!dashboardRef.current) return;

        setIsExporting(true);
        const header = dashboardRef.current.querySelector('header');
        if (header) {
            header.style.display = 'none'; // Hide header for export
        }

        try {
            const { jsPDF } = jspdf;
            const canvas = await html2canvas(dashboardRef.current, {
                scale: 2,
                backgroundColor: '#0a0a0a',
                useCORS: true,
                windowWidth: document.documentElement.scrollWidth,
                windowHeight: document.documentElement.scrollHeight,
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'px',
                format: [canvas.width, canvas.height]
            });

            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
            pdf.save('nexus-scholar-comparison.pdf');
        } catch (err) {
            console.error("Failed to export PDF:", err);
            alert("Sorry, there was an issue creating the PDF. Please try again.");
        } finally {
            if (header) {
                header.style.display = 'flex'; // Restore header
            }
            setIsExporting(false);
        }
    };
    
    return (
        <div className="min-h-screen font-sans p-4 sm:p-6 lg:p-8">
            <header className="flex justify-between items-center mb-8">
                <button onClick={onBack} className="flex items-center gap-2 text-neon-cyan hover:underline">
                    <ArrowLeft className="w-5 h-5" />
                    Back to Search
                </button>
                <h1 className="text-3xl md:text-4xl font-bold text-electric-blue font-orbitron tracking-wider">
                    Comparative Analysis
                </h1>
                <button onClick={handleExportPdf} disabled={isExporting} className="flex items-center gap-2 bg-neon-cyan text-dark-bg font-bold py-2 px-4 rounded-lg hover:bg-opacity-80 hover:shadow-neon-cyan transition-all disabled:opacity-50">
                    <Download className="w-5 h-5"/>
                    {isExporting ? 'Exporting...' : 'Export'}
                </button>
            </header>
            <div ref={dashboardRef}>
                {isLoading && (
                    <div className="text-center py-20">
                        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-neon-magenta mx-auto"></div>
                        <p className="mt-6 text-xl text-medium-text">Generating deep semantic comparison... this may take a moment.</p>
                    </div>
                )}

                {error && <p className="text-center text-red-400 text-lg bg-red-900/50 p-4 rounded-lg">{error}</p>}

                {!isLoading && !error && comparisonResult && (
                    <main className="space-y-8">
                        <div className="bg-dark-surface p-6 rounded-lg border-2 border-dark-border">
                            <h2 className="text-2xl font-bold text-neon-cyan mb-4">Compared Papers</h2>
                            <ul className="list-disc list-inside space-y-1">
                                {papers.map(p => <li key={p.id} className="text-light-text">{p.title} ({p.year})</li>)}
                            </ul>
                        </div>

                        <ComparisonSection title="Executive Summary" content={comparisonResult.summary} />
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <ComparisonSection title="Methodology" content={comparisonResult.comparison?.methodology} />
                            <ComparisonSection title="Key Findings" content={comparisonResult.comparison?.keyFindings} />
                            <ComparisonSection title="Contributions" content={comparisonResult.comparison?.contributions} />
                            <ComparisonSection title="Contradictions" content={comparisonResult.comparison?.contradictions} />
                        </div>
                        
                        <ComparisonSection title="Research Gaps & Future Directions" content={comparisonResult.comparison?.researchGaps} />

                        <div className="bg-dark-surface p-6 rounded-lg border-2 border-dark-border">
                            <h3 className="text-2xl font-bold text-neon-magenta mb-4">Knowledge Graph</h3>
                            <div className="h-[500px] w-full bg-black/50 rounded-md">
                                {knowledgeGraphData ? (
                                    <KnowledgeGraph data={knowledgeGraphData} />
                                ) : <p className="text-center p-10">Knowledge graph data not available.</p>}
                            </div>
                        </div>

                    </main>
                )}
            </div>
        </div>
    );
};