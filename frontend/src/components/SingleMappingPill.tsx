import { X } from "lucide-react";
import type React from "react";

interface SingleMappingPillProps {
  value: string;
  placeholder: string;
  onClear?: () => void;
}

const SingleMappingPill: React.FC<SingleMappingPillProps> = ({ value, placeholder, onClear }) => {
  if (!value) {
    return (
      <div className="text-xs text-canvas-600 font-mono bg-canvas-50 px-3 py-1.5 rounded border border-canvas-200">
        {placeholder}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 text-xs font-mono bg-canvas-50 px-3 py-1.5 rounded border border-canvas-200">
      {value}
      {onClear && (
        <button onClick={onClear} className="text-canvas-500 hover:text-brand" aria-label="Clear mapping">
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

export default SingleMappingPill;
