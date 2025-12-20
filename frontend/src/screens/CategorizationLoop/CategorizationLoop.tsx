import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Layers, FastForward, CheckCircle2, Search, PlusCircle, ArrowRight, Wand2, X } from 'lucide-react';
import { database } from '../../../wailsjs/go/models';
import { Button, Card, Input, Badge } from '../../components';

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
  const [selectionRule, setSelectionRule] = useState<{ text: string; mode: 'contains' | 'starts_with' | 'ends_with' } | null>(null);
  const [amountFilter, setAmountFilter] = useState<{ operator: 'none' | 'gt' | 'lt' | 'between'; value1: string; value2: string }>({ operator: 'none', value1: '', value2: '' });
  const [skippedIds, setSkippedIds] = useState<Set<number>>(new Set());

  const inputRef = useRef<HTMLInputElement>(null);

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

  const goToNext = useCallback((currentList: Transaction[], currentId: number | null, isSkip: boolean) => {
    if (currentList.length === 0) {
      setCurrentTxId(null);
      return;
    }

    const nextSkipped = new Set(skippedIds);
    if (isSkip && currentId !== null) {
      nextSkipped.add(currentId);
    }

    const currentIdx = currentList.findIndex(t => t.id === currentId);
    let foundId: number | null = null;

    // Search for the next unskipped item, starting from the item AFTER the current one.
    // If currentId is not found (e.g. just categorized), currentIdx is -1, so search starts at 0.
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
      // Loop finished! All items in currentList are in nextSkipped.
      // We start a new "lap" by clearing skips and wrapping to the next logical item.
      setSkippedIds(new Set());
      const nextIdx = (currentIdx + 1) % currentList.length;
      setCurrentTxId(currentList[nextIdx].id);
    }
  }, [skippedIds]);

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
      (window as any).go.main.App.SearchCategories(categoryInput).then((res: Category[] | null) => setSuggestions(res || []));
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
        // Find next item in the fresh list, relative to the one we just handled
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
    const tx = transactions.find(t => t.id === currentTxId);
    if (!tx) return;

    const selection = window.getSelection();
    const text = selection?.toString().trim();

    if (text && text.length > 2 && tx.description.includes(text)) {
      setSelectionRule({ text, mode: 'contains' });
      // Use setTimeout to ensure the focus happens after the selection event is fully processed
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    } else if (text && text.length > 0) {
      setSelectionRule(null);
    }
  };

  const currentTx = transactions.find(t => t.id === currentTxId);
  const currentIndex = transactions.findIndex(t => t.id === currentTxId);

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;

  if (transactions.length === 0 || !currentTx) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center animate-snap-in">
        <div className="w-20 h-20 bg-finance-income/10 rounded-full flex items-center justify-center mb-6 text-finance-income">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h2 className="text-3xl font-bold text-canvas-800 mb-2">Inbox Zero!</h2>
        <p className="text-canvas-500 max-w-md">
          All your transactions are categorized. You're a financial wizard!
        </p>
        <Button onClick={() => window.location.reload()} variant="primary" className="mt-8">
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-canvas-100 texture-delight">
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand/10 text-brand rounded-lg">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-canvas-800">Review Inbox</h1>
              <p className="text-xs font-mono text-canvas-500 uppercase tracking-widest">
                {currentIndex + 1} of {transactions.length} items
              </p>
            </div>
          </div>

          <Badge variant="default" className="font-mono">
            {Math.round(((transactions.length - (currentIndex >= 0 ? currentIndex : 0)) / transactions.length) * 100)}% to go
          </Badge>
        </div>

        <div className="relative group perspective-1000">
          <Card
            variant="glass"
            className="p-12 mb-8 transform transition-all duration-500 hover:rotate-x-1 hover:shadow-2xl border-canvas-200/50"
            onMouseUp={handleTextSelection}
          >
            <div className="text-center">
              <span className="text-xs font-bold text-canvas-400 uppercase tracking-widest mb-4 block">
                {new Date(currentTx.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>

              <h2 className="text-4xl font-black text-canvas-800 mb-6 leading-tight select-text selection:bg-brand/20">
                {currentTx.description}
              </h2>

              <div className={`text-5xl font-mono mb-8 ${currentTx.amount < 0 ? 'text-finance-expense' : 'text-finance-income'}`}>
                {currentTx.amount < 0 ? '-' : ''}${Math.abs(currentTx.amount).toFixed(2)}
              </div>

              <div className="flex gap-2 justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <Badge variant="default" className="bg-canvas-200/50">ID: {currentTx.id}</Badge>
                <Badge variant="default" className="bg-canvas-200/50">Acc: {currentTx.account_id}</Badge>
              </div>
            </div>
          </Card>
        </div>

        <div className="relative">
          {/* Rule Info - Above Input */}
          {selectionRule && (
            <div className="absolute bottom-full left-0 w-full mb-4 animate-snap-in z-30">
              <div className="bg-brand/5 border-2 border-brand/20 rounded-2xl p-4 flex flex-col gap-4 text-brand shadow-lg backdrop-blur-sm">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-4">
                    <div className="bg-brand text-white p-2 rounded-lg shadow-brand-glow">
                      <Wand2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-brand/10 px-2 py-0.5 rounded">Auto-Rule</span>
                        <span className="text-sm font-bold text-canvas-800">
                          Matching descriptions with <span className="text-brand underline underline-offset-4 decoration-2">"{selectionRule.text}"</span>
                        </span>
                      </div>
                      <p className="text-xs text-canvas-500 mt-0.5">Enter a category name below to save this rule.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectionRule(null);
                      setAmountFilter({ operator: 'none', value1: '', value2: '' });
                    }}
                    className="p-2 hover:bg-brand/10 text-canvas-400 hover:text-brand rounded-xl transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="h-px bg-brand/10 w-full" />

                <div className="flex items-center gap-2 w-full">
                  <span className="text-xs font-bold text-canvas-500 uppercase tracking-widest mr-2">Amount:</span>

                  <div className="flex bg-white rounded-lg p-1 border border-brand/20">
                    {(['none', 'gt', 'lt', 'between'] as const).map((op) => (
                      <button
                        key={op}
                        onClick={() => setAmountFilter({ ...amountFilter, operator: op })}
                        className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                          amountFilter.operator === op
                            ? 'bg-brand text-white shadow-sm'
                            : 'text-canvas-500 hover:text-brand hover:bg-brand/5'
                        }`}
                      >
                        {op === 'none' && 'Any'}
                        {op === 'gt' && '> Greater'}
                        {op === 'lt' && '< Less'}
                        {op === 'between' && 'Between'}
                      </button>
                    ))}
                  </div>

                  {amountFilter.operator !== 'none' && (
                    <div className="flex items-center gap-2 animate-snap-in">
                      <input
                        type="number"
                        placeholder={amountFilter.operator === 'between' ? "Min" : "Value"}
                        value={amountFilter.value1}
                        onChange={(e) => setAmountFilter({ ...amountFilter, value1: e.target.value })}
                        className="w-20 px-2 py-1 text-sm border border-brand/20 rounded-lg focus:border-brand focus:ring-1 focus:ring-brand outline-none"
                      />
                      {amountFilter.operator === 'between' && (
                        <>
                          <span className="text-xs text-canvas-400 font-bold">AND</span>
                          <input
                            type="number"
                            placeholder="Max"
                            value={amountFilter.value2}
                            onChange={(e) => setAmountFilter({ ...amountFilter, value2: e.target.value })}
                            className="w-20 px-2 py-1 text-sm border border-brand/20 rounded-lg focus:border-brand focus:ring-1 focus:ring-brand outline-none"
                          />
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <div className="relative flex-1">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-canvas-400">
                <Search className="w-5 h-5" />
              </div>
              <input
                ref={inputRef}
                autoFocus
                type="text"
                value={categoryInput}
                onChange={(e) => setCategoryInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (categoryInput) {
                      handleCategorize(categoryInput);
                    } else {
                      handleSkip();
                    }
                  }
                }}
                placeholder={selectionRule ? "Set category for this rule..." : "Type a category..."}
                className={`w-full bg-white border-2 rounded-2xl py-5 pl-12 pr-6 text-xl font-bold text-canvas-800 placeholder-canvas-300 focus:ring-0 transition-all shadow-sm ${selectionRule ? 'border-brand ring-4 ring-brand/5' : 'border-canvas-200 focus:border-brand'}`}
              />

              {suggestions.length > 0 && (
                <div className="absolute top-full mt-2 left-0 w-full bg-white rounded-xl shadow-xl border border-canvas-200 overflow-hidden z-20">
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleCategorize(s.name, s.id)}
                      className="w-full text-left px-6 py-3 hover:bg-brand/5 text-canvas-700 font-bold border-b border-canvas-100 last:border-0 transition-colors flex items-center justify-between group"
                    >
                      {s.name}
                      <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button
              size="lg"
              variant="primary"
              className={`px-8 rounded-2xl transition-all duration-300 ${selectionRule ? 'shadow-brand-glow scale-105' : 'shadow-brand/20'}`}
              onClick={() => categoryInput ? handleCategorize(categoryInput) : handleSkip()}
            >
              {selectionRule ? <CheckCircle2 className="w-6 h-6" /> : <FastForward className="w-6 h-6" />}
            </Button>
          </div>

          <p className="mt-4 text-center text-canvas-400 text-sm">
            {selectionRule ? (
              <>Press <kbd className="px-2 py-1 bg-canvas-200 rounded text-xs font-mono text-canvas-800">ENTER</kbd> to save rule & categorize</>
            ) : (
              <>Press <kbd className="px-2 py-1 bg-canvas-200 rounded text-xs font-mono text-canvas-800">ENTER</kbd> to punch through</>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default CategorizationLoop;
