import { Search, X } from "lucide-react";
import type React from "react";

interface TransactionSearchProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
}

const TransactionSearch: React.FC<TransactionSearchProps> = ({ value, onChange, onClear }) => (
  <div className="relative flex items-center bg-canvas-50 p-1.5 rounded-2xl border border-canvas-200 shadow-sm">
    <Search className="w-3.5 h-3.5 text-canvas-500 ml-2 select-none" />
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onClear();
        }
      }}
      placeholder="Search transactions..."
      className="w-56 md:w-64 bg-transparent text-sm text-canvas-700 placeholder:text-canvas-500 focus:outline-none px-2"
    />
    {value && (
      <button
        type="button"
        onClick={onClear}
        className="p-1 text-canvas-400 hover:text-canvas-700 transition-colors select-none"
        title="Clear search"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    )}
  </div>
);

export default TransactionSearch;
