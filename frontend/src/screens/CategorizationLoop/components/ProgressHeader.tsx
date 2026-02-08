import { Layers } from "lucide-react";
import type React from "react";

interface ProgressHeaderProps {
  currentIndex: number;
  totalTransactions: number;
  variant?: "full" | "compact";
}

export const ProgressHeader: React.FC<ProgressHeaderProps> = ({
  currentIndex,
  totalTransactions,
  variant = "full",
}) => {
  const safeTotal = Math.max(totalTransactions, 1);
  const current = Math.min(currentIndex + 1, safeTotal);
  const progressPercent = Math.round((current / safeTotal) * 100);

  const progressMeter = (
    <div className="space-y-1.5">
      <div className="h-2 overflow-hidden rounded-full bg-canvas-200/80">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand to-brand-alt transition-[width] duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <p className="text-xs font-semibold text-canvas-500 select-none">{progressPercent}% complete</p>
    </div>
  );

  if (variant === "compact") {
    return (
      <div className="rounded-2xl border border-canvas-200 bg-canvas-50/90 px-4 py-3.5 shadow-sm">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-canvas-500 select-none">Progress</p>
          <p className="text-sm font-semibold text-canvas-800 select-none">
            {current} of {safeTotal}
          </p>
        </div>
        {progressMeter}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="rounded-3xl border border-brand/25 bg-gradient-to-br from-brand/20 to-brand-alt/20 p-3.5 text-brand shadow-brand-glow">
            <Layers className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tight text-canvas-900 select-none">Review Inbox</h1>
            <p className="mt-1 text-base font-semibold text-canvas-600 select-none">
              One transaction at a time. Build clean categories at speed.
            </p>
          </div>
        </div>

        <div className="w-fit rounded-2xl border border-canvas-200 bg-canvas-50/90 px-3.5 py-2 shadow-sm sm:min-w-[132px]">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-canvas-500 select-none">Progress</p>
          <p className="mt-0.5 text-sm font-semibold text-canvas-800 select-none">
            {current} of {safeTotal}
          </p>
        </div>
      </div>

      {progressMeter}
    </div>
  );
};
