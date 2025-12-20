import React, { useState, useEffect, useCallback, useRef } from 'react';
import { database } from '../../../wailsjs/go/models';
import {
  InboxZero,
  ProgressHeader,
  TransactionCard,
  RuleEditor,
  CategoryInput,
} from './components';

interface Transaction {
  id: number;
  date: string;
  description: string;
  amount: number;
  category_id: number | null;
  category_name: string;
  account_id: number;
  owner_id: number | null;
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
  } | null>(null);
  const [amountFilter, setAmountFilter] = useState<{
    operator: 'none' | 'gt' | 'lt' | 'between';
    value1: string;
    value2: string;
  }>({ operator: 'none', value1: '', value2: '' });
  const [skippedIds, setSkippedIds] = useState<Set<number>>(new Set());

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
  }, []);

  useEffect(() => {
    if (currentTxId !== null && !loading) {
      inputRef.current?.focus();
    }
  }, [currentTxId, loading]);

  useEffect(() => {
    if (categoryInput.length > 1) {
      (window as any).go.main.App.SearchCategories(categoryInput).then((res: Category[] | null) =>
        setSuggestions(res || [])
      );
    } else {
      setSuggestions([]);
    }
  }, [categoryInput]);

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

        if (amountFilter.operator === 'gt' && amountFilter.value1) {
          rule.amount_min = parseFloat(amountFilter.value1);
        } else if (amountFilter.operator === 'lt' && amountFilter.value1) {
          rule.amount_max = parseFloat(amountFilter.value1);
        } else if (amountFilter.operator === 'between' && amountFilter.value1 && amountFilter.value2) {
          rule.amount_min = parseFloat(amountFilter.value1);
          rule.amount_max = parseFloat(amountFilter.value2);
        }

        await (window as any).go.main.App.SaveCategorizationRule(rule);
        setSelectionRule(null);
        setAmountFilter({ operator: 'none', value1: '', value2: '' });
      } else {
        await (window as any).go.main.App.CategorizeTransaction(oldId, categoryName);
      }

      const updated = await fetchTransactions();
      if (updated.length === 0) {
        if (onFinish) onFinish();
      } else {
        goToNext(updated, oldId, false);
      }

      setCategoryInput('');
      setSuggestions([]);
    } catch (e) {
      console.error('Failed to (rule-)categorize', e);
    }
  };

  const handleSkip = () => {
    goToNext(transactions, currentTxId, true);
    setCategoryInput('');
    setSuggestions([]);
    setSelectionRule(null);
    setAmountFilter({ operator: 'none', value1: '', value2: '' });
  };

  const handleTextSelection = () => {
    if (!currentTxId) return;
    const tx = transactions.find((t) => t.id === currentTxId);
    if (!tx) return;

    const selection = window.getSelection();
    const text = selection?.toString().trim();

    if (text && text.length > 2 && tx.description.includes(text)) {
      setSelectionRule({ text, mode: 'contains' });
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    } else if (text && text.length > 0) {
      setSelectionRule(null);
    }
  };

  const currentTx = transactions.find((t) => t.id === currentTxId);
  const currentIndex = transactions.findIndex((t) => t.id === currentTxId);

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;

  if (transactions.length === 0 || !currentTx) {
    return <InboxZero onRefresh={() => window.location.reload()} />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-canvas-100 texture-delight">
      <div className="w-full max-w-2xl">
        <ProgressHeader currentIndex={currentIndex} totalTransactions={transactions.length} />

        <TransactionCard transaction={currentTx} onMouseUp={handleTextSelection} />

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
    </div>
  );
};

export default CategorizationLoop;
