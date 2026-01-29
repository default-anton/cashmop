import type React from "react";

import { AutocompleteInput } from "../../../../../components";
import type { MappingPunchThroughModel } from "../useMappingPunchThroughModel";

export const AccountStepPanel: React.FC<{ model: MappingPunchThroughModel }> = ({ model }) => {
  return (
    <div className="mt-6 grid gap-4 p-4 bg-canvas-100 rounded-xl border border-canvas-200">
      <div>
        <div className="text-[10px] font-bold text-canvas-500 uppercase tracking-wider mb-2 select-none">
          Static account (fast)
        </div>
        <div className="flex items-center gap-2">
          <div className="w-full max-w-sm">
            <AutocompleteInput
              value={model.accountInput}
              onChange={(val) => {
                model.setAccountInput(val);
                model.setMapping((prev) => ({ ...prev, account: val, csv: { ...prev.csv, account: undefined } }));
              }}
              onSubmit={() => {
                if (model.canGoNext) model.handleAdvance();
              }}
              options={model.availableAccounts}
              placeholder="e.g. RBC Checking"
              className="w-full"
            />
          </div>
        </div>
        {model.mapping.csv.account && (
          <div className="mt-2 text-xs text-canvas-500 flex items-center gap-2 select-none">
            Currently mapped from file: <span className="font-mono select-none">{model.mapping.csv.account}</span>
            <button
              type="button"
              onClick={() => model.removeHeaderEverywhere(model.mapping.csv.account || "")}
              className="text-[10px] font-semibold text-brand hover:underline"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-canvas-200 pt-3 text-xs text-canvas-500 select-none">
        Or click a column header to map account per-row.
      </div>
    </div>
  );
};
