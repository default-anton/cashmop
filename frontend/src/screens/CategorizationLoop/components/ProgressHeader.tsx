import { Layers } from "lucide-react";
import type React from "react";

interface ProgressHeaderProps {
  currentIndex: number;
  totalTransactions: number;
}

export const ProgressHeader: React.FC<ProgressHeaderProps> = ({ currentIndex, totalTransactions }) => {
  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-brand/10 text-brand rounded-lg">
          <Layers className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-canvas-800 select-none">Review Inbox</h1>
          <p className="text-xs font-mono text-canvas-500 uppercase tracking-widest">
            {currentIndex + 1} of {totalTransactions} items
          </p>
        </div>
      </div>
    </div>
  );
};
