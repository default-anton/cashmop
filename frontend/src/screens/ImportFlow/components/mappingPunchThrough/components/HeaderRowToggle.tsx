import React from 'react';

export const HeaderRowToggle: React.FC<{
  hasHeader: boolean;
  detectedHasHeader: boolean;
  headerSource: 'auto' | 'manual';
  onHeaderChange: (hasHeader: boolean) => void;
}> = ({ hasHeader, detectedHasHeader, headerSource, onHeaderChange }) => {
  return (
    <div
      className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-canvas-200 bg-canvas-50 px-3 py-2"
      data-testid="header-row-toggle"
    >
      <div className="flex flex-col">
        <span className="text-[10px] font-bold text-canvas-500 uppercase tracking-widest select-none">Header row</span>
        <span className="text-xs text-canvas-500 select-none">
          {headerSource === 'auto'
            ? detectedHasHeader
              ? 'Auto-detected: header row'
              : 'Auto-detected: no header row'
            : 'Manual override'}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onHeaderChange(true)}
          className={
            'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ' +
            (hasHeader
              ? 'bg-brand text-white border-brand'
              : 'bg-canvas-50 text-canvas-700 border-canvas-300 hover:border-canvas-600')
          }
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => onHeaderChange(false)}
          className={
            'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ' +
            (!hasHeader
              ? 'bg-brand text-white border-brand'
              : 'bg-canvas-50 text-canvas-700 border-canvas-300 hover:border-canvas-600')
          }
        >
          No
        </button>
      </div>
    </div>
  );
};
