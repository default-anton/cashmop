import type React from "react";

import { AutocompleteInput } from "../../../../../components";
import type { MappingPunchThroughModel } from "../useMappingPunchThroughModel";

export const OwnerStepPanel: React.FC<{ model: MappingPunchThroughModel }> = ({ model }) => {
  return (
    <div className="mt-6 grid gap-4 p-4 bg-canvas-100 rounded-xl border border-canvas-200">
      <div>
        <div className="text-[10px] font-bold text-canvas-500 uppercase tracking-wider mb-2 select-none">Owner</div>
        <div className="flex items-center gap-2">
          <div className="w-full max-w-sm">
            <AutocompleteInput
              value={model.ownerInput}
              onChange={(val) => {
                model.setOwnerInput(val);
                model.setMapping((prev) => ({ ...prev, owner: val }));
              }}
              onSubmit={() => {
                if (model.canGoNext) model.handleAdvance();
              }}
              options={model.availableOwners}
              placeholder="e.g. Alex"
              aria-label="Owner"
              className="w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
