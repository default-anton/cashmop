import React from 'react';

import { AutocompleteInput } from '../../../../../components';
import type { MappingPunchThroughModel } from '../useMappingPunchThroughModel';

export const OwnerStepPanel: React.FC<{ model: MappingPunchThroughModel }> = ({ model }) => {
  return (
    <div className="mt-6 grid gap-4 p-4 bg-canvas-100 rounded-xl border border-canvas-200">
      <div>
        <div className="text-[10px] font-bold text-canvas-500 uppercase tracking-wider mb-2 select-none">Default owner</div>
        <div className="flex items-center gap-2">
          <div className="w-full max-w-sm">
            <AutocompleteInput
              value={model.ownerInput}
              onChange={(val) => {
                model.setOwnerInput(val);
                model.setMapping((prev) => ({ ...prev, defaultOwner: val, csv: { ...prev.csv, owner: undefined } }));
              }}
              onSubmit={() => {
                if (model.canGoNext) model.handleAdvance();
              }}
              options={model.availableOwners}
              placeholder="e.g. Alex"
              className="w-full"
            />
          </div>
        </div>
        {model.mapping.csv.owner && (
          <div className="mt-2 text-xs text-canvas-500 flex items-center gap-2 select-none">
            Currently mapped from file: <span className="font-mono select-none">{model.mapping.csv.owner}</span>
            <button
              type="button"
              onClick={() => model.removeHeaderEverywhere(model.mapping.csv.owner || '')}
              className="text-[10px] font-semibold text-brand hover:underline"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-canvas-200 pt-3 text-xs text-canvas-500 select-none">Or click a column header to map owner per-row.</div>
    </div>
  );
};
