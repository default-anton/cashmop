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
  showRuleBadge?: boolean;
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
  showRuleBadge = true,
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

  if (!selectionRule) {
    return (
      <div className="w-full rounded-3xl border border-canvas-200 bg-canvas-50/85 p-5 shadow-card">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="rounded-full border border-canvas-200 bg-canvas-100 p-3 text-canvas-500">
            <MousePointer2 className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold text-canvas-700 select-none">Automation rule wizard</p>
          <p className="max-w-xl text-sm text-canvas-500 select-none">
            Select text in the description above to match similar transactions automatically.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-3xl border border-brand/20 bg-brand/[0.04] p-4 shadow-card">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-brand p-2 text-white shadow-brand-glow">
              <Wand2 className="h-4 w-4" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {showRuleBadge && (
                  <span className="rounded-md border border-brand/20 bg-brand/10 px-2 py-0.5 text-xs font-bold uppercase tracking-[0.08em] text-brand select-none">
                    Auto-rule
                  </span>
                )}
                <p className="text-sm font-semibold text-canvas-800">
                  Matching descriptions {modeLabel} <span className="font-bold text-brand">“{selectionRule.text}”</span>
                </p>
              </div>
              {showCategoryHint && (
                <p className="mt-1 text-sm text-canvas-500 select-none">
                  Type a category below to save and apply this rule.
                </p>
              )}
            </div>
          </div>

          <button
            onClick={onClearRule}
            className="rounded-lg border border-canvas-200 bg-canvas-50 p-1.5 text-canvas-500 transition-colors hover:border-brand/30 hover:text-brand"
            aria-label="Clear selected rule"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <span className="text-xs font-bold uppercase tracking-[0.08em] text-canvas-500 select-none">
            Amount filter
          </span>

          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-canvas-200 bg-white p-1">
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
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors select-none ${
                  amountFilter.operator === op
                    ? "bg-brand text-white"
                    : "text-canvas-600 hover:bg-canvas-100 hover:text-canvas-900"
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
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={amountInputRef}
                type="number"
                placeholder={amountFilter.operator === "between" ? "Min" : "Value"}
                aria-label={amountFilter.operator === "between" ? "Minimum amount" : "Amount value"}
                value={amountFilter.value1}
                onChange={(e) => setAmountFilter({ ...amountFilter, value1: e.target.value })}
                className="w-28 rounded-lg border border-brand/20 px-3 py-1.5 text-sm text-canvas-700 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
              />

              {amountFilter.operator === "between" && (
                <>
                  <span className="text-xs font-semibold text-canvas-500 select-none">to</span>
                  <input
                    type="number"
                    placeholder="Max"
                    aria-label="Maximum amount"
                    value={amountFilter.value2}
                    onChange={(e) => setAmountFilter({ ...amountFilter, value2: e.target.value })}
                    className="w-28 rounded-lg border border-brand/20 px-3 py-1.5 text-sm text-canvas-700 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                  />
                </>
              )}
            </div>
          )}
        </div>

        {previewVisible && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-canvas-500 select-none">
                {totalMatches} matching transaction{totalMatches !== 1 ? "s" : ""}
              </p>
              {totalMatches > matchingTransactions.length && (
                <p className="text-xs text-canvas-500 select-none">Showing {matchingTransactions.length} most recent</p>
              )}
            </div>

            <div className="overflow-hidden rounded-2xl border border-canvas-200 bg-white/85">
              <div className="custom-scrollbar max-h-36 min-h-[120px] overflow-y-auto">
                {matchingLoading ? (
                  <div className="space-y-2 p-3 animate-pulse">
                    {[0, 1, 2].map((idx) => (
                      <div key={idx} className="h-6 rounded-lg bg-canvas-200/70" />
                    ))}
                  </div>
                ) : matchingTransactions.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-canvas-500 select-none">
                    No matching transactions found.
                  </div>
                ) : (
                  <table className="w-full border-collapse text-left">
                    <thead className="sticky top-0 bg-canvas-100/90 backdrop-blur-sm select-none">
                      <tr>
                        <th className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-canvas-500">
                          Date
                        </th>
                        <th className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-canvas-500">
                          Description
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-[0.08em] text-canvas-500">
                          Amount ({mainCurrency})
                        </th>
                        {showCategoryColumn && (
                          <th className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-canvas-500">
                            Current category
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-canvas-200/50">
                      {matchingTransactions.map((tx) => (
                        <tr key={tx.id} className="transition-colors hover:bg-brand/[0.04]">
                          <td className="whitespace-nowrap px-3 py-2 text-sm text-canvas-600">
                            {new Date(tx.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </td>
                          <td
                            className="max-w-[220px] truncate px-3 py-2 text-sm font-medium text-canvas-700"
                            title={tx.description}
                          >
                            {tx.description}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex flex-col items-end">
                              <span
                                className={`text-sm font-semibold ${tx.main_amount === null ? "text-canvas-500" : tx.main_amount < 0 ? "text-finance-expense" : "text-finance-income"}`}
                              >
                                {formatCents(tx.main_amount, mainCurrency)}
                              </span>
                              {(() => {
                                const txCurrency = (tx.currency || mainCurrency).toUpperCase();
                                const main = mainCurrency.toUpperCase();
                                const showOriginal = txCurrency !== main;
                                return showOriginal ? (
                                  <span
                                    className={`text-xs ${tx.amount < 0 ? "text-finance-expense/70" : "text-finance-income/70"}`}
                                  >
                                    {txCurrency} {formatCentsDecimal(Math.abs(tx.amount))}
                                  </span>
                                ) : null;
                              })()}
                            </div>
                          </td>
                          {showCategoryColumn && (
                            <td className="px-3 py-2 text-sm text-canvas-700">{tx.category_name || "Uncategorized"}</td>
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
  );
};
