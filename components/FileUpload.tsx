
import React, { useCallback, useState } from 'react';
import { UploadCloudIcon, FileText, XIcon } from './Icons';

interface FileUploadProps {
    onFilesUpload: (files: File[]) => void;
    isProcessing: boolean;
    error: string | null;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFilesUpload, isProcessing, error }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [files, setFiles] = useState<File[]>([]);

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const addFiles = (newFiles: FileList) => {
        const pdfFiles = Array.from(newFiles).filter(file => file.type === 'application/pdf');
        if (pdfFiles.length !== newFiles.length) {
            alert('Only PDF files are accepted.');
        }
        setFiles(prev => [...prev, ...pdfFiles]);
    };

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            addFiles(e.dataTransfer.files);
            e.dataTransfer.clearData();
        }
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            addFiles(e.target.files);
            e.target.value = ''; // Reset input to allow re-uploading the same file
        }
    };
    
    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleProcessFiles = () => {
        if (files.length > 0) {
            onFilesUpload(files);
        }
    };

    return (
        <div className="w-full max-w-3xl mx-auto flex flex-col items-center">
            <div
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={`relative w-full border-4 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${isDragging ? 'border-neon-magenta bg-dark-surface' : 'border-dark-border'}`}
            >
                <input
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={isProcessing}
                />
                <div className="flex flex-col items-center justify-center pointer-events-none">
                    <UploadCloudIcon className="w-16 h-16 text-medium-text mb-4" />
                    <p className="text-xl text-light-text">
                        <span className="font-semibold text-neon-magenta">Click to upload</span> or drag and drop PDFs
                    </p>
                    <p className="text-md text-medium-text mt-2">Analyze local or unpublished papers</p>
                </div>
            </div>

            {error && <p className="w-full text-center text-red-400 bg-red-900/30 p-3 rounded-md mt-6">{error}</p>}

            {files.length > 0 && (
                <div className="w-full mt-8">
                    <h3 className="text-lg font-semibold text-neon-cyan mb-3">File Queue:</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                        {files.map((file, index) => (
                            <div key={index} className="bg-dark-surface p-3 rounded-md flex items-center justify-between animate-fade-in">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <FileText className="w-5 h-5 text-electric-blue flex-shrink-0" />
                                    <span className="text-light-text truncate">{file.name}</span>
                                </div>
                                <button onClick={() => removeFile(index)} disabled={isProcessing}>
                                    <XIcon className="w-5 h-5 text-medium-text hover:text-red-500" />
                                </button>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={handleProcessFiles}
                        disabled={isProcessing || files.length === 0}
                        className="w-full mt-6 bg-neon-magenta text-white font-bold py-3 px-6 rounded-lg hover:bg-opacity-80 hover:shadow-neon-magenta transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isProcessing ? 'Analyzing...' : `Analyze ${files.length} Paper(s)`}
                    </button>
                </div>
            )}
        </div>
    );
};