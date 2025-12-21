import React, { RefObject } from 'react';
import { Wand2, X, MousePointer2 } from 'lucide-react';


interface SelectionRule {
  text: string;
  mode: 'contains' | 'starts_with' | 'ends_with';
}

interface AmountFilter {
  operator: 'none' | 'gt' | 'lt' | 'between';
  value1: string;
  value2: string;
}

interface RuleEditorProps {
  selectionRule: SelectionRule | null;
  onClearRule: () => void;
  amountFilter: AmountFilter;
  setAmountFilter: (filter: AmountFilter) => void;
  amountInputRef: RefObject<HTMLInputElement>;
  currentAmount?: number;
}

export const RuleEditor: React.FC<RuleEditorProps> = ({
  selectionRule,
  onClearRule,
  amountFilter,
  setAmountFilter,
  amountInputRef,
  currentAmount,
}) => {
  return (
    <div className="h-44 mb-4 relative w-full transition-all duration-300">
      {selectionRule ? (
        <div className="w-full h-full animate-snap-in">
          <div className="bg-brand/5 border-2 border-brand/20 rounded-2xl p-4 flex flex-col justify-center gap-4 text-brand shadow-lg backdrop-blur-sm h-full">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-4">
                <div className="bg-brand text-white p-2 rounded-lg shadow-brand-glow">
                  <Wand2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-brand/10 px-2 py-0.5 rounded">
                      Auto-Rule
                    </span>
                    <span className="text-sm font-bold text-canvas-800">
                      Matching descriptions {
                        selectionRule.mode === 'starts_with' ? 'starting with' :
                          selectionRule.mode === 'ends_with' ? 'ending with' :
                            'containing'
                      }{' '}
                      <span className="text-brand underline underline-offset-4 decoration-2">
                        "{selectionRule.text}"
                      </span>
                    </span>
                  </div>
                  <p className="text-xs text-canvas-500 mt-0.5">
                    Enter a category name below to save this rule.
                  </p>
                </div>
              </div>
              <button
                onClick={onClearRule}
                className="p-2 hover:bg-brand/10 text-canvas-500 hover:text-brand rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="h-px bg-brand/10 w-full" />

            <div className="flex items-center gap-2 w-full">
              <span className="text-xs font-bold text-canvas-500 uppercase tracking-widest mr-2">
                Amount:
              </span>

              <div className="flex bg-white rounded-lg p-1 border border-brand/20">
                {(['none', 'gt', 'lt', 'between'] as const).map((op) => (
                  <button
                    key={op}
                    onClick={() => {
                      const absAmount = currentAmount ? Math.abs(currentAmount) : 0;
                      const amountStr = absAmount > 0 ? absAmount.toString() : '';
                      setAmountFilter({
                        operator: op,
                        value1: op !== 'none' ? amountStr : '',
                        value2: op === 'between' ? amountStr : '',
                      });
                      if (op !== 'none') {
                        setTimeout(() => amountInputRef.current?.focus(), 0);
                      }
                    }}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${amountFilter.operator === op
                      ? 'bg-brand text-white shadow-sm'
                      : 'text-canvas-500 hover:text-brand hover:bg-brand/5'
                      }`}
                  >
                    {op === 'none' && 'Any'}
                    {op === 'gt' && '≥ More'}
                    {op === 'lt' && '≤ Less'}
                    {op === 'between' && 'Between'}
                  </button>
                ))}
              </div>

              {amountFilter.operator !== 'none' && (
                <div className="flex items-center gap-2 animate-snap-in">
                  <input
                    ref={amountInputRef}
                    type="number"
                    placeholder={amountFilter.operator === 'between' ? 'Min' : 'Value'}
                    value={amountFilter.value1}
                    onChange={(e) => setAmountFilter({ ...amountFilter, value1: e.target.value })}
                    className="w-20 px-2 py-1 text-sm border border-brand/20 rounded-lg focus:border-brand focus:ring-1 focus:ring-brand outline-none"
                  />
                  {amountFilter.operator === 'between' && (
                    <>
                      <span className="text-xs text-canvas-500 font-bold">AND</span>
                      <input
                        type="number"
                        placeholder="Max"
                        value={amountFilter.value2}
                        onChange={(e) =>
                          setAmountFilter({ ...amountFilter, value2: e.target.value })
                        }
                        className="w-20 px-2 py-1 text-sm border border-brand/20 rounded-lg focus:border-brand focus:ring-1 focus:ring-brand outline-none"
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full h-full border-2 border-dashed border-canvas-300 rounded-2xl flex flex-col items-center justify-center text-canvas-500 bg-canvas-200/20 gap-2">
          <MousePointer2 className="w-5 h-5 opacity-40" />
          <span className="text-sm font-medium">Select text in the transaction card to create a rule</span>
        </div>
      )}
    </div>
  );
};
