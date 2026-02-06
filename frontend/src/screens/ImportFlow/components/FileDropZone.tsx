import { FileText, Upload, X } from "lucide-react";
import type React from "react";
import { useRef, useState } from "react";
import { Button } from "../../../components";

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
  const [isDragging, setIsDragging] = useState(false);
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

    const newFiles = fileArray.filter((f) => !selectedFiles.some((p) => p.name === f.name && p.size === f.size));
    const combined = [...selectedFiles, ...newFiles];
    setSelectedFiles(combined);
    onFilesSelected?.(combined);
    if (combined.length === 1) onFileSelected?.(combined[0]);
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
          `group relative flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed transition-all duration-200 ease-out ` +
          `${selectedFiles.length > 0 ? "h-auto py-8" : "h-[21rem]"} ` +
          `${
            isDragging
              ? "border-brand bg-brand/[0.09] shadow-brand-glow"
              : "border-canvas-300 bg-canvas-50/80 hover:border-brand/45 hover:bg-canvas-100/80 hover:shadow-card"
          }`
        }
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
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
            <div className="mb-6 rounded-full border border-brand/20 bg-brand/10 p-6 text-brand shadow-card transition-transform group-hover:scale-105">
              <Upload className="h-8 w-8" />
            </div>

            <h3 className="text-xl font-black tracking-tight text-canvas-900 select-none">
              {multiple ? "Choose your bank exports" : "Choose your bank export"}
            </h3>
            <p className="mt-2 text-sm text-canvas-600 select-none">CSV or Excel (.xls, .xlsx)</p>
            <p className="mt-6 rounded-full border border-canvas-200 bg-canvas-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-canvas-500 select-none">
              Drop files here or click to browse
            </p>
          </>
        ) : (
          <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-canvas-200 bg-canvas-100 p-2.5 text-brand">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-canvas-900 select-none">
                    {selectedFiles.length} file{selectedFiles.length === 1 ? "" : "s"} selected
                  </h3>
                  <p className="text-xs text-canvas-500 select-none">
                    {multiple ? "Add more files or continue" : "Replace file"}
                  </p>
                </div>
              </div>
              <Button onClick={clearAll} variant="secondary" size="sm" disabled={selectedFiles.length === 0}>
                Clear All
              </Button>
            </div>

            <div className="space-y-2.5">
              {selectedFiles.map((file, idx) => (
                <div
                  key={`${file.name}-${file.size}`}
                  className="flex items-center justify-between rounded-2xl border border-canvas-200 bg-canvas-50/90 px-3.5 py-3 transition-colors duration-200 hover:border-canvas-300 hover:shadow-sm"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="rounded-lg bg-canvas-100 p-2">
                      <FileText className="h-4 w-4 text-canvas-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-canvas-800">{file.name}</p>
                      <p className="text-[11px] font-mono text-canvas-500">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <div className="ml-3 flex items-center gap-2">
                    <span className="rounded-full border border-canvas-200 bg-canvas-100 px-2 py-1 font-mono text-xs text-canvas-600 select-none">
                      {file.name.endsWith(".csv") ? "CSV" : "Excel"}
                    </span>
                    <Button
                      onClick={() => removeFile(idx)}
                      variant="ghost"
                      size="sm"
                      className="p-1.5"
                      aria-label={`Remove ${file.name}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {multiple && (
              <div className="mt-5 text-center">
                <Button onClick={() => inputRef.current?.click()} variant="secondary" size="sm">
                  Add More Files
                </Button>
              </div>
            )}
          </div>
        )}

        {busy && (
          <div className="mt-6 rounded-xl border border-canvas-300 bg-canvas-100/80 px-3 py-2 font-mono text-xs text-canvas-600 select-none">
            Parsing file{selectedFiles.length > 1 ? "s..." : "..."}
          </div>
        )}

        {error && (
          <div className="mt-6 max-w-md rounded-xl border border-finance-expense/30 bg-finance-expense/10 px-3 py-2 text-center text-sm text-finance-expense">
            {error}
          </div>
        )}

        <div className="absolute bottom-7 flex gap-2.5 text-xs font-mono text-canvas-500 select-none">
          <span className="rounded border border-canvas-200 bg-canvas-100 px-2 py-1 select-none">.CSV</span>
          <span className="rounded border border-canvas-200 bg-canvas-100 px-2 py-1 select-none">.XLS</span>
          <span className="rounded border border-canvas-200 bg-canvas-100 px-2 py-1 select-none">.XLSX</span>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-canvas-500 select-none">
        Transactions are parsed locally and never leave your device.
      </p>
    </div>
  );
};

export default FileDropZone;
