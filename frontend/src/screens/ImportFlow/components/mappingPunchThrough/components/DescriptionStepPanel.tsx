import React from 'react';

import type { MappingPunchThroughModel } from '../useMappingPunchThroughModel';

export const DescriptionStepPanel: React.FC<{ model: MappingPunchThroughModel }> = ({ model }) => {
  return (
    <div className="mt-6 min-h-[44px] flex flex-wrap gap-2 items-center border-t border-canvas-100 pt-4">
      {model.mapping.csv.description.length === 0 ? (
        <span className="text-xs text-canvas-400 italic select-none">No columns selected yet...</span>
      ) : (
        model.mapping.csv.description.map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => model.removeHeaderEverywhere(h)}
            className="px-2 py-1 rounded-lg bg-brand/10 text-brand border border-brand/20 text-xs font-semibold animate-in zoom-in-95 duration-200"
          >
            {h}
          </button>
        ))
      )}
    </div>
  );
};
