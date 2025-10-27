import React, { useRef, useState } from 'react';
import { Paper, SinglePaperAnalysisResult } from '../types';
import { ArrowLeft, Download } from './Icons';

declare var html2canvas: any;
declare var jspdf: any;

interface SinglePaperAnalysisDashboardProps {
    paper: Paper;
    analysisResult: SinglePaperAnalysisResult | null;
    isLoading: boolean;
    onBack: () => void;
    error: string | null;
}

const AnalysisSection: React.FC<{ title: string; content?: string }> = ({ title, content }) => (
    <div className="bg-dark-surface p-6 rounded-lg border-2 border-dark-border">
        <h3 className="text-2xl font-bold text-neon-magenta mb-4">{title}</h3>
        <p className="text-light-text whitespace-pre-wrap leading-relaxed">{content || "No data available."}</p>
    </div>
);

export const SinglePaperAnalysisDashboard: React.FC<SinglePaperAnalysisDashboardProps> = ({ paper, analysisResult, isLoading, onBack, error }) => {
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
            pdf.save(`nexus-scholar-analysis-${paper.title.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 20)}.pdf`);
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
            <div ref={dashboardRef}>
                <header className="flex justify-between items-center mb-8">
                    <button onClick={onBack} className="flex items-center gap-2 text-neon-cyan hover:underline">
                        <ArrowLeft className="w-5 h-5" />
                        Back
                    </button>
                    <h1 className="text-3xl md:text-4xl font-bold text-electric-blue font-orbitron tracking-wider text-center">
                        Detailed Analysis
                    </h1>
                     <button onClick={handleExportPdf} disabled={isExporting} className="flex items-center gap-2 bg-neon-cyan text-dark-bg font-bold py-2 px-4 rounded-lg hover:bg-opacity-80 hover:shadow-neon-cyan transition-all disabled:opacity-50">
                        <Download className="w-5 h-5"/>
                        {isExporting ? 'Exporting...' : 'Export'}
                    </button>
                </header>

                {isLoading && (
                    <div className="text-center py-20">
                        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-neon-magenta mx-auto"></div>
                        <p className="mt-6 text-xl text-medium-text">Generating deep analysis... this may take a moment.</p>
                    </div>
                )}

                {error && <p className="text-center text-red-400 text-lg bg-red-900/50 p-4 rounded-lg">{error}</p>}

                {!isLoading && !error && analysisResult && (
                    <main className="space-y-8">
                        <div className="bg-dark-surface p-6 rounded-lg border-2 border-dark-border">
                            <h2 className="text-2xl font-bold text-neon-cyan mb-2">{paper.title}</h2>
                            <p className="text-medium-text">{paper.authors.join(', ')} ({paper.year})</p>
                        </div>

                        <AnalysisSection title="Summary" content={analysisResult.summary} />
                        <AnalysisSection title="Key Concepts" content={analysisResult.keyConcepts} />
                        <AnalysisSection title="Methodology" content={analysisResult.methodology} />
                        <AnalysisSection title="Contributions" content={analysisResult.contributions} />
                        <AnalysisSection title="Future Work & Directions" content={analysisResult.futureWork} />
                    </main>
                )}
            </div>
        </div>
    );
};