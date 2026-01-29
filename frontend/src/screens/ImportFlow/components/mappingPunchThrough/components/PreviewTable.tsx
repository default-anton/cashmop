import type React from "react";

import type { MappingPunchThroughModel } from "../useMappingPunchThroughModel";

export const PreviewTable: React.FC<{ model: MappingPunchThroughModel }> = ({ model }) => {
  return (
    <div
      className={`bg-canvas-50 rounded-2xl border transition-all duration-300 overflow-hidden shadow-sm ${model.hoveredColIdx !== null ? "border-brand/40 ring-1 ring-brand/10" : "border-canvas-200"}`}
    >
      <div className="px-6 py-3 bg-canvas-100 border-b border-canvas-200 flex justify-between items-center">
        <span className="text-xs font-bold text-canvas-500 uppercase tracking-widest select-none">
          File preview (File {model.fileIndex + 1} of {model.fileCount})
        </span>
        <div className="flex items-center gap-2 px-2 py-1 bg-brand/10 border border-brand/20 rounded-lg animate-in fade-in slide-in-from-right-2">
          <div className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
          <span className="text-[10px] text-brand font-bold uppercase tracking-tight select-none">
            Click any column to map {model.currentStep.label}
          </span>
        </div>
      </div>
      <div className="overflow-x-auto" onMouseLeave={() => model.setHoveredColIdx(null)}>
        <table className="w-full border-collapse" data-testid="mapping-table">
          <thead>
            <tr className="bg-canvas-100/50">
              {model.visibleColumns.map(({ header, index }) => {
                const status = model.getColumnStatus(header);
                const label = model.getHeaderLabel(header);

                return (
                  <th
                    key={header || index}
                    onClick={() => model.handleHeaderClick(header)}
                    onMouseEnter={() => model.setHoveredColIdx(index)}
                    className={
                      "px-3 py-3 text-left text-xs font-bold uppercase tracking-wider transition-all duration-200 border-b-2 min-w-[150px] cursor-pointer select-none " +
                      (status === "current"
                        ? "bg-brand/10 border-brand text-brand"
                        : status === "other"
                          ? "bg-canvas-50 border-canvas-300 text-canvas-400 cursor-not-allowed"
                          : "text-canvas-600 border-transparent hover:bg-canvas-100 hover:text-canvas-800")
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{header}</span>
                      {status !== "none" && label && (
                        <span
                          className={
                            "rounded px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap flex-shrink-0 " +
                            (status === "current" ? "bg-brand text-white" : "bg-canvas-200 text-canvas-500")
                          }
                        >
                          as {label}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-canvas-200">
            {model.previewRows.map((row, i) => (
              <tr key={i} className="hover:bg-canvas-100/30 transition-colors">
                {model.visibleColumns.map(({ header, index }, j) => {
                  const status = model.getColumnStatus(header);
                  const isHovered = model.hoveredColIdx === index;

                  const cellClass =
                    status === "current"
                      ? "bg-brand/10 text-brand cursor-pointer"
                      : status === "other"
                        ? "bg-brand/[0.02] text-brand/40 cursor-not-allowed"
                        : isHovered
                          ? "bg-brand/5 text-brand/80 cursor-pointer"
                          : "text-canvas-600 cursor-pointer hover:bg-canvas-200/50";

                  const cell = row[j] ?? "";
                  return (
                    <td
                      key={header || j}
                      onClick={() => model.handleHeaderClick(header)}
                      onMouseEnter={() => model.setHoveredColIdx(index)}
                      className={`px-4 py-3 text-sm whitespace-nowrap transition-colors ${cellClass}`}
                    >
                      {cell}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
