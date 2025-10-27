import React, { useState, useCallback, useMemo } from 'react';
import { Paper, ComparisonResult, KnowledgeGraphData, SinglePaperAnalysisResult } from './types';
import { searchPapers } from './services/paperService';
import { generateSuggestions, generateComparison, generateKnowledgeGraph, generateSinglePaperAnalysis } from './services/geminiService';
import { SearchIcon, UploadCloudIcon } from './components/Icons';
import { PaperCard } from './components/PaperCard';
import { ComparisonDashboard } from './components/ComparisonDashboard';
import { SinglePaperAnalysisDashboard } from './components/SinglePaperAnalysisDashboard';
import { FileUpload } from './components/FileUpload';

declare var pdfjsLib: any;

type AppMode = 'search' | 'upload';

const extractAbstractFromPdf = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
            if (!event.target?.result) {
                return reject(new Error("Failed to read file."));
            }
            try {
                const pdf = await pdfjsLib.getDocument(event.target.result).promise;
                // Try to get text from the first few pages to increase chances of getting the abstract
                let fullText = '';
                const maxPages = Math.min(3, pdf.numPages);
                for (let i = 1; i <= maxPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map((item: any) => item.str).join(' ');
                    fullText += pageText + '\n\n';
                }

                // A simple heuristic to find something that looks like an abstract.
                const abstractMarker = fullText.toLowerCase().indexOf('abstract');
                let abstract = fullText;
                if (abstractMarker !== -1) {
                    abstract = fullText.substring(abstractMarker + 'abstract'.length).trim();
                }
                
                // Limit the abstract length to avoid overly large prompts.
                resolve(abstract.substring(0, 4000));
            } catch (error) {
                console.error("Error parsing PDF:", error);
                reject(new Error(`Failed to parse ${file.name}. It might be corrupted or password-protected.`));
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
    });
};


