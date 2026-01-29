import React from 'react';
import { Check } from 'lucide-react';

import { Input } from '../../../../../components';

export const RememberMapping: React.FC<{
  rememberMapping: boolean;
  setRememberMapping: React.Dispatch<React.SetStateAction<boolean>>;
  detectedMappingName?: string;
  mappingName: string;
  setMappingName: React.Dispatch<React.SetStateAction<string>>;
  saveError: string | null;
}> = ({
  rememberMapping,
  setRememberMapping,
  detectedMappingName,
  mappingName,
  setMappingName,
  saveError,
}) => {
  return (
    <div
      className="mt-4 grid gap-3 rounded-xl border border-canvas-200 bg-canvas-50 px-4 py-3"
      data-testid="remember-mapping"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold text-canvas-500 uppercase tracking-widest select-none">Remember</div>
          <div className="text-sm text-canvas-700 select-none">
            {detectedMappingName ? 'Update this mapping for next time' : 'Save this mapping for next time'}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setRememberMapping((prev) => !prev)}
          className="inline-flex items-center gap-2 rounded-xl px-2 py-1 hover:bg-canvas-100 transition-colors"
          role="checkbox"
          aria-checked={rememberMapping}
        >
          <span className="text-sm font-semibold text-canvas-700 select-none">{rememberMapping ? 'On' : 'Off'}</span>
          <div
            className={
              `w-5 h-5 rounded-lg flex items-center justify-center border-2 transition-all ` +
              (rememberMapping ? 'bg-brand border-brand text-white' : 'border-canvas-200 bg-white')
            }
          >
            {rememberMapping && <Check className="w-3 h-3" strokeWidth={4} />}
          </div>
        </button>
      </div>

      {rememberMapping && (
        <div className="max-w-sm">
          <div className="text-[10px] font-bold text-canvas-500 uppercase tracking-wider mb-1 select-none">Mapping name</div>
          <Input value={mappingName} onChange={(e) => setMappingName(e.target.value)} placeholder="e.g. RBC Checking" />
        </div>
      )}

      {saveError && (
        <div className="text-xs text-finance-expense" data-testid="remember-mapping-error">
          {saveError}
        </div>
      )}
    </div>
  );
};
