import type React from "react";

export const AutoMappingBanner: React.FC<{ detectedMappingName: string }> = ({ detectedMappingName }) => {
  return (
    <div
      className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-canvas-200 bg-canvas-50 px-3 py-2"
      data-testid="auto-mapping-banner"
    >
      <div className="flex flex-col">
        <span className="text-[10px] font-bold text-canvas-500 uppercase tracking-widest select-none">
          Auto mapping
        </span>
        <span className="text-xs text-canvas-500 select-none">
          Using <span className="font-semibold text-canvas-700">{detectedMappingName}</span>. Want to change it? Hit
          Back.
        </span>
      </div>
    </div>
  );
};