const App: React.FC = () => {
    const [mode, setMode] = useState<AppMode>('search');
    
    // Search Mode State
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [searchedTerm, setSearchedTerm] = useState<string>(''); // To hold the term that was actually searched
    const [papers, setPapers] = useState<Paper[]>([]);
    const [selectedPapers, setSelectedPapers] = useState<Set<string>>(new Set());
    const [isSearching, setIsSearching] = useState<boolean>(false);
    const [suggestions, setSuggestions] = useState<string[]>([]);

    // Analysis/Comparison State
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    
    const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
    const [knowledgeGraph, setKnowledgeGraph] = useState<KnowledgeGraphData | null>(null);
    const [singleAnalysisResult, setSingleAnalysisResult] = useState<SinglePaperAnalysisResult | null>(null);

    // View State
    const [view, setView] = useState<'main' | 'comparison' | 'single_analysis'>('main');
    const [currentPaperForAnalysis, setCurrentPaperForAnalysis] = useState<Paper | null>(null);
    const [papersForDashboard, setPapersForDashboard] = useState<Paper[]>([]);


    const handleSearch = useCallback(async (query: string) => {
        if (!query.trim()) return;
        setIsSearching(true);
        setError(null);
        setPapers([]);
        setSuggestions([]);
        setSearchTerm(query);
        setSearchedTerm(query);
        try {
            const results = await searchPapers(query);
            setPapers(results);
            if (results.length > 0) {
                try {
                    const relatedSuggestions = await generateSuggestions(query);
                    setSuggestions(relatedSuggestions);
                } catch (suggestionError) {
                    console.error("Failed to fetch suggestions:", suggestionError);
                    // Non-critical, so we don't show an error to the user
                }
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred. Please try again.';
            setError(errorMessage);
            console.error(err);
        } finally {
            setIsSearching(false);
        }
    }, []);

    const togglePaperSelection = (paperId: string) => {
        setSelectedPapers(prev => {
            const newSelection = new Set(prev);
            if (newSelection.has(paperId)) newSelection.delete(paperId);
            else newSelection.add(paperId);
            return newSelection;
        });
    };
    
    const papersForComparison = useMemo(() => {
        return papers.filter(p => selectedPapers.has(p.id));
    }, [papers, selectedPapers]);

    const handleStartComparison = async () => {
        if (papersForComparison.length < 2) {
            alert('Please select at least two papers to compare.');
            return;
        }
        setIsProcessing(true);
        setError(null);
        setComparisonResult(null);
        setKnowledgeGraph(null);
        setPapersForDashboard(papersForComparison);
        
        try {
            const [comparison, graph] = await Promise.all([
                generateComparison(papersForComparison),
                generateKnowledgeGraph(papersForComparison)
            ]);
            setComparisonResult(comparison);
            setKnowledgeGraph(graph);
            setView('comparison');
        } catch (err) {
            setError('Failed to generate comparison. Please try again.');
            console.error(err);
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleFilesUpload = async (files: File[]) => {
        setIsProcessing(true);
        setError(null);

        try {
            const uploadedPapers: Paper[] = await Promise.all(
                files.map(async (file, index) => {
                    const abstractText = await extractAbstractFromPdf(file);

                    if (!abstractText || abstractText.trim().length < 100) {
                        throw new Error(`Could not extract sufficient text from "${file.name}". The file might be image-based (a scan), password-protected, or have a non-standard text layout. Please use a text-based PDF.`);
                    }

                    return {
                        id: `upload-${Date.now()}-${index}`,
                        title: file.name.replace(/\.pdf$/i, ''),
                        authors: ['Uploaded Paper'],
                        year: new Date().getFullYear(),
                        abstract: abstractText,
                        citationCount: 0,
                        tldr: 'TL;DR to be generated by AI.'
                    };
                })
            );

            if (uploadedPapers.length === 1) {
                const paper = uploadedPapers[0];
                setCurrentPaperForAnalysis(paper);
                const result = await generateSinglePaperAnalysis(paper);
                setSingleAnalysisResult(result);
                setView('single_analysis');
            } else if (uploadedPapers.length > 1) {
                setPapersForDashboard(uploadedPapers);
                const [comparison, graph] = await Promise.all([
                    generateComparison(uploadedPapers),
                    generateKnowledgeGraph(uploadedPapers)
                ]);
                setComparisonResult(comparison);
                setKnowledgeGraph(graph);
                setView('comparison');
            }
        } catch (err: any) {
            const errorMessage = err.message || 'Failed to process uploaded files. Please ensure they are valid PDFs.';
            setError(errorMessage);
            console.error(err);
        } finally {
            setIsProcessing(false);
        }
    };


    const resetViews = () => {
        setView('main');
        setComparisonResult(null);
        setKnowledgeGraph(null);
        setSingleAnalysisResult(null);
        setCurrentPaperForAnalysis(null);
        setSelectedPapers(new Set());
        setPapersForDashboard([]);
    };

    if (view === 'comparison') {
        return (
            <ComparisonDashboard
                papers={papersForDashboard}
                comparisonResult={comparisonResult}
                knowledgeGraphData={knowledgeGraph}
                isLoading={isProcessing}
                onBack={resetViews}
                error={error}
            />
        );
    }
    
    if (view === 'single_analysis' && currentPaperForAnalysis) {
        return (
            <SinglePaperAnalysisDashboard
                paper={currentPaperForAnalysis}
                analysisResult={singleAnalysisResult}
                isLoading={isProcessing}
                onBack={resetViews}
                error={error}
            />
        )
    }

    const renderModeToggle = () => (
        <div className="flex justify-center mb-8">
            <div className="bg-dark-surface p-1 rounded-full flex space-x-2">
                <button
                    onClick={() => setMode('search')}
                    className={`px-6 py-2 rounded-full font-semibold flex items-center gap-2 transition-colors ${mode === 'search' ? 'bg-neon-cyan text-dark-bg' : 'text-medium-text hover:bg-dark-border'}`}
                >
                    <SearchIcon className="w-5 h-5"/>
                    Search Online
                </button>
                <button
                    onClick={() => setMode('upload')}
                    className={`px-6 py-2 rounded-full font-semibold flex items-center gap-2 transition-colors ${mode === 'upload' ? 'bg-neon-cyan text-dark-bg' : 'text-medium-text hover:bg-dark-border'}`}
                >
                    <UploadCloudIcon className="w-5 h-5"/>
                    Upload Files
                </button>
            </div>
        </div>
    );
    
    const renderSearchView = () => (
        <>
            <div className="relative mb-4">
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchTerm)}
                    placeholder="Search by topic, title, or author (e.g., 'transformer architecture' or 'Yann LeCun')"
                    className="w-full pl-12 pr-4 py-3 bg-dark-surface border-2 border-dark-border rounded-full text-light-text placeholder-medium-text focus:outline-none focus:ring-2 focus:ring-neon-cyan focus:border-neon-cyan transition-all duration-300"
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2"><SearchIcon className="w-6 h-6 text-medium-text" /></div>
            </div>
            <button
                onClick={() => handleSearch(searchTerm)}
                disabled={isSearching}
                className="w-full bg-electric-blue text-dark-bg font-bold py-3 px-6 rounded-lg hover:bg-opacity-80 hover:shadow-neon-cyan transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-8"
            >
                {isSearching ? 'Searching...' : 'Search Papers'}
            </button>
            
            {isSearching && (
                <div className="text-center py-10">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neon-cyan mx-auto"></div>
                    <p className="mt-4 text-medium-text">Synthesizing real-time search results from the web...</p>
                    <p className="text-sm text-medium-text/70 mt-2">This advanced search may take a moment.</p>
                </div>
            )}
            
            {!isSearching && papers.length === 0 && searchedTerm && !error && (
                 <div className="text-center py-10">
                    <p className="text-lg text-medium-text">No papers found for "{searchedTerm}".</p>
                    <p className="text-sm text-medium-text mt-2">Try a different search term or check for typos.</p>
                </div>
            )}

            {error && <p className="text-center text-red-400 bg-red-900/30 p-3 rounded-md whitespace-pre-wrap">{error}</p>}

            <div className="flex flex-col">
                {papers.map(paper => (
                    <PaperCard key={paper.id} paper={paper} isSelected={selectedPapers.has(paper.id)} onToggleSelect={togglePaperSelection} />
                ))}
            </div>

            {suggestions.length > 0 && !isSearching && papers.length > 0 && (
                <div className="mt-12">
                    <h3 className="text-xl font-semibold text-neon-magenta mb-4">Related Searches</h3>
                    <div className="flex flex-wrap gap-3">
                        {suggestions.map((s, i) => (
                            <button key={i} onClick={() => handleSearch(s)} className="bg-dark-surface border border-dark-border px-4 py-2 rounded-full text-sm text-electric-blue hover:border-electric-blue hover:bg-electric-blue/10 transition-colors">
                                {s}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </>
    );

    const renderUploadView = () => (
        <FileUpload onFilesUpload={handleFilesUpload} isProcessing={isProcessing} error={error} />
    );

    return (
        <div className="min-h-screen font-sans p-4 sm:p-6 lg:p-8">
            <header className="text-center mb-8">
                <h1 className="text-4xl md:text-5xl font-bold text-electric-blue font-orbitron tracking-wider">
                    Nexus Scholar AI
                </h1>
                <p className="text-medium-text mt-2 text-lg">Your AI-Powered Research Discovery System</p>
            </header>

            <main className="max-w-4xl mx-auto">
                {renderModeToggle()}
                {mode === 'search' ? renderSearchView() : renderUploadView()}
            </main>

            {mode === 'search' && selectedPapers.size > 0 && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-dark-surface/80 backdrop-blur-sm border-t-2 border-neon-magenta shadow-lg">
                    <div className="max-w-7xl mx-auto flex justify-between items-center">
                        <p className="text-lg font-semibold"><span className="text-neon-cyan">{selectedPapers.size}</span> paper(s) selected for comparison</p>
                        <button
                            onClick={handleStartComparison}
                            disabled={selectedPapers.size < 2 || isProcessing}
                            className="bg-neon-magenta text-white font-bold py-2 px-6 rounded-lg hover:bg-opacity-80 hover:shadow-neon-magenta transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isProcessing ? 'Analyzing...' : 'Compare'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;