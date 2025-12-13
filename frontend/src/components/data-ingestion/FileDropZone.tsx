import React, { useRef, useState } from 'react';
import { Upload, X, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

interface FileDropZoneProps {
  busy?: boolean;
  error?: string | null;
  multiple?: boolean;
  onFileSelected?: (file: File) => void;
  onFilesSelected?: (files: File[]) => void;
}

const FileDropZone: React.FC<FileDropZoneProps> = ({
  busy,
  error,
  multiple = false,
  onFileSelected,
  onFilesSelected,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    if (!multiple) {
      const singleFile = fileArray[0];
      setSelectedFiles([singleFile]);
      onFileSelected?.(singleFile);
      if (onFilesSelected) onFilesSelected([singleFile]);
    } else {
      // Add new files, avoiding duplicates by name+size
      setSelectedFiles((prev) => {
        const newFiles = fileArray.filter(
          (f) => !prev.some((p) => p.name === f.name && p.size === f.size)
        );
        const combined = [...prev, ...newFiles];
        onFilesSelected?.(combined);
        if (combined.length === 1) onFileSelected?.(combined[0]);
        return combined;
      });
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      onFilesSelected?.(updated);
      if (updated.length === 1) onFileSelected?.(updated[0]);
      return updated;
    });
  };

  const clearAll = () => {
    setSelectedFiles([]);
    onFilesSelected?.([]);
  };

  return (
    <div className="animate-snap-in">
      <div
        className={
          `relative group cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-200 ease-out\n` +
          `flex flex-col items-center justify-center ${selectedFiles.length > 0 ? 'h-auto py-8' : 'h-96'}\n` +
          (isDragging
            ? 'border-brand bg-brand/5 scale-[1.01]'
            : 'border-obsidian-700 bg-obsidian-900 hover:border-obsidian-600 hover:bg-obsidian-800')
        }
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        aria-busy={busy}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".csv,.xlsx,.xls"
          multiple={multiple}
          onChange={(e) => handleFiles(e.target.files)}
        />

        {selectedFiles.length === 0 ? (
          <>
            <div className="p-6 bg-obsidian-800 rounded-full mb-6 shadow-glass group-hover:scale-110 transition-transform">
              <Upload className="w-8 h-8 text-brand" />
            </div>

            <h3 className="text-xl font-bold text-white mb-2">
              {multiple ? 'Drop your bank exports here' : 'Drop your bank export here'}
            </h3>
            <p className="text-obsidian-400">or click to browse</p>
          </>
        ) : (
          <div className="w-full max-w-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-obsidian-800 rounded-full">
                  <FileText className="w-6 h-6 text-brand" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {selectedFiles.length} file{selectedFiles.length === 1 ? '' : 's'} selected
                  </h3>
                  <p className="text-sm text-obsidian-400">
                    {multiple ? 'Add more files or continue' : 'Replace file'}
                  </p>
                </div>
              </div>
              {selectedFiles.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    clearAll();
                  }}
                  className="text-xs font-semibold px-3 py-1.5 rounded-md bg-obsidian-800 border border-obsidian-700 text-obsidian-300 hover:border-obsidian-500 transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="space-y-3">
              {selectedFiles.map((file, idx) => (
                <div
                  key={`${file.name}-${file.size}`}
                  className="flex items-center justify-between p-4 bg-obsidian-800/50 border border-obsidian-700 rounded-xl hover:border-obsidian-600 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-obsidian-900 rounded-lg">
                      <FileText className="w-5 h-5 text-obsidian-300" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium text-white">{file.name}</span>
                      <span className="text-xs text-obsidian-500 font-mono">
                        {(file.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono px-2 py-1 rounded bg-obsidian-900 border border-obsidian-800 text-obsidian-400">
                      {file.name.endsWith('.csv') ? 'CSV' : file.name.endsWith('.xlsx') ? 'Excel' : 'Excel'}
                    </span>
                    <button
                      onClick={() => removeFile(idx)}
                      className="p-1.5 rounded-md bg-obsidian-900 border border-obsidian-800 text-obsidian-400 hover:text-white hover:border-obsidian-600 transition-colors"
                      aria-label={`Remove ${file.name}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {multiple && (
              <div className="mt-6 text-center">
                <button
                  onClick={() => inputRef.current?.click()}
                  className="text-sm font-semibold px-4 py-2 rounded-lg bg-obsidian-800 border border-obsidian-700 text-obsidian-200 hover:border-obsidian-500 transition-colors"
                >
                  Add More Files
                </button>
              </div>
            )}
          </div>
        )}

        {busy && (
          <div className="mt-6 text-sm font-mono text-obsidian-400 bg-obsidian-800/60 border border-obsidian-700 rounded-lg px-3 py-2">
            Parsing file{selectedFiles.length > 1 ? 's...' : '...'}
          </div>
        )}

        {error && (
          <div className="mt-6 text-sm text-finance-expense bg-finance-expense/10 border border-finance-expense/30 rounded-lg px-3 py-2 max-w-md text-center">
            {error}
          </div>
        )}

        {/* Supported formats hint */}
        <div className="absolute bottom-8 flex gap-3 text-xs font-mono text-obsidian-500">
          <span className="bg-obsidian-800 px-2 py-1 rounded border border-obsidian-700">.CSV</span>
          <span className="bg-obsidian-800 px-2 py-1 rounded border border-obsidian-700">.XLSX</span>
        </div>
      </div>

      <p className="mt-4 text-xs text-obsidian-500 text-center">
        CSV parsing runs locally. Excel parsing is mocked for now.
      </p>
    </div>
  );
};

export default FileDropZone;
