import React, { useRef, useState } from 'react';
import { Upload } from 'lucide-react';

interface FileDropZoneProps {
  busy?: boolean;
  error?: string | null;
  onFileSelected: (file: File) => void;
}

const FileDropZone: React.FC<FileDropZoneProps> = ({ busy, error, onFileSelected }) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    onFileSelected(file);
  };

  return (
    <div className="animate-snap-in">
      <div
        className={
          `relative group cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-200 ease-out\n` +
          `flex flex-col items-center justify-center h-96\n` +
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
          onChange={(e) => handleFiles(e.target.files)}
        />

        <div className="p-6 bg-obsidian-800 rounded-full mb-6 shadow-glass group-hover:scale-110 transition-transform">
          <Upload className="w-8 h-8 text-brand" />
        </div>

        <h3 className="text-xl font-bold text-white mb-2">Drop your bank export here</h3>
        <p className="text-obsidian-400">or click to browse</p>

        {busy && (
          <div className="mt-6 text-sm font-mono text-obsidian-400 bg-obsidian-800/60 border border-obsidian-700 rounded-lg px-3 py-2">
            Parsing file...
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
