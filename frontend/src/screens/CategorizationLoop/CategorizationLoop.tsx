import { AlertTriangle, Layers, RotateCcw, RotateCw } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, ScreenLayout } from "@/components";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useToast } from "@/contexts/ToastContext";
import { parseCents } from "@/utils/currency";
import { database } from "../../../wailsjs/go/models";
import { EventsOn } from "../../../wailsjs/runtime/runtime";
import {
  CategoryInput,
  InboxZero,
  ProgressHeader,
  RuleEditor,
  TransactionCard,
  UndoToast,
  WebSearchResults,
} from "./components";

interface Transaction {
  id: number;
  date: string;
  description: string;
  amount: number;
  currency: string;
  category_id: number | null;
  category_name: string;
  account_id: number;
  account_name: string;
  owner_id: number | null;
  owner_name: string;
  amount_in_main_currency?: number | null;
}

type UndoActionType = "single" | "rule" | "skip" | null;

interface UndoState {
  type: UndoActionType;
  transactionId: number;
  ruleId?: number;
  affectedTransactionIds?: number[];
  categoryName?: string;
  matchValue?: string;
}

interface Category {
  id: number;
  name: string;
}

interface CategorizationLoopProps {
  onFinish?: () => void;
}

const CategorizationLoop: React.FC<CategorizationLoopProps> = ({ onFinish }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTxId, setCurrentTxId] = useState<number | null>(null);
  const [categoryInput, setCategoryInput] = useState("");
  const [suggestions, setSuggestions] = useState<Category[]>([]);
  const [selectionRule, setSelectionRule] = useState<{
    text: string;
    mode: "contains" | "starts_with" | "ends_with";
    startIndex?: number;
  } | null>(null);
  const [debouncedRule, setDebouncedRule] = useState(selectionRule);
  const [amountFilter, setAmountFilter] = useState<{
    operator: "none" | "gt" | "lt" | "between";
    value1: string;
    value2: string;
  }>({ operator: "none", value1: "", value2: "" });
  const [matchingTransactions, setMatchingTransactions] = useState<Transaction[]>([]);
  const [matchingCount, setMatchingCount] = useState(0);
  const [matchingAmountRange, setMatchingAmountRange] = useState<{ min?: number | null; max?: number | null }>({});
  const [skippedIds, setSkippedIds] = useState<Set<number>>(new Set());
  const [hasRules, setHasRules] = useState<boolean | null>(null);

  const [undoStack, setUndoStack] = useState<UndoState[]>([]);
  const [redoStack, setRedoStack] = useState<UndoState[]>([]);
  const [showUndoToast, setShowUndoToast] = useState(false);

  const { showToast } = useToast();
  const { warning, mainCurrency } = useCurrency();
  const [hasMissingRates, setHasMissingRates] = useState(false);

  const [webSearchResults, setWebSearchResults] = useState<Array<{
    title: string;
    url: string;
    snippet: string;
    domain: string;
  }> | null>(null);
  const [webSearchLoading, setWebSearchLoading] = useState(false);
  const [webSearchError, setWebSearchError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);

  const fetchTransactions = useCallback(async () => {
    try {
      const txs = await (window as any).go.main.App.GetUncategorizedTransactions();
      const items: Transaction[] = txs || [];
      setTransactions(items);
      return items;
    } catch (e) {
      console.error("Failed to fetch transactions", e);
      return [];
    }
  }, []);

  const goToNext = useCallback(
    (currentList: Transaction[], currentId: number | null, isSkip: boolean) => {
      if (currentList.length === 0) {
        setCurrentTxId(null);
        return;
      }

      const nextSkipped = new Set(skippedIds);
      if (isSkip && currentId !== null) {
        nextSkipped.add(currentId);
      }

      const currentIdx = currentList.findIndex((t) => t.id === currentId);
      let foundId: number | null = null;

      for (let i = 1; i <= currentList.length; i++) {
        const idx = (currentIdx + i) % currentList.length;
        const t = currentList[idx];
        if (!nextSkipped.has(t.id)) {
          foundId = t.id;
          break;
        }
      }

      if (foundId !== null) {
        setSkippedIds(nextSkipped);
        setCurrentTxId(foundId);
      } else {
        setSkippedIds(new Set());
        const nextIdx = (currentIdx + 1) % currentList.length;
        setCurrentTxId(currentList[nextIdx].id);
      }
    },
    [skippedIds],
  );

  useEffect(() => {
    fetchTransactions().then((items) => {
      if (items.length > 0) {
        setCurrentTxId(items[0].id);
      }
      setLoading(false);
    });

    (window as any).go.main.App.GetCategorizationRulesCount().then((count: number) => {
      setHasRules(count > 0);
    });
  }, []);

  useEffect(() => {
    if (transactions.length === 0) {
      setHasMissingRates(false);
      return;
    }
    const missing = transactions.some((tx) => tx.amount_in_main_currency === null);
    setHasMissingRates(missing);
  }, [transactions]);

  // Reload transactions when FX rates are updated (to get converted amounts)
  useEffect(() => {
    const off = EventsOn("fx-rates-updated", () => {
      fetchTransactions();
    });
    return () => off?.();
  }, [fetchTransactions]);

  useEffect(() => {
    if (currentTxId !== null && !loading) {
      inputRef.current?.focus();
    }
  }, [currentTxId, loading]);

  useEffect(() => {
    if (categoryInput.length <= 1) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    const timeout = setTimeout(() => {
      (window as any).go.main.App.SearchCategories(categoryInput).then((res: Category[] | null) => {
        if (!cancelled) {
          setSuggestions(res || []);
        }
      });
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [categoryInput]);

  const currentTx = transactions.find((t) => t.id === currentTxId);
  const currentIndex = transactions.findIndex((t) => t.id === currentTxId);
  const currentMainAmount = currentTx ? (currentTx.amount_in_main_currency ?? currentTx.amount) : 0;

  useEffect(() => {
    if (!selectionRule) {
      setDebouncedRule(null);
      return;
    }
    const timeout = setTimeout(() => {
      setDebouncedRule(selectionRule);
    }, 250);
    return () => clearTimeout(timeout);
  }, [selectionRule]);

  useEffect(() => {
    if (!debouncedRule) {
      setMatchingTransactions([]);
      setMatchingCount(0);
      setMatchingAmountRange({});
      return;
    }

    const fetchMatching = async () => {
      try {
        let amountMin: number | null = null;
        let amountMax: number | null = null;

        const isExpense = currentMainAmount < 0;

        if (amountFilter.operator !== "none") {
          let v1 = parseCents(parseFloat(amountFilter.value1) || 0);
          let v2 = parseCents(parseFloat(amountFilter.value2) || 0);
          if (amountFilter.operator === "between" && v1 > v2) [v1, v2] = [v2, v1];

          if (isExpense) {
            if (amountFilter.operator === "gt") amountMax = -v1;
            else if (amountFilter.operator === "lt") amountMin = -v1;
            else if (amountFilter.operator === "between") {
              amountMin = -v2;
              amountMax = -v1;
            }
          } else {
            if (amountFilter.operator === "gt") amountMin = v1;
            else if (amountFilter.operator === "lt") amountMax = v1;
            else if (amountFilter.operator === "between") {
              amountMin = v1;
              amountMax = v2;
            }
          }
        }

        const [amountRange, res] = await Promise.all([
          (window as any).go.main.App.GetRuleAmountRange(debouncedRule.text, debouncedRule.mode),
          (window as any).go.main.App.PreviewRuleMatches(debouncedRule.text, debouncedRule.mode, amountMin, amountMax),
        ]);

        setMatchingTransactions(res?.transactions || []);
        setMatchingCount(res?.count || 0);
        setMatchingAmountRange({ min: amountRange?.min ?? null, max: amountRange?.max ?? null });
      } catch (e) {
        console.error("Failed to fetch matching transactions", e);
      }
    };

    fetchMatching();
  }, [debouncedRule, amountFilter, currentMainAmount]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (currentTx) {
          handleWebSearch();
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (undoStack.length > 0) {
          handleUndo();
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        if (redoStack.length > 0) {
          handleRedo();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentTx, undoStack, redoStack]);

  const handleWebSearch = async () => {
    if (!currentTx) return;

    setWebSearchLoading(true);
    setWebSearchError(null);
    setWebSearchResults(null);

    try {
      const results = await (window as any).go.main.App.SearchWeb(currentTx.description);
      setWebSearchResults(results);
    } catch (e) {
      console.error("Web search failed", e);
      setWebSearchError("Web search unavailable. Try again later");
    } finally {
      setWebSearchLoading(false);
    }
  };

  const handleDismissWebSearch = () => {
    setWebSearchResults(null);
    setWebSearchError(null);
  };

  const handleUndo = async () => {
    if (undoStack.length === 0) return;

    const action = undoStack[undoStack.length - 1];

    try {
      let successMessage = "";

      switch (action.type) {
        case "single":
          await (window as any).go.main.App.CategorizeTransaction(action.transactionId, "");
          successMessage = "Undo complete - transaction uncategorized";
          break;
        case "rule": {
          await (window as any).go.main.App.UndoCategorizationRule(
            action.ruleId || 0,
            action.affectedTransactionIds || [],
          );
          const count = (action.affectedTransactionIds || []).length;
          successMessage = `Undo complete - ${count} transaction${count !== 1 ? "s" : ""} reverted, rule removed`;
          break;
        }
        case "skip":
          setSkippedIds((prev) => {
            const next = new Set(prev);
            next.delete(action.transactionId);
            return next;
          });
          successMessage = "Undo complete - transaction back in queue";
          break;
      }

      setUndoStack((prev) => prev.slice(0, -1));
      setRedoStack((prev) => [...prev, action]);

      const updated = await fetchTransactions();
      if (updated.length === 0) {
        setShowUndoToast(false);
        if (onFinish) onFinish();
      } else {
        const undoneTxExists = updated.some((t) => t.id === action.transactionId);
        setCurrentTxId(undoneTxExists ? action.transactionId : updated[0].id);
      }

      setCategoryInput("");
      setSuggestions([]);
      setSelectionRule(null);
      setAmountFilter({ operator: "none", value1: "", value2: "" });
      setWebSearchResults(null);
      setWebSearchError(null);

      setShowUndoToast(true);
      showToast(successMessage, "success", 2000);
    } catch (e) {
      console.error("Undo failed", e);
    }
  };

  const handleRedo = async () => {
    if (redoStack.length === 0) return;

    const action = redoStack[redoStack.length - 1];

    try {
      let successMessage = "";

      switch (action.type) {
        case "single":
          await (window as any).go.main.App.CategorizeTransaction(action.transactionId, action.categoryName || "");
          successMessage = "Redo complete - transaction categorized";
          break;
        case "rule": {
          const rule = new database.CategorizationRule();
          rule.match_type = "contains";
          rule.match_value = action.matchValue || "";
          rule.category_id = 0;
          rule.category_name = action.categoryName || "";

          await (window as any).go.main.App.SaveCategorizationRule(rule);
          successMessage = `Redo complete - rule applied to ${(action.affectedTransactionIds || []).length} transaction${(action.affectedTransactionIds || []).length !== 1 ? "s" : ""}`;
          break;
        }
        case "skip":
          setSkippedIds((prev) => new Set([...prev, action.transactionId]));
          successMessage = "Redo complete - transaction skipped";
          break;
      }

      setRedoStack((prev) => prev.slice(0, -1));
      setUndoStack((prev) => [...prev, action]);

      const updated = await fetchTransactions();
      if (updated.length === 0) {
        setShowUndoToast(false);
        if (onFinish) onFinish();
      } else {
        const currentIdx = updated.findIndex((t) => t.id === action.transactionId);
        if (currentIdx !== -1) {
          goToNext(updated, action.transactionId, false);
        } else {
          setCurrentTxId(updated[0].id);
        }
      }

      setCategoryInput("");
      setSuggestions([]);
      setSelectionRule(null);
      setAmountFilter({ operator: "none", value1: "", value2: "" });
      setWebSearchResults(null);
      setWebSearchError(null);

      setShowUndoToast(true);
      showToast(successMessage, "success", 2000);
    } catch (e) {
      console.error("Redo failed", e);
    }
  };

  const getUndoMessage = useCallback((): string => {
    if (redoStack.length > 0) {
      const action = redoStack[redoStack.length - 1];
      switch (action.type) {
        case "single":
          return `Redo ${action.categoryName || "categorization"}`;
        case "rule": {
          const count = (action.affectedTransactionIds || []).length;
          if (count === 1) {
            return `Redo rule: ${action.matchValue} → ${action.categoryName || "category"}`;
          }
          return `Redo rule: ${action.matchValue} → ${action.categoryName || "category"} (${count} transactions)`;
        }
        case "skip":
          return "Redo skip";
        default:
          return "";
      }
    }

    const action = undoStack.length > 0 ? undoStack[undoStack.length - 1] : null;
    if (!action) return "";

    switch (action.type) {
      case "single":
        return `Undo ${action.categoryName || "categorization"}`;
      case "rule": {
        const count = (action.affectedTransactionIds || []).length;
        if (count === 1) {
          return `Undo rule: ${action.matchValue} → ${action.categoryName || "category"}`;
        }
        return `Undo rule: ${action.matchValue} → ${action.categoryName || "category"} (${count} transactions)`;
      }
      case "skip":
        return "Undo skip";
      default:
        return "";
    }
  }, [undoStack, redoStack]);

  const handleCategorize = async (categoryName: string, categoryId?: number) => {
    if (!currentTxId) return;

    try {
      const oldId = currentTxId;
      if (selectionRule) {
        const rule = new database.CategorizationRule();
        rule.match_type = selectionRule.mode;
        rule.match_value = selectionRule.text;
        rule.category_id = categoryId || 0;
        rule.category_name = categoryName;

        if (amountFilter.operator !== "none") {
          let v1 = parseCents(parseFloat(amountFilter.value1) || 0);
          let v2 = parseCents(parseFloat(amountFilter.value2) || 0);

          if (amountFilter.operator === "between" && v1 > v2) {
            [v1, v2] = [v2, v1];
          }

          const currentTx = transactions.find((t) => t.id === oldId);
          const isExpense = (currentTx ? (currentTx.amount_in_main_currency ?? currentTx.amount) : 0) < 0;

          if (isExpense) {
            if (amountFilter.operator === "gt") {
              rule.amount_max = -v1;
            } else if (amountFilter.operator === "lt") {
              rule.amount_min = -v1;
            } else if (amountFilter.operator === "between") {
              rule.amount_min = -v2;
              rule.amount_max = -v1;
            }
          } else {
            if (amountFilter.operator === "gt") {
              rule.amount_min = v1;
            } else if (amountFilter.operator === "lt") {
              rule.amount_max = v1;
            } else if (amountFilter.operator === "between") {
              rule.amount_min = v1;
              rule.amount_max = v2;
            }
          }
        }

        const ruleResult = await (window as any).go.main.App.SaveCategorizationRule(rule);
        const newAction: UndoState = {
          type: "rule",
          transactionId: oldId,
          ruleId: ruleResult.rule_id,
          affectedTransactionIds: ruleResult.affected_ids,
          categoryName,
          matchValue: selectionRule.text,
        };
        setUndoStack((prev) => [...prev, newAction]);
        setRedoStack([]);
        setShowUndoToast(true);
        setSelectionRule(null);
        setAmountFilter({ operator: "none", value1: "", value2: "" });
        setHasRules(true);
      } else {
        await (window as any).go.main.App.CategorizeTransaction(oldId, categoryName);
        const newAction: UndoState = {
          type: "single",
          transactionId: oldId,
          categoryName,
        };
        setUndoStack((prev) => [...prev, newAction]);
        setRedoStack([]);
        setShowUndoToast(true);
      }

      const updated = await fetchTransactions();
      if (updated.length === 0) {
        if (onFinish) onFinish();
      } else {
        goToNext(updated, oldId, false);
      }

      setCategoryInput("");
      setSuggestions([]);
      setWebSearchResults(null);
      setWebSearchError(null);
    } catch (e) {
      console.error("Failed to (rule-)categorize", e);
    }
  };

  const handleSkip = () => {
    if (currentTxId !== null) {
      const newAction: UndoState = {
        type: "skip",
        transactionId: currentTxId,
      };
      setUndoStack((prev) => [...prev, newAction]);
      setRedoStack([]);
      setShowUndoToast(true);
    }
    goToNext(transactions, currentTxId, true);
    setCategoryInput("");
    setSuggestions([]);
    setSelectionRule(null);
    setAmountFilter({ operator: "none", value1: "", value2: "" });
    setWebSearchResults(null);
    setWebSearchError(null);
  };

  /*
   * Replaced by manual selection from TransactionCard to support custom highlighting
   * without fighting browser selection behavior.
   */
  const handleManualSelection = useCallback(
    (startIndex: number, endIndex: number) => {
      if (!currentTxId) return;
      const tx = transactions.find((t) => t.id === currentTxId);
      if (!tx) return;

      if (startIndex > endIndex) {
        [startIndex, endIndex] = [endIndex, startIndex];
      }

      startIndex = Math.max(0, startIndex);
      endIndex = Math.min(tx.description.length, endIndex);

      const rawText = tx.description.substring(startIndex, endIndex);
      const trimmedText = rawText.trim();

      if (trimmedText.length < 1) {
        if (rawText.length === 0) setSelectionRule(null);
        return;
      }

      const leadingWhitespaceMatch = rawText.match(/^\s*/);
      const leadingLen = leadingWhitespaceMatch ? leadingWhitespaceMatch[0].length : 0;
      const trailingWhitespaceMatch = rawText.match(/\s*$/);
      const trailingLen = trailingWhitespaceMatch ? trailingWhitespaceMatch[0].length : 0;

      const finalStart = startIndex + leadingLen;
      const finalEnd = endIndex - trailingLen;

      const description = tx.description;
      let mode: "contains" | "starts_with" | "ends_with" = "contains";

      if (finalStart === 0 && finalEnd === description.length) {
        mode = "contains";
      } else if (finalStart === 0) {
        mode = "starts_with";
      } else if (finalEnd === description.length) {
        mode = "ends_with";
      } else {
        mode = "contains";
      }

      setSelectionRule({ text: trimmedText, mode, startIndex: finalStart });
    },
    [currentTxId, transactions],
  );

  const handleSelectionMouseUp = useCallback(() => {
    if (selectionRule) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, [selectionRule]);

  if (loading) {
    return (
      <ScreenLayout size="medium" centerContent>
        <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-3xl border border-canvas-200 bg-canvas-50/80 px-8 py-12 shadow-card">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand/25 border-t-brand" />
          <p className="text-sm font-semibold text-canvas-600 select-none">Loading uncategorized transactions...</p>
        </div>
      </ScreenLayout>
    );
  }

  if (transactions.length === 0 || !currentTx) {
    return <InboxZero onRefresh={() => window.location.reload()} />;
  }

  const displayWarning = hasMissingRates
    ? {
        tone: "error" as const,
        title: "Exchange rates missing",
        detail: "Some transactions are missing rates. Converted amounts exclude those items.",
      }
    : warning;

  const historyMessage = getUndoMessage();

  return (
    <ScreenLayout size="wide">
      <div className="w-full space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-3xl border border-brand/25 bg-gradient-to-br from-brand/20 to-indigo-400/20 p-3.5 text-brand shadow-brand-glow">
              <Layers className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-canvas-900 select-none">Review Inbox</h1>
              <p className="mt-1 text-base font-semibold text-canvas-600 select-none">
                One transaction at a time. Build clean categories at speed.
              </p>
            </div>
          </div>

          <div className="md:min-w-[220px]">
            <ProgressHeader currentIndex={currentIndex} totalTransactions={transactions.length} variant="compact" />
          </div>
        </div>

        {displayWarning && (
          <div
            className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 ${
              displayWarning.tone === "error"
                ? "border-finance-expense/25 bg-finance-expense/10 text-finance-expense"
                : "border-yellow-300 bg-yellow-100 text-yellow-800"
            }`}
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold select-none">{displayWarning.title}</p>
              <p className="text-sm select-none">{displayWarning.detail}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(380px,430px)]">
          <aside className="order-1 space-y-4 self-start xl:order-2 xl:sticky xl:top-28">
            <CategoryInput
              inputRef={inputRef}
              categoryInput={categoryInput}
              setCategoryInput={setCategoryInput}
              onCategorize={handleCategorize}
              onSkip={handleSkip}
              suggestions={suggestions}
              isRuleMode={!!selectionRule}
            />

            <div className="hidden rounded-2xl border border-canvas-200 bg-canvas-50/90 p-4 shadow-sm xl:block">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-canvas-500 select-none">Quick actions</p>
              <p className="mt-1 text-sm text-canvas-600 select-none">
                {historyMessage || "No recent actions yet. Categorize or skip to enable undo."}
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    void handleUndo();
                  }}
                  disabled={undoStack.length === 0}
                  aria-label="Undo last action"
                  data-testid="categorization-undo-button"
                >
                  <RotateCcw className="h-4 w-4" />
                  Undo
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    void handleRedo();
                  }}
                  disabled={redoStack.length === 0}
                  aria-label="Redo last action"
                  data-testid="categorization-redo-button"
                >
                  <RotateCw className="h-4 w-4" />
                  Redo
                </Button>
              </div>

              <p className="mt-2 text-xs text-canvas-500 select-none">
                Shortcuts: <kbd className="rounded border border-canvas-300 bg-canvas-100 px-1 py-0.5">Ctrl/⌘Z</kbd>{" "}
                undo · <kbd className="rounded border border-canvas-300 bg-canvas-100 px-1 py-0.5">Ctrl/⌘⇧Z</kbd> redo
              </p>
            </div>
          </aside>

          <div className="order-2 min-w-0 space-y-5 xl:order-1">
            <TransactionCard
              transaction={currentTx}
              mainAmount={currentTx?.amount_in_main_currency ?? null}
              mainCurrency={mainCurrency}
              onMouseUp={handleSelectionMouseUp}
              onSelectionChange={handleManualSelection}
              selectionRule={selectionRule}
              showOnboardingHint={hasRules === false}
            />

            <RuleEditor
              selectionRule={selectionRule}
              onClearRule={() => {
                setSelectionRule(null);
                setAmountFilter({ operator: "none", value1: "", value2: "" });
              }}
              amountFilter={amountFilter}
              setAmountFilter={setAmountFilter}
              amountInputRef={amountInputRef}
              currentAmount={currentMainAmount}
              matchingTransactions={matchingTransactions.map((tx) => ({
                ...tx,
                main_amount: tx.amount_in_main_currency,
              }))}
              matchingCount={matchingCount}
              amountDefaults={matchingAmountRange}
              mainCurrency={mainCurrency}
            />

            <WebSearchResults
              query={currentTx.description}
              results={webSearchResults}
              loading={webSearchLoading}
              error={webSearchError}
              onSearch={handleWebSearch}
              onDismiss={handleDismissWebSearch}
            />
          </div>
        </div>
      </div>

      <UndoToast
        show={showUndoToast}
        message={getUndoMessage()}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onDismiss={() => setShowUndoToast(false)}
      />
    </ScreenLayout>
  );
};

export default CategorizationLoop;
