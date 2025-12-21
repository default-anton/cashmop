import React, { useRef, useState } from 'react';
import { Upload, X, FileText } from 'lucide-react';
import { Button } from '../../../components';

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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);

    if (!multiple) {
      const singleFile = fileArray[0];
      setSelectedFiles([singleFile]);
      onFileSelected?.(singleFile);
      onFilesSelected?.([singleFile]);
      return;
    }

    setSelectedFiles((prev) => {
      const newFiles = fileArray.filter((f) => !prev.some((p) => p.name === f.name && p.size === f.size));
      const combined = [...prev, ...newFiles];
      onFilesSelected?.(combined);
      if (combined.length === 1) onFileSelected?.(combined[0]);
      return combined;
    });
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
          `flex flex-col items-center justify-center ${selectedFiles.length > 0 ? 'h-auto py-8' : 'h-80'}\n` +
          'border-canvas-300 bg-canvas-50 hover:border-canvas-600 hover:bg-canvas-200'
        }
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
            <div className="p-6 bg-canvas-200 rounded-full mb-6 shadow-glass group-hover:scale-110 transition-transform">
              <Upload className="w-8 h-8 text-brand" />
            </div>

            <h3 className="text-xl font-bold text-canvas-800 mb-2">
              {multiple ? 'Choose your bank exports' : 'Choose your bank export'}
            </h3>
            <p className="text-canvas-500 text-sm">CSV or Excel (.xlsx)</p>
          </>
        ) : (
          <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-canvas-200 rounded-full">
                  <FileText className="w-6 h-6 text-brand" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-canvas-800">
                    {selectedFiles.length} file{selectedFiles.length === 1 ? '' : 's'} selected
                  </h3>
                  <p className="text-sm text-canvas-500">{multiple ? 'Add more files or continue' : 'Replace file'}</p>
                </div>
              </div>
              <Button
                onClick={clearAll}
                variant="secondary"
                size="sm"
                disabled={selectedFiles.length === 0}
              >
                Clear All
              </Button>
            </div>

            <div className="space-y-3">
              {selectedFiles.map((file, idx) => (
                <div
                  key={`${file.name}-${file.size}`}
                  className="flex items-center justify-between p-4 bg-canvas-200/50 border border-canvas-300 rounded-xl hover:border-canvas-500 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-canvas-300 rounded-lg">
                      <FileText className="w-5 h-5 text-canvas-600" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium text-canvas-800">{file.name}</span>
                      <span className="text-xs text-canvas-500 font-mono">{(file.size / 1024).toFixed(1)} KB</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono px-2 py-1 rounded bg-canvas-300 border border-canvas-400 text-canvas-600">
                      {file.name.endsWith('.csv') ? 'CSV' : 'Excel'}
                    </span>
                    <Button
                      onClick={() => removeFile(idx)}
                      variant="ghost"
                      size="sm"
                      className="p-1.5"
                      aria-label={`Remove ${file.name}`}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {multiple && (
              <div className="mt-6 text-center">
                <Button onClick={() => inputRef.current?.click()} variant="secondary" size="sm">
                  Add More Files
                </Button>
              </div>
            )}
          </div>
        )}

        {busy && (
          <div className="mt-6 text-sm font-mono text-canvas-500 bg-canvas-200/60 border border-canvas-300 rounded-lg px-3 py-2">
            Parsing file{selectedFiles.length > 1 ? 's...' : '...'}
          </div>
        )}

        {error && (
          <div className="mt-6 text-sm text-finance-expense bg-finance-expense/10 border border-finance-expense/30 rounded-lg px-3 py-2 max-w-md text-center">
            {error}
          </div>
        )}

        <div className="absolute bottom-8 flex gap-3 text-xs font-mono text-canvas-500">
          <span className="bg-canvas-200 px-2 py-1 rounded border border-canvas-300">.CSV</span>
          <span className="bg-canvas-200 px-2 py-1 rounded border border-canvas-300">.XLSX</span>
        </div>
      </div>

      <p className="mt-4 text-xs text-canvas-500 text-center">Transactions are parsed locally and never leave your device.</p>
    </div>
  );
};

export default FileDropZone;
