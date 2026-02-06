import { Search, X } from "lucide-react";
import type React from "react";

interface TransactionSearchProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
}

const TransactionSearch: React.FC<TransactionSearchProps> = ({ value, onChange, onClear }) => (
  <div className="relative flex h-11 items-center bg-canvas-50/90 rounded-2xl border border-canvas-200 shadow-sm min-w-[250px] px-2.5">
    <Search className="w-4 h-4 text-canvas-500 ml-1 select-none" />
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onClear();
        }
      }}
      placeholder="Search transactions..."
      className="w-44 md:w-52 bg-transparent text-sm text-canvas-800 placeholder:text-canvas-500 focus:outline-none px-2.5"
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
