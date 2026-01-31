import { MousePointer2, Wand2, X } from "lucide-react";
import type React from "react";
import { formatCents, formatCentsDecimal } from "../../../utils/currency";

export interface SelectionRule {
  text: string;
  mode: "contains" | "starts_with" | "ends_with" | "exact";
  startIndex?: number;
}

export interface AmountFilter {
  operator: "none" | "gt" | "lt" | "between";
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
  matchingCount?: number;
  matchingLoading?: boolean;
  amountDefaults?: { min?: number | null; max?: number | null };
  mainCurrency: string;
  showCategoryColumn?: boolean;
  showCategoryHint?: boolean;
}

export const RuleEditor: React.FC<RuleEditorProps> = ({
  selectionRule,
  onClearRule,
  amountFilter,
  setAmountFilter,
  amountInputRef,
  currentAmount,
  matchingTransactions = [],
  matchingCount,
  matchingLoading = false,
  amountDefaults,
  mainCurrency,
  showCategoryColumn = false,
  showCategoryHint = true,
}) => {
  const modeLabel =
    selectionRule?.mode === "starts_with"
      ? "starting with"
      : selectionRule?.mode === "ends_with"
        ? "ending with"
        : selectionRule?.mode === "exact"
          ? "matching exactly"
          : "containing";

  const totalMatches = matchingCount ?? matchingTransactions.length;
  const hasMatchText = (selectionRule?.text || "").trim().length > 0;
  const previewVisible = matchingLoading || hasMatchText || totalMatches > 0;

  const buildDefaultAmountValues = (op: AmountFilter["operator"]) => {
    const currentValue = currentAmount ?? 0;
    const fallback = Math.abs(currentValue / 100) || 0;
    const minValue = amountDefaults?.min ?? currentValue;
    const maxValue = amountDefaults?.max ?? currentValue;
    const minAbs = minValue !== undefined && minValue !== null ? Math.abs(minValue / 100) : fallback;
    const maxAbs = maxValue !== undefined && maxValue !== null ? Math.abs(maxValue / 100) : fallback;

    if (op === "between") {
      return {
        value1: String(Math.min(minAbs, maxAbs) || ""),
        value2: String(Math.max(minAbs, maxAbs) || ""),
      };
    }

    const value = op === "gt" ? Math.min(minAbs, maxAbs) : Math.max(minAbs, maxAbs);
    return { value1: String(value || ""), value2: "" };
  };

  return (
    <div className={`relative w-full transition-all duration-300 ${selectionRule ? "min-h-[220px]" : "h-44"}`}>
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
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-brand/10 px-2 py-0.5 rounded select-none">
                      Auto-Rule
                    </span>
                    <span className="text-sm font-bold text-canvas-800">
                      Matching descriptions {modeLabel}{" "}
                      <span className="text-brand underline underline-offset-4 decoration-2">
                        "{selectionRule.text}"
                      </span>
                    </span>
                  </div>
                  {showCategoryHint && (
                    <p className="text-xs text-canvas-500 mt-0.5 select-none">
                      Enter a category name below to save this rule.
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={onClearRule}
                className="p-2 hover:bg-brand/10 text-canvas-500 hover:text-brand rounded-xl transition-all select-none"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="h-px bg-brand/10 w-full" />

            <div className="flex items-center gap-2 w-full">
              <span className="text-xs font-bold text-canvas-500 uppercase tracking-widest mr-2 select-none">
                Amount:
              </span>

              <div className="flex bg-white rounded-lg p-1 border border-brand/20">
                {(["none", "gt", "lt", "between"] as const).map((op) => (
                  <button
                    key={op}
                    onClick={() => {
                      const defaults = op === "none" ? { value1: "", value2: "" } : buildDefaultAmountValues(op);
                      setAmountFilter({
                        operator: op,
                        value1: defaults.value1,
                        value2: defaults.value2,
                      });
                      if (op !== "none") {
                        setTimeout(() => amountInputRef.current?.focus(), 0);
                      }
                    }}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all select-none ${
                      amountFilter.operator === op
                        ? "bg-brand text-white shadow-sm"
                        : "text-canvas-500 hover:text-brand hover:bg-brand/5"
                    }`}
                  >
                    {op === "none" && "Any"}
                    {op === "gt" && "≥ More"}
                    {op === "lt" && "≤ Less"}
                    {op === "between" && "Between"}
                  </button>
                ))}
              </div>

              {amountFilter.operator !== "none" && (
                <div className="flex items-center gap-2 animate-snap-in">
                  <input
                    ref={amountInputRef}
                    type="number"
                    placeholder={amountFilter.operator === "between" ? "Min" : "Value"}
                    aria-label={amountFilter.operator === "between" ? "Minimum amount" : "Amount value"}
                    value={amountFilter.value1}
                    onChange={(e) => setAmountFilter({ ...amountFilter, value1: e.target.value })}
                    className="w-28 px-3 py-1.5 text-sm border border-brand/20 rounded-lg focus:border-brand focus:ring-1 focus:ring-brand outline-none"
                  />
                  {amountFilter.operator === "between" && (
                    <>
                      <span className="text-xs text-canvas-500 font-bold select-none">AND</span>
                      <input
                        type="number"
                        placeholder="Max"
                        aria-label="Maximum amount"
                        value={amountFilter.value2}
                        onChange={(e) => setAmountFilter({ ...amountFilter, value2: e.target.value })}
                        className="w-28 px-3 py-1.5 text-sm border border-brand/20 rounded-lg focus:border-brand focus:ring-1 focus:ring-brand outline-none"
                      />
                    </>
                  )}
                </div>
              )}
            </div>
            {previewVisible && (
              <div className="mt-2 animate-snap-in">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black text-canvas-400 uppercase tracking-[0.2em] select-none">
                    {totalMatches} Matching Transaction{totalMatches !== 1 ? "s" : ""}
                  </span>
                  {totalMatches > matchingTransactions.length && (
                    <span className="text-[10px] font-semibold text-canvas-400 select-none">
                      Showing {matchingTransactions.length} most recent
                    </span>
                  )}
                </div>
                <div className="bg-white/50 rounded-xl border border-brand/10 overflow-hidden">
                  <div className="max-h-32 min-h-[120px] overflow-y-auto custom-scrollbar">
                    {matchingLoading ? (
                      <div className="p-3 space-y-2 animate-pulse">
                        {[0, 1, 2].map((idx) => (
                          <div key={idx} className="h-6 rounded-lg bg-canvas-200/70" />
                        ))}
                      </div>
                    ) : matchingTransactions.length === 0 ? (
                      <div className="px-4 py-10 text-center text-xs text-canvas-400 select-none">
                        No matching transactions found.
                      </div>
                    ) : (
                      <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-canvas-100/80 backdrop-blur-sm shadow-sm select-none">
                          <tr>
                            <th className="px-3 py-1.5 text-[9px] font-black text-canvas-500 uppercase tracking-widest">
                              Date
                            </th>
                            <th className="px-3 py-1.5 text-[9px] font-black text-canvas-500 uppercase tracking-widest">
                              Description
                            </th>
                            <th className="px-3 py-1.5 text-[9px] font-black text-canvas-500 uppercase tracking-widest text-right">
                              Amount ({mainCurrency})
                            </th>
                            {showCategoryColumn && (
                              <th className="px-3 py-1.5 text-[9px] font-black text-canvas-500 uppercase tracking-widest">
                                Current Category
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-canvas-200/30">
                          {matchingTransactions.map((tx) => (
                            <tr key={tx.id} className="hover:bg-brand/5 transition-colors group">
                              <td className="px-3 py-1.5 text-[10px] font-medium text-canvas-500 whitespace-nowrap">
                                {new Date(tx.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </td>
                              <td className="px-3 py-1.5 text-[11px] font-bold text-canvas-700 truncate max-w-[200px]">
                                {tx.description}
                              </td>
                              <td className="px-3 py-1.5 text-right">
                                <div className="flex flex-col items-end">
                                  <span
                                    className={`text-[10px] font-black ${tx.main_amount === null ? "text-canvas-400" : tx.main_amount < 0 ? "text-finance-expense" : "text-finance-income"}`}
                                  >
                                    {formatCents(tx.main_amount, mainCurrency)}
                                  </span>
                                  {(() => {
                                    const txCurrency = (tx.currency || mainCurrency).toUpperCase();
                                    const main = mainCurrency.toUpperCase();
                                    const showOriginal = txCurrency !== main;
                                    return showOriginal ? (
                                      <span
                                        className={`text-[9px] ${tx.amount < 0 ? "text-finance-expense/70" : "text-finance-income/70"}`}
                                      >
                                        {txCurrency} {formatCentsDecimal(Math.abs(tx.amount))}
                                      </span>
                                    ) : null;
                                  })()}
                                </div>
                              </td>
                              {showCategoryColumn && (
                                <td className="px-3 py-1.5">
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-tight ${tx.category_name ? "bg-brand/5 text-brand border border-brand/10" : "bg-canvas-200 text-canvas-600 border border-canvas-300"}`}
                                  >
                                    {tx.category_name || "Uncategorized"}
                                  </span>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
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
            <span className="text-sm font-bold block mb-1 text-canvas-700 select-none">Automation Rule Wizard</span>
            <span className="text-xs font-medium text-canvas-500 select-none">
              Select text in the description above to automatically match future transactions.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
