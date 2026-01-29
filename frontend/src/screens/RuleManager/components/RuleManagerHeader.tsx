import { Plus, Search, Wand2, X } from "lucide-react";
import type React from "react";
import { Button } from "../../../components";

interface RuleManagerHeaderProps {
  ruleSearch: string;
  onRuleSearchChange: (value: string) => void;
  onClearSearch: () => void;
  onCreate: () => void;
}

const RuleManagerHeader: React.FC<RuleManagerHeaderProps> = ({
  ruleSearch,
  onRuleSearchChange,
  onClearSearch,
  onCreate,
}) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-4">
      <div className="p-3 bg-brand/10 text-brand rounded-2xl shadow-brand/5 shadow-inner">
        <Wand2 className="w-8 h-8" />
      </div>
      <div>
        <h1 className="text-3xl font-black text-canvas-800 select-none">Rules</h1>
        <p className="text-canvas-500 font-medium select-none">
          Manage categorization rules and keep your automation tidy
        </p>
      </div>
    </div>
    <div className="flex items-center gap-3">
      <div className="relative flex items-center bg-canvas-50 p-1.5 rounded-2xl border border-canvas-200 shadow-sm">
        <Search className="w-3.5 h-3.5 text-canvas-500 ml-2 select-none" />
        <input
          value={ruleSearch}
          onChange={(event) => onRuleSearchChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              onClearSearch();
            }
          }}
          placeholder="Search rules..."
          className="w-56 md:w-64 bg-transparent text-sm text-canvas-700 placeholder:text-canvas-500 focus:outline-none px-2"
        />
        {ruleSearch && (
          <button
            type="button"
            onClick={onClearSearch}
            className="p-1 text-canvas-400 hover:text-canvas-700 transition-colors select-none"
            title="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <Button onClick={onCreate}>
        <Plus className="w-4 h-4" />
        New Rule
      </Button>
    </div>
  </div>
);

export default RuleManagerHeader;
