import { Wand2 } from "lucide-react";
import type React from "react";

const RuleManagerHeader: React.FC = () => (
  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
    <div className="flex items-start gap-4">
      <div className="rounded-3xl border border-brand/25 bg-gradient-to-br from-brand/20 to-indigo-400/20 p-3.5 text-brand shadow-brand-glow">
        <Wand2 className="h-8 w-8" />
      </div>
      <div>
        <h1 className="text-4xl font-black tracking-tight text-canvas-900 select-none">Rules</h1>
        <p className="mt-1 text-base font-semibold text-canvas-600 select-none">
          Tune auto-categorization with clear, predictable match rules.
        </p>
      </div>
    </div>
  </div>
);

export default RuleManagerHeader;
