
import React, { useState } from 'react';
import { Paper } from '../types';
import { CheckSquare, Square, ChevronDown, ChevronUp } from './Icons';

interface PaperCardProps {
    paper: Paper;
    isSelected: boolean;
    onToggleSelect: (id: string) => void;
}

export const PaperCard: React.FC<PaperCardProps> = ({ paper, isSelected, onToggleSelect }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="bg-dark-surface border-2 border-dark-border rounded-lg transition-all duration-300 hover:border-neon-cyan shadow-sm hover:shadow-lg mb-4">
            <header 
                className="p-4 flex justify-between items-center cursor-pointer" 
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex-1 pr-4">
                    <h3 className="text-lg font-bold text-electric-blue">{paper.title}</h3>
                    <p className="text-medium-text text-sm mt-1">{paper.authors.join(', ')} ({paper.year})</p>
                    <p className="text-xs text-neon-magenta mt-2">Citations: {paper.citationCount}</p>
                </div>
                <div className="flex items-center space-x-4">
                     <button 
                        onClick={(e) => {
                            e.stopPropagation(); // prevent collapsing when selecting
                            onToggleSelect(paper.id);
                        }} 
                        className="flex-shrink-0 p-2"
                     >
                        {isSelected ? <CheckSquare className="w-6 h-6 text-neon-cyan" /> : <Square className="w-6 h-6 text-medium-text" />}
                    </button>
                    <div className="text-medium-text">
                        {isExpanded ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
                    </div>
                </div>
            </header>

            {isExpanded && (
                <div className="px-4 pb-4 border-t border-dark-border">
                    <div className="mt-4 text-sm text-light-text bg-black/20 p-3 rounded-md">
                        <p><strong className="text-neon-lime">TL;DR:</strong> {paper.tldr}</p>
                    </div>
                    <div className="mt-4">
                        <h4 className="font-semibold text-light-text mb-2">Abstract</h4>
                        <p className="text-sm text-medium-text leading-relaxed">{paper.abstract}</p>
                    </div>
                </div>
            )}
        </div>
    );
};
