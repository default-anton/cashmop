import React from 'react';

import { AutocompleteInput } from '../../../../../components';
import type { MappingPunchThroughModel } from '../useMappingPunchThroughModel';

export const CurrencyStepPanel: React.FC<{ model: MappingPunchThroughModel }> = ({ model }) => {
  return (
    <div className="mt-6 grid gap-3 p-4 bg-canvas-100 rounded-xl border border-canvas-200">
      <div>
        <div className="text-[10px] font-bold text-canvas-500 uppercase tracking-wider mb-2 select-none">Default currency</div>
        <div className="w-full max-w-sm">
          <AutocompleteInput
            value={model.currencyInput}
            onChange={model.setCurrencyInput}
            onSelect={(value) => {
              model.setMapping((prev) => ({ ...prev, currencyDefault: value }));
              const label = model.currencyOptions.find((option) => option.value === value)?.label || value;
              model.setCurrencyInput(label);
            }}
            options={model.currencyOptions}
            placeholder="Search currency"
          />
        </div>
        {model.mapping.csv.currency && (
          <div className="mt-2 text-xs text-canvas-500 flex items-center gap-2 select-none">
            Currently mapped from file: <span className="font-mono select-none">{model.mapping.csv.currency}</span>
            <button
              type="button"
              onClick={() => model.removeHeaderEverywhere(model.mapping.csv.currency || '')}
              className="text-[10px] font-semibold text-brand hover:underline"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-canvas-200 pt-3 text-xs text-canvas-500 select-none">Or click a column header to map currency per-row.</div>
    </div>
  );
};
