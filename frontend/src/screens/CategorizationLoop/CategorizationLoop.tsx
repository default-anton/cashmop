import React, { useState, useEffect, useCallback, useRef } from 'react';
import { database } from '../../../wailsjs/go/models';
import { useToast } from '../../contexts/ToastContext';
import {
  InboxZero,
  ProgressHeader,
  TransactionCard,
  RuleEditor,
  CategoryInput,
  WebSearchResults,
  UndoToast,
} from './components';

interface Transaction {
  id: number;
  date: string;
  description: string;
  amount: number;
  category_id: number | null;
  category_name: string;
  account_id: number;
  account_name: string;
  owner_id: number | null;
  owner_name: string;
}

type UndoActionType = 'single' | 'rule' | 'skip' | null;

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
  const [categoryInput, setCategoryInput] = useState('');
  const [suggestions, setSuggestions] = useState<Category[]>([]);
  const [selectionRule, setSelectionRule] = useState<{
    text: string;
    mode: 'contains' | 'starts_with' | 'ends_with';
    startIndex?: number;
  } | null>(null);
  const [debouncedRule, setDebouncedRule] = useState(selectionRule);
  const [amountFilter, setAmountFilter] = useState<{
    operator: 'none' | 'gt' | 'lt' | 'between';
    value1: string;
    value2: string;
  }>({ operator: 'none', value1: '', value2: '' });
  const [matchingTransactions, setMatchingTransactions] = useState<Transaction[]>([]);
  const [skippedIds, setSkippedIds] = useState<Set<number>>(new Set());
  const [hasRules, setHasRules] = useState<boolean | null>(null);

  // Undo/Redo state
  const [undoStack, setUndoStack] = useState<UndoState[]>([]);
  const [redoStack, setRedoStack] = useState<UndoState[]>([]);
  const [showUndoToast, setShowUndoToast] = useState(false);

  // Toast notifications
  const { showToast } = useToast();

  // Web search state
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
      console.error('Failed to fetch transactions', e);
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
    [skippedIds]
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
      return;
    }

    const fetchMatching = async () => {
      try {
        let amountMin: number | null = null;
        let amountMax: number | null = null;

        if (amountFilter.operator !== 'none') {
          let v1 = parseFloat(amountFilter.value1) || 0;
          let v2 = parseFloat(amountFilter.value2) || 0;
          if (amountFilter.operator === 'between' && v1 > v2) [v1, v2] = [v2, v1];

          const isExpense = currentTx && currentTx.amount < 0;

          if (isExpense) {
            if (amountFilter.operator === 'gt') amountMax = -v1;
            else if (amountFilter.operator === 'lt') amountMin = -v1;
            else if (amountFilter.operator === 'between') {
              amountMin = -v2;
              amountMax = -v1;
            }
          } else {
            if (amountFilter.operator === 'gt') amountMin = v1;
            else if (amountFilter.operator === 'lt') amountMax = v1;
            else if (amountFilter.operator === 'between') {
              amountMin = v1;
              amountMax = v2;
            }
          }
        }

        const res = await (window as any).go.main.App.SearchTransactions(
          debouncedRule.text,
          debouncedRule.mode,
          amountMin,
          amountMax
        );
        setMatchingTransactions(res || []);
      } catch (e) {
        console.error('Failed to fetch matching transactions', e);
      }
    };

    fetchMatching();
  }, [debouncedRule, amountFilter, currentTx?.id]);

  // Keyboard shortcuts for web search (Cmd+K / Ctrl+K) and undo/redo (Cmd+Z / Cmd+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Web search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (currentTx) {
          handleWebSearch();
        }
      }

      // Undo: Cmd+Z / Ctrl+Z
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (undoStack.length > 0) {
          handleUndo();
        }
      }

      // Redo: Cmd+Shift+Z / Ctrl+Shift+Z
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        if (redoStack.length > 0) {
          handleRedo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
      console.error('Web search failed', e);
      setWebSearchError('Web search unavailable. Try again later');
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
      let successMessage = '';

      switch (action.type) {
        case 'single':
          await (window as any).go.main.App.CategorizeTransaction(action.transactionId, '');
          successMessage = 'Undo complete - transaction uncategorized';
          break;
        case 'rule':
          await (window as any).go.main.App.UndoCategorizationRule(
            action.ruleId || 0,
            action.affectedTransactionIds || []
          );
          const count = (action.affectedTransactionIds || []).length;
          successMessage = `Undo complete - ${count} transaction${count !== 1 ? 's' : ''} reverted, rule removed`;
          break;
        case 'skip':
          setSkippedIds((prev) => {
            const next = new Set(prev);
            next.delete(action.transactionId);
            return next;
          });
          successMessage = 'Undo complete - transaction back in queue';
          break;
      }

      // Move action from undo stack to redo stack
      setUndoStack((prev) => prev.slice(0, -1));
      setRedoStack((prev) => [...prev, action]);

      const updated = await fetchTransactions();
      if (updated.length === 0) {
        setShowUndoToast(false);
        if (onFinish) onFinish();
      } else {
        // Set current ID to the undone transaction (it should now be uncategorized)
        // Fall back to first transaction if the undone one isn't in the list
        const undoneTxExists = updated.some(t => t.id === action.transactionId);
        setCurrentTxId(undoneTxExists ? action.transactionId : updated[0].id);
      }

      setCategoryInput('');
      setSuggestions([]);
      setSelectionRule(null);
      setAmountFilter({ operator: 'none', value1: '', value2: '' });
      setWebSearchResults(null);
      setWebSearchError(null);

      setShowUndoToast(true);
      showToast(successMessage, 'success', 2000);
    } catch (e) {
      console.error('Undo failed', e);
    }
  };

  const handleRedo = async () => {
    if (redoStack.length === 0) return;

    const action = redoStack[redoStack.length - 1];

    try {
      let successMessage = '';

      switch (action.type) {
        case 'single':
          await (window as any).go.main.App.CategorizeTransaction(action.transactionId, action.categoryName || '');
          successMessage = 'Redo complete - transaction categorized';
          break;
        case 'rule':
          // Re-create and re-apply the rule
          const rule = new database.CategorizationRule();
          rule.match_type = 'contains';
          rule.match_value = action.matchValue || '';
          rule.category_id = 0;
          rule.category_name = action.categoryName || '';

          const ruleResult = await (window as any).go.main.App.SaveCategorizationRule(rule);
          successMessage = `Redo complete - rule applied to ${(action.affectedTransactionIds || []).length} transaction${(action.affectedTransactionIds || []).length !== 1 ? 's' : ''}`;
          break;
        case 'skip':
          setSkippedIds((prev) => new Set([...prev, action.transactionId]));
          successMessage = 'Redo complete - transaction skipped';
          break;
      }

      // Move action from redo stack back to undo stack
      setRedoStack((prev) => prev.slice(0, -1));
      setUndoStack((prev) => [...prev, action]);

      const updated = await fetchTransactions();
      if (updated.length === 0) {
        setShowUndoToast(false);
        if (onFinish) onFinish();
      } else {
        // Navigate to next transaction after re-applying the categorization
        const currentIdx = updated.findIndex(t => t.id === action.transactionId);
        if (currentIdx !== -1) {
          // Transaction still exists, move to next
          goToNext(updated, action.transactionId, false);
        } else {
          // Transaction was categorized and no longer in uncategorized list
          setCurrentTxId(updated[0].id);
        }
      }

      setCategoryInput('');
      setSuggestions([]);
      setSelectionRule(null);
      setAmountFilter({ operator: 'none', value1: '', value2: '' });
      setWebSearchResults(null);
      setWebSearchError(null);

      setShowUndoToast(true);
      showToast(successMessage, 'success', 2000);
    } catch (e) {
      console.error('Redo failed', e);
    }
  };

  const getUndoMessage = useCallback((): string => {
    // If we have redo actions, show redo message
    if (redoStack.length > 0) {
      const action = redoStack[redoStack.length - 1];
      switch (action.type) {
        case 'single':
          return `Redo ${action.categoryName || 'categorization'}`;
        case 'rule':
          const count = (action.affectedTransactionIds || []).length;
          if (count === 1) {
            return `Redo rule: ${action.matchValue} → ${action.categoryName || 'category'}`;
          }
          return `Redo rule: ${action.matchValue} → ${action.categoryName || 'category'} (${count} transactions)`;
        case 'skip':
          return 'Redo skip';
        default:
          return '';
      }
    }

    // Otherwise show undo message
    const action = undoStack.length > 0 ? undoStack[undoStack.length - 1] : null;
    if (!action) return '';

    switch (action.type) {
      case 'single':
        return `Undo ${action.categoryName || 'categorization'}`;
      case 'rule':
        const count = (action.affectedTransactionIds || []).length;
        if (count === 1) {
          return `Undo rule: ${action.matchValue} → ${action.categoryName || 'category'}`;
        }
        return `Undo rule: ${action.matchValue} → ${action.categoryName || 'category'} (${count} transactions)`;
      case 'skip':
        return 'Undo skip';
      default:
        return '';
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

        if (amountFilter.operator !== 'none') {
          let v1 = parseFloat(amountFilter.value1) || 0;
          let v2 = parseFloat(amountFilter.value2) || 0;

          if (amountFilter.operator === 'between' && v1 > v2) {
            [v1, v2] = [v2, v1];
          }

          const currentTx = transactions.find(t => t.id === oldId);
          const isExpense = currentTx && currentTx.amount < 0;

          if (isExpense) {
            if (amountFilter.operator === 'gt') {
              rule.amount_max = -v1;
            } else if (amountFilter.operator === 'lt') {
              rule.amount_min = -v1;
            } else if (amountFilter.operator === 'between') {
              rule.amount_min = -v2;
              rule.amount_max = -v1;
            }
          } else {
            if (amountFilter.operator === 'gt') {
              rule.amount_min = v1;
            } else if (amountFilter.operator === 'lt') {
              rule.amount_max = v1;
            } else if (amountFilter.operator === 'between') {
              rule.amount_min = v1;
              rule.amount_max = v2;
            }
          }
        }

        const ruleResult = await (window as any).go.main.App.SaveCategorizationRule(rule);
        const newAction: UndoState = {
          type: 'rule',
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
        setAmountFilter({ operator: 'none', value1: '', value2: '' });
        setHasRules(true); // Don't show hint again after first rule is created
      } else {
        await (window as any).go.main.App.CategorizeTransaction(oldId, categoryName);
        const newAction: UndoState = {
          type: 'single',
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

      setCategoryInput('');
      setSuggestions([]);
      setWebSearchResults(null);
      setWebSearchError(null);
    } catch (e) {
      console.error('Failed to (rule-)categorize', e);
    }
  };

  const handleSkip = () => {
    if (currentTxId !== null) {
      const newAction: UndoState = {
        type: 'skip',
        transactionId: currentTxId,
      };
      setUndoStack((prev) => [...prev, newAction]);
      setRedoStack([]);
      setShowUndoToast(true);
    }
    goToNext(transactions, currentTxId, true);
    setCategoryInput('');
    setSuggestions([]);
    setSelectionRule(null);
    setAmountFilter({ operator: 'none', value1: '', value2: '' });
    setWebSearchResults(null);
    setWebSearchError(null);
  };

  /*
   * Replaced by manual selection from TransactionCard to support custom highlighting
   * without fighting browser selection behavior.
   */
  const handleManualSelection = useCallback((startIndex: number, endIndex: number) => {
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
    let mode: 'contains' | 'starts_with' | 'ends_with' = 'contains';

    if (finalStart === 0 && finalEnd === description.length) {
      mode = 'contains';
    } else if (finalStart === 0) {
      mode = 'starts_with';
    } else if (finalEnd === description.length) {
      mode = 'ends_with';
    } else {
      mode = 'contains';
    }

    setSelectionRule({ text: trimmedText, mode, startIndex: finalStart });
  }, [currentTxId, transactions]);

  const handleSelectionMouseUp = useCallback(() => {
    if (selectionRule) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, [selectionRule]);

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;

  if (transactions.length === 0 || !currentTx) {
    return <InboxZero onRefresh={() => window.location.reload()} />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center pt-24 pb-12 px-8 bg-canvas-100 texture-delight">
      <div className="w-full max-w-2xl">
        <ProgressHeader currentIndex={currentIndex} totalTransactions={transactions.length} />

        <TransactionCard
          transaction={currentTx}
          onMouseUp={handleSelectionMouseUp}
          onSelectionChange={handleManualSelection}
          selectionRule={selectionRule}
          showOnboardingHint={hasRules === false}
        />

        <WebSearchResults
          query={currentTx.description}
          results={webSearchResults}
          loading={webSearchLoading}
          error={webSearchError}
          onSearch={handleWebSearch}
          onDismiss={handleDismissWebSearch}
        />

        <RuleEditor
          selectionRule={selectionRule}
          onClearRule={() => {
            setSelectionRule(null);
            setAmountFilter({ operator: 'none', value1: '', value2: '' });
          }}
          amountFilter={amountFilter}
          setAmountFilter={setAmountFilter}
          amountInputRef={amountInputRef}
          currentAmount={currentTx?.amount}
          matchingTransactions={matchingTransactions}
        />

        <CategoryInput
          inputRef={inputRef}
          categoryInput={categoryInput}
          setCategoryInput={setCategoryInput}
          onCategorize={handleCategorize}
          onSkip={handleSkip}
          suggestions={suggestions}
          isRuleMode={!!selectionRule}
        />
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
    </div>
  );
};

export default CategorizationLoop;
