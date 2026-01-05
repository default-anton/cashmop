import React, { RefObject } from 'react';
import { Wand2, X, MousePointer2, Calendar, FileText, DollarSign } from 'lucide-react';


interface SelectionRule {
  text: string;
  mode: 'contains' | 'starts_with' | 'ends_with';
  startIndex?: number;
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
  amountInputRef: React.RefObject<HTMLInputElement | null>;
  currentAmount?: number;
  matchingTransactions?: any[];
  mainCurrency: string;
  showOriginalCurrency: boolean;
}

export const RuleEditor: React.FC<RuleEditorProps> = ({
  selectionRule,
  onClearRule,
  amountFilter,
  setAmountFilter,
  amountInputRef,
  currentAmount,
  matchingTransactions = [],
  mainCurrency,
  showOriginalCurrency,
}) => {
  return (
    <div className={`mb-4 relative w-full transition-all duration-300 ${selectionRule ? 'min-h-[220px]' : 'h-44'}`}>
      {selectionRule ? (
        <div className="w-full h-full animate-snap-in">
          <div className="bg-brand/5 border-2 border-brand/20 rounded-2xl p-4 flex flex-col justify-center gap-4 text-brand shadow-lg backdrop-blur-sm h-full select-none">
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
                    className="w-28 px-3 py-1.5 text-sm border border-brand/20 rounded-lg focus:border-brand focus:ring-1 focus:ring-brand outline-none"
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
                        className="w-28 px-3 py-1.5 text-sm border border-brand/20 rounded-lg focus:border-brand focus:ring-1 focus:ring-brand outline-none"
                      />
                    </>
                  )}
                </div>
              )}
            </div>
            {matchingTransactions.length > 0 && (
              <div className="mt-2 animate-snap-in">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black text-canvas-400 uppercase tracking-[0.2em]">
                    {matchingTransactions.length} Matching Transaction{matchingTransactions.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="bg-white/50 rounded-xl border border-brand/10 overflow-hidden">
                  <div className="max-h-32 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-canvas-100/80 backdrop-blur-sm shadow-sm">
                        <tr>
                          <th className="px-3 py-1.5 text-[9px] font-black text-canvas-500 uppercase tracking-widest">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-2.5 h-2.5 opacity-70" />
                              <span>Date</span>
                            </div>
                          </th>
                          <th className="px-3 py-1.5 text-[9px] font-black text-canvas-500 uppercase tracking-widest">
                            <div className="flex items-center gap-1">
                              <FileText className="w-2.5 h-2.5 opacity-70" />
                              <span>Description</span>
                            </div>
                          </th>
                          <th className="px-3 py-1.5 text-[9px] font-black text-canvas-500 uppercase tracking-widest text-right">
                            <div className="flex items-center gap-1 justify-end">
                              <DollarSign className="w-2.5 h-2.5 opacity-70" />
                              <span>Amount ({mainCurrency})</span>
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-canvas-200/30">
                        {matchingTransactions.map((tx) => (
                          <tr key={tx.id} className="hover:bg-brand/5 transition-colors group">
                            <td className="px-3 py-1.5 text-[10px] font-medium text-canvas-500 whitespace-nowrap">
                              {new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </td>
                            <td className="px-3 py-1.5 text-[11px] font-bold text-canvas-700 truncate max-w-[200px]">
                              {tx.description}
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              <div className="flex flex-col items-end">
                                <span className={`text-[10px] font-black ${tx.main_amount === null ? 'text-canvas-400' : tx.main_amount < 0 ? 'text-finance-expense' : 'text-finance-income'}`}>
                                  {tx.main_amount === null
                                    ? '—'
                                    : new Intl.NumberFormat('en-CA', { style: 'currency', currency: mainCurrency }).format(Math.abs(tx.main_amount))}
                                </span>
                                {showOriginalCurrency && (
                                  <span className={`text-[9px] ${tx.amount < 0 ? 'text-finance-expense/70' : 'text-finance-income/70'}`}>
                                    {(tx.currency || mainCurrency).toUpperCase()} {Math.abs(tx.amount).toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="w-full h-full border-2 border-dashed border-canvas-300 rounded-2xl flex flex-col items-center justify-center text-canvas-500 bg-canvas-200/20 gap-3 group transition-colors hover:border-brand/30 hover:bg-brand/[0.02] select-none">
          <div className="relative">
            <div className="bg-canvas-100 p-3 rounded-full group-hover:bg-brand/10 transition-colors">
              <MousePointer2 className="w-6 h-6 opacity-40 group-hover:text-brand group-hover:opacity-100 transition-all duration-300" />
            </div>
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-brand opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-2 group-hover:translate-y-0">
              <span className="text-[20px] leading-none">↑</span>
            </div>
          </div>
          <div className="text-center px-10">
            <span className="text-sm font-bold block mb-1 text-canvas-700">Automation Rule Wizard</span>
            <span className="text-xs font-medium text-canvas-500">
              Select text in the description above to automatically match future transactions.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
