import React, { useState } from 'react';
import { Upload } from 'lucide-react';

interface FileDropZoneProps {
  onFileDrop: () => void;
}

const FileDropZone: React.FC<FileDropZoneProps> = ({ onFileDrop }) => {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div
      className={`
        relative group cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-200 ease-out
        flex flex-col items-center justify-center h-96
        ${isDragging 
          ? "border-brand bg-brand/5 scale-[1.01]" 
          : "border-obsidian-700 bg-obsidian-900 hover:border-obsidian-600 hover:bg-obsidian-800"
        }
      `}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); onFileDrop(); }}
      onClick={onFileDrop} // Fallback for click-to-upload
    >
      <div className="p-6 bg-obsidian-800 rounded-full mb-6 shadow-glass group-hover:scale-110 transition-transform">
        <Upload className="w-8 h-8 text-brand" />
      </div>
      
      <h3 className="text-xl font-bold text-white mb-2">Drop your bank CSV here</h3>
      <p className="text-obsidian-400">or click to browse</p>
      
      {/* Supported formats hint */}
      <div className="absolute bottom-8 flex gap-3 text-xs font-mono text-obsidian-500">
        <span className="bg-obsidian-800 px-2 py-1 rounded border border-obsidian-700">.CSV</span>
        <span className="bg-obsidian-800 px-2 py-1 rounded border border-obsidian-700">.XLSX</span>
      </div>
    </div>
  );
};

export default FileDropZone;
