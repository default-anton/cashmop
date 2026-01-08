import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Wand2, Pencil, Trash2, Check } from 'lucide-react';
import { database } from '../../../wailsjs/go/models';
import { AutocompleteInput, Button, Card, CategoryFilterContent, Input, Modal, Table, useToast } from '../../components';
import { FilterConfig } from '../../components/TableHeaderFilter';
import { RuleEditor, AmountFilter, SelectionRule } from '../CategorizationLoop/components/RuleEditor';
import { useCurrency } from '../../contexts/CurrencyContext';

export type MatchType = 'contains' | 'starts_with' | 'ends_with' | 'exact';

type SortField = 'match_type' | 'match_value' | 'amount' | 'category_name' | 'created_at';
type SortOrder = 'asc' | 'desc';

type RuleRow = {
  id: number;
  match_type: MatchType;
  match_value: string;
  category_id: number;
  category_name: string;
  amount_min?: number | null;
  amount_max?: number | null;
  created_at?: string;
};

type RulePayload = {
  id: number;
  match_type: MatchType;
  match_value: string;
  category_id: number;
  category_name: string;
  amount_min: number | null;
  amount_max: number | null;
};

interface RuleManagerProps {
  initialCategoryIds?: number[];
}

const matchTypeOptions: { value: MatchType; label: string }[] = [
  { value: 'contains', label: 'Contains' },
  { value: 'starts_with', label: 'Starts With' },
  { value: 'ends_with', label: 'Ends With' },
  { value: 'exact', label: 'Exact' },
];

const RuleManager: React.FC<RuleManagerProps> = ({ initialCategoryIds = [] }) => {
  const toast = useToast();
  const { mainCurrency, showOriginalCurrency, convertAmount } = useCurrency();
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [categories, setCategories] = useState<database.Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [selectedMatchTypes, setSelectedMatchTypes] = useState<MatchType[]>([]);
  const [categoryFilterSearch, setCategoryFilterSearch] = useState('');
  const categoryFilterInputRef = useRef<HTMLInputElement>(null);

  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [activeRule, setActiveRule] = useState<RuleRow | null>(null);
  const [matchType, setMatchType] = useState<MatchType>('contains');
  const [matchValue, setMatchValue] = useState('');
  const [categoryInput, setCategoryInput] = useState('');
  const [categoryId, setCategoryId] = useState(0);
  const [amountFilter, setAmountFilter] = useState<AmountFilter>({ operator: 'none', value1: '', value2: '' });
  const amountInputRef = useRef<HTMLInputElement | null>(null);

  const [categorySuggestions, setCategorySuggestions] = useState<database.Category[]>([]);
  const [matchingTransactions, setMatchingTransactions] = useState<database.TransactionModel[]>([]);
  const [matchingFxAmounts, setMatchingFxAmounts] = useState<Map<number, number | null>>(new Map());
  const [matchingLoading, setMatchingLoading] = useState(false);
  const [matchingCount, setMatchingCount] = useState(0);
  const [matchingAmountRange, setMatchingAmountRange] = useState<{ min?: number | null; max?: number | null }>({});

  const [confirmAction, setConfirmAction] = useState<'update' | 'delete' | null>(null);
  const [confirmRule, setConfirmRule] = useState<RuleRow | null>(null);
  const [confirmMatchCount, setConfirmMatchCount] = useState(0);
  const [confirmLoading, setConfirmLoading] = useState(false);

  useEffect(() => {
    setSelectedCategoryIds(initialCategoryIds);
  }, [initialCategoryIds]);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const [ruleList, categoryList] = await Promise.all([
        (window as any).go.main.App.GetCategorizationRules(),
        (window as any).go.main.App.GetCategories(),
      ]);
      setRules(ruleList || []);
      setCategories(categoryList || []);
    } catch (e) {
      console.error('Failed to fetch rules', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  useEffect(() => {
    if (categoryInput.length <= 1) {
      setCategorySuggestions([]);
      return;
    }

    let cancelled = false;
    const timeout = setTimeout(() => {
      (window as any).go.main.App.SearchCategories(categoryInput).then((res: database.Category[] | null) => {
        if (!cancelled) {
          setCategorySuggestions(res || []);
        }
      });
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [categoryInput]);

  useEffect(() => {
    let cancelled = false;
    const compute = async () => {
      if (matchingTransactions.length === 0) {
        setMatchingFxAmounts(new Map());
        return;
      }
      const next = new Map<number, number | null>();
      await Promise.all(matchingTransactions.map(async (tx) => {
        const converted = await convertAmount(tx.amount, tx.currency || mainCurrency, tx.date);
        next.set(tx.id, converted);
      }));
      if (!cancelled) {
        setMatchingFxAmounts(next);
      }
    };
    compute();
    return () => {
      cancelled = true;
    };
  }, [convertAmount, mainCurrency, matchingTransactions]);

  const currentAmountBasis = useMemo(() => {
    if (matchingTransactions.length > 0) {
      const first = matchingTransactions[0];
      const mainAmount = matchingFxAmounts.get(first.id);
      if (mainAmount !== null && mainAmount !== undefined) return mainAmount;
      return first.amount;
    }
    if (activeRule && (activeRule.amount_min !== null && activeRule.amount_min !== undefined)) {
      return activeRule.amount_min || 0;
    }
    if (activeRule && (activeRule.amount_max !== null && activeRule.amount_max !== undefined)) {
      return activeRule.amount_max || 0;
    }
    if (matchingAmountRange.max !== undefined && matchingAmountRange.max !== null) {
      return matchingAmountRange.max || 0;
    }
    if (matchingAmountRange.min !== undefined && matchingAmountRange.min !== null) {
      return matchingAmountRange.min || 0;
    }
    return 0;
  }, [activeRule, matchingAmountRange.max, matchingAmountRange.min, matchingFxAmounts, matchingTransactions]);

  const parseAmountValue = (value: string) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const buildAmountBounds = useCallback((filter: AmountFilter, basis: number) => {
    if (filter.operator === 'none') {
      return { amountMin: null, amountMax: null };
    }

    const v1 = parseAmountValue(filter.value1);
    const v2 = parseAmountValue(filter.value2);

    if (v1 === null || (filter.operator === 'between' && v2 === null)) {
      return { amountMin: null, amountMax: null };
    }

    const isExpense = basis < 0;
    const abs1 = Math.abs(v1);
    const abs2 = v2 !== null ? Math.abs(v2) : null;

    if (filter.operator === 'gt') {
      return isExpense
        ? { amountMin: null, amountMax: -abs1 }
        : { amountMin: abs1, amountMax: null };
    }

    if (filter.operator === 'lt') {
      return isExpense
        ? { amountMin: -abs1, amountMax: null }
        : { amountMin: null, amountMax: abs1 };
    }

    const minVal = abs2 !== null ? Math.min(abs1, abs2) : abs1;
    const maxVal = abs2 !== null ? Math.max(abs1, abs2) : abs1;

    return isExpense
      ? { amountMin: -maxVal, amountMax: -minVal }
      : { amountMin: minVal, amountMax: maxVal };
  }, []);

  useEffect(() => {
    if (!isEditorOpen) {
      setMatchingTransactions([]);
      setMatchingCount(0);
      setMatchingAmountRange({});
      setMatchingLoading(false);
      return;
    }
    if (!matchValue.trim()) {
      setMatchingTransactions([]);
      setMatchingCount(0);
      setMatchingAmountRange({});
      setMatchingLoading(false);
      return;
    }

    let cancelled = false;
    setMatchingLoading(true);

    const timeout = setTimeout(async () => {
      try {
        const { amountMin, amountMax } = buildAmountBounds(amountFilter, currentAmountBasis);
        const res = await (window as any).go.main.App.PreviewRuleMatches(
          matchValue.trim(),
          matchType,
          amountMin,
          amountMax
        );
        if (!cancelled) {
          setMatchingTransactions(res?.transactions || []);
          setMatchingCount(res?.count || 0);
          setMatchingAmountRange({ min: res?.min_amount ?? null, max: res?.max_amount ?? null });
        }
      } catch (e) {
        if (!cancelled) {
          console.error('Failed to fetch matching transactions', e);
          setMatchingTransactions([]);
          setMatchingCount(0);
          setMatchingAmountRange({});
        }
      } finally {
        if (!cancelled) {
          setMatchingLoading(false);
        }
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [amountFilter, buildAmountBounds, currentAmountBasis, isEditorOpen, matchType, matchValue]);

  const openCreateModal = () => {
    setActiveRule(null);
    setMatchType('contains');
    setMatchValue('');
    setCategoryInput('');
    setCategoryId(0);
    setAmountFilter({ operator: 'none', value1: '', value2: '' });
    setMatchingTransactions([]);
    setMatchingCount(0);
    setMatchingAmountRange({});
    setIsEditorOpen(true);
  };

  const deriveAmountFilter = (rule: RuleRow): AmountFilter => {
    const min = rule.amount_min ?? null;
    const max = rule.amount_max ?? null;

    if (min === null && max === null) {
      return { operator: 'none', value1: '', value2: '' };
    }

    if (min !== null && max !== null) {
      const absMin = Math.abs(min);
      const absMax = Math.abs(max);
      return {
        operator: 'between',
        value1: String(Math.min(absMin, absMax)),
        value2: String(Math.max(absMin, absMax)),
      };
    }

    if (min !== null) {
      return {
        operator: min < 0 ? 'lt' : 'gt',
        value1: String(Math.abs(min)),
        value2: '',
      };
    }

    return {
      operator: max !== null && max < 0 ? 'gt' : 'lt',
      value1: String(Math.abs(max || 0)),
      value2: '',
    };
  };

  const openEditModal = (rule: RuleRow) => {
    setActiveRule(rule);
    setMatchType(rule.match_type);
    setMatchValue(rule.match_value);
    setCategoryInput(rule.category_name || '');
    setCategoryId(rule.category_id || 0);
    setAmountFilter(deriveAmountFilter(rule));
    setMatchingTransactions([]);
    setIsEditorOpen(true);
  };

  const closeEditor = () => {
    setIsEditorOpen(false);
    setActiveRule(null);
    setMatchingTransactions([]);
    setMatchingCount(0);
    setMatchingAmountRange({});
  };

  const buildRulePayload = (): RulePayload => {
    const { amountMin, amountMax } = buildAmountBounds(amountFilter, currentAmountBasis);
    return {
      id: activeRule?.id || 0,
      match_type: matchType,
      match_value: matchValue.trim(),
      category_id: categoryId,
      category_name: categoryInput.trim(),
      amount_min: amountMin,
      amount_max: amountMax,
    };
  };

  const handleSaveRule = async () => {
    if (!matchValue.trim()) {
      toast.showToast('Match value is required', 'error');
      return;
    }
    if (!categoryInput.trim()) {
      toast.showToast('Category is required', 'error');
      return;
    }

    const payload = buildRulePayload();

    try {
      const res = await (window as any).go.main.App.SaveCategorizationRule(payload);
      toast.showToast(
        `Rule created and applied to ${res?.affected_ids?.length || 0} transaction${(res?.affected_ids?.length || 0) !== 1 ? 's' : ''}`,
        'success'
      );
      closeEditor();
      fetchRules();
    } catch (e) {
      console.error('Failed to save rule', e);
      toast.showToast('Failed to save rule', 'error');
    }
  };

  const handleUpdateRule = async (recategorize: boolean) => {
    if (!activeRule) return;
    if (!matchValue.trim()) {
      toast.showToast('Match value is required', 'error');
      return;
    }
    if (!categoryInput.trim()) {
      toast.showToast('Category is required', 'error');
      return;
    }

    const payload = buildRulePayload();

    try {
      const res = await (window as any).go.main.App.UpdateCategorizationRule(payload, recategorize);
      if (recategorize) {
        toast.showToast(
          `Rule updated: ${res?.uncategorize_count || 0} uncategorized, ${res?.applied_count || 0} recategorized`,
          'success'
        );
      } else {
        toast.showToast('Rule updated', 'success');
      }
      closeEditor();
      fetchRules();
    } catch (e) {
      console.error('Failed to update rule', e);
      toast.showToast('Failed to update rule', 'error');
    } finally {
      setConfirmAction(null);
      setConfirmRule(null);
    }
  };

  const handleDeleteRule = async (rule: RuleRow, uncategorize: boolean) => {
    try {
      const res = await (window as any).go.main.App.DeleteCategorizationRule(rule.id, uncategorize);
      if (uncategorize) {
        toast.showToast(
          `Rule deleted and ${res?.uncategorized_count || 0} transaction${(res?.uncategorized_count || 0) !== 1 ? 's' : ''} uncategorized`,
          'success'
        );
      } else {
        toast.showToast('Rule deleted', 'success');
      }
      fetchRules();
    } catch (e) {
      console.error('Failed to delete rule', e);
      toast.showToast('Failed to delete rule', 'error');
    } finally {
      setConfirmAction(null);
      setConfirmRule(null);
    }
  };

  const openConfirmModal = async (action: 'update' | 'delete', rule: RuleRow) => {
    setConfirmAction(action);
    setConfirmRule(rule);
    setConfirmMatchCount(0);
    setConfirmLoading(true);
    try {
      const count = await (window as any).go.main.App.GetRuleMatchCount(rule.id);
      setConfirmMatchCount(count || 0);
    } catch (e) {
      console.error('Failed to fetch rule match count', e);
      setConfirmMatchCount(0);
    } finally {
      setConfirmLoading(false);
    }
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: mainCurrency,
  }).format(Math.abs(amount));

  const formatAmountFilter = (rule: RuleRow) => {
    const min = rule.amount_min ?? null;
    const max = rule.amount_max ?? null;

    if (min === null && max === null) return 'Any';

    if (min !== null && max !== null) {
      const minAbs = Math.abs(min);
      const maxAbs = Math.abs(max);
      const lower = Math.min(minAbs, maxAbs);
      const upper = Math.max(minAbs, maxAbs);
      return `${formatCurrency(lower)} - ${formatCurrency(upper)}`;
    }

    if (min !== null) {
      return min < 0 ? `≤ ${formatCurrency(min)}` : `≥ ${formatCurrency(min)}`;
    }

    return max !== null && max < 0 ? `≥ ${formatCurrency(max)}` : `≤ ${formatCurrency(max || 0)}`;
  };

  const filteredRules = useMemo(() => {
    let next = [...rules];

    if (selectedCategoryIds.length > 0) {
      next = next.filter((rule) => selectedCategoryIds.includes(rule.category_id));
    }

    if (selectedMatchTypes.length > 0) {
      next = next.filter((rule) => selectedMatchTypes.includes(rule.match_type));
    }

    const getAmountSortValue = (rule: RuleRow) => {
      const min = rule.amount_min ?? null;
      const max = rule.amount_max ?? null;
      if (min === null && max === null) return 0;
      if (min !== null && max !== null) return Math.max(Math.abs(min), Math.abs(max));
      if (min !== null) return Math.abs(min);
      return Math.abs(max || 0);
    };

    const compare = (a: RuleRow, b: RuleRow) => {
      let result = 0;
      switch (sortField) {
        case 'match_type':
          result = a.match_type.localeCompare(b.match_type);
          break;
        case 'match_value':
          result = a.match_value.localeCompare(b.match_value);
          break;
        case 'amount':
          result = getAmountSortValue(a) - getAmountSortValue(b);
          break;
        case 'category_name':
          result = (a.category_name || '').localeCompare(b.category_name || '');
          break;
        case 'created_at':
          result = (new Date(a.created_at || 0).getTime()) - (new Date(b.created_at || 0).getTime());
          break;
      }
      return sortOrder === 'asc' ? result : -result;
    };

    next.sort(compare);
    return next;
  }, [rules, selectedCategoryIds, selectedMatchTypes, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'created_at' ? 'desc' : 'asc');
    }
  };

  const matchTypeFilterConfig: FilterConfig = {
    type: 'text',
    isActive: selectedMatchTypes.length > 0,
  };

  const categoryFilterConfig: FilterConfig = {
    type: 'category',
    isActive: selectedCategoryIds.length > 0,
    label: selectedCategoryIds.length > 0 ? `${selectedCategoryIds.length} selected` : undefined,
  };

  const columns = [
    {
      key: 'match_type',
      header: 'Match Type',
      sortable: true,
      filter: {
        config: matchTypeFilterConfig,
        onClear: () => setSelectedMatchTypes([]),
        children: (
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-bold text-canvas-600 uppercase tracking-widest select-none">Filter by Type</span>
              <button
                onClick={() => setSelectedMatchTypes([])}
                className="text-xs text-canvas-400 hover:text-canvas-700 select-none"
              >
                Clear
              </button>
            </div>
            <div className="space-y-1">
              {matchTypeOptions.map((option) => {
                const isActive = selectedMatchTypes.includes(option.value);
                return (
                  <button
                    key={option.value}
                    onClick={() => {
                      setSelectedMatchTypes((prev) =>
                        prev.includes(option.value)
                          ? prev.filter((t) => t !== option.value)
                          : [...prev, option.value]
                      );
                    }}
                    className={`
                      w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors select-none
                      ${isActive
                        ? 'bg-brand/10 text-brand font-semibold'
                        : 'text-canvas-700 hover:bg-canvas-100'}
                    `}
                  >
                    <span>{option.label}</span>
                    {isActive && <Check className="w-4 h-4" />}
                  </button>
                );
              })}
            </div>
          </div>
        ),
      },
      render: (value: MatchType) => {
        const label = matchTypeOptions.find((opt) => opt.value === value)?.label || value;
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-canvas-100 text-[10px] font-bold text-canvas-600 border border-canvas-200 tracking-tight">
            {label}
          </span>
        );
      },
    },
    {
      key: 'match_value',
      header: 'Match Value',
      sortable: true,
      render: (value: string) => (
        <span className="font-mono text-xs text-canvas-700">{value}</span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount Filter',
      sortable: true,
      render: (_: any, row: RuleRow) => (
        <span className="text-xs font-semibold text-canvas-600">{formatAmountFilter(row)}</span>
      ),
    },
    {
      key: 'category_name',
      header: 'Category',
      sortable: true,
      filter: {
        config: categoryFilterConfig,
        onClear: () => setSelectedCategoryIds([]),
        children: (
          <CategoryFilterContent
            categories={categories}
            selectedIds={selectedCategoryIds}
            onSelect={(id) => {
              setSelectedCategoryIds((prev) =>
                prev.includes(id) ? prev.filter((cid) => cid !== id) : [...prev, id]
              );
            }}
            onSelectOnly={(id, e) => {
              e?.stopPropagation();
              setSelectedCategoryIds([id]);
            }}
            onSelectAll={() => setSelectedCategoryIds(categories.map((c) => c.id))}
            onClear={() => setSelectedCategoryIds([])}
            searchTerm={categoryFilterSearch}
            onSearchChange={setCategoryFilterSearch}
            inputRef={categoryFilterInputRef}
          />
        ),
      },
      render: (value: string) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-tight bg-brand/5 text-brand border border-brand/10">
          {value}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      sortable: true,
      render: (value: string) => (
        <span className="text-xs text-canvas-600">
          {value ? new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (_: any, row: RuleRow) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => openEditModal(row)}
            className="p-2 text-canvas-500 hover:text-brand hover:bg-brand/5 rounded-lg transition-colors select-none"
            aria-label={`Edit rule ${row.match_value}`}
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => openConfirmModal('delete', row)}
            className="p-2 text-canvas-500 hover:text-finance-expense hover:bg-finance-expense/10 rounded-lg transition-colors select-none"
            aria-label={`Delete rule ${row.match_value}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const selectionRule: SelectionRule = {
    text: matchValue,
    mode: matchType,
  };

  const matchingPreview = matchingTransactions.map((tx) => ({
    ...tx,
    main_amount: matchingFxAmounts.get(tx.id) ?? null,
  }));

  return (
    <div className="min-h-screen pt-24 pb-12 px-8 bg-canvas-100">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-brand/10 text-brand rounded-2xl shadow-brand/5 shadow-inner">
              <Wand2 className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-canvas-800 select-none">Rules</h1>
              <p className="text-canvas-500 font-medium select-none">Manage categorization rules and keep your automation tidy</p>
            </div>
          </div>
          <Button onClick={openCreateModal}>
            <Plus className="w-4 h-4" />
            New Rule
          </Button>
        </div>

        <Card variant="elevated" className="p-4">
          {loading ? (
            <div className="py-12 text-center text-canvas-400 select-none">Loading rules...</div>
          ) : (
            <Table
              columns={columns}
              data={filteredRules}
              sortField={sortField}
              sortOrder={sortOrder}
              onSort={(field) => handleSort(field as SortField)}
              emptyMessage="No rules yet"
              emptyDetail="Create a rule to automatically categorize new transactions."
            />
          )}
        </Card>
      </div>

      <Modal
        isOpen={isEditorOpen}
        onClose={closeEditor}
        title={activeRule ? 'Edit Rule' : 'Create Rule'}
        size="lg"
      >
        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <div className="text-[10px] font-bold text-canvas-600 uppercase tracking-widest mb-2 select-none">Match Type</div>
              <div className="flex bg-white rounded-xl p-1 border border-canvas-200">
                {matchTypeOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setMatchType(option.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all select-none ${matchType === option.value
                      ? 'bg-brand text-white shadow-sm'
                      : 'text-canvas-500 hover:text-brand hover:bg-brand/5'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-canvas-600 uppercase tracking-widest mb-2 block select-none">Match Value</label>
              <Input
                value={matchValue}
                onChange={(e) => setMatchValue(e.target.value)}
                placeholder="e.g., Uber, Starbucks"
                className="w-full"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-canvas-600 uppercase tracking-widest mb-2 block select-none">Category</label>
              <AutocompleteInput
                value={categoryInput}
                onChange={(value) => {
                  setCategoryInput(value);
                  setCategoryId(0);
                }}
                onSelect={(value) => {
                  const id = parseInt(value, 10);
                  if (!Number.isNaN(id)) {
                    setCategoryId(id);
                  }
                }}
                options={categorySuggestions.map((cat) => ({ value: String(cat.id), label: cat.name }))}
                placeholder="Search categories..."
                filterMode="none"
                dropdownClassName="z-[110]"
              />
            </div>
          </div>

          <RuleEditor
            selectionRule={selectionRule}
            onClearRule={() => setMatchValue('')}
            amountFilter={amountFilter}
            setAmountFilter={setAmountFilter}
            amountInputRef={amountInputRef}
            currentAmount={currentAmountBasis}
            matchingTransactions={matchingPreview}
            matchingCount={matchingCount}
            matchingLoading={matchingLoading}
            amountDefaults={matchingAmountRange}
            mainCurrency={mainCurrency}
            showOriginalCurrency={showOriginalCurrency}
            showCategoryColumn
            showCategoryHint={false}
          />

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={closeEditor}>Cancel</Button>
            {activeRule ? (
              <Button onClick={() => openConfirmModal('update', activeRule)}>Save Changes</Button>
            ) : (
              <Button onClick={handleSaveRule}>Save Rule</Button>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={confirmAction !== null}
        onClose={() => {
          setConfirmAction(null);
          setConfirmRule(null);
        }}
        title={confirmAction === 'delete' ? 'Delete Rule' : 'Update Rule'}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-canvas-600 select-none">
            {confirmAction === 'delete'
              ? 'Choose how to handle existing categorizations for this rule.'
              : 'Choose how to apply your updated rule.'}
          </p>
          <div className="text-xs text-canvas-500 select-none">
            {confirmLoading ? 'Checking matches...' : `${confirmMatchCount} matching transaction${confirmMatchCount !== 1 ? 's' : ''}`}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => {
              setConfirmAction(null);
              setConfirmRule(null);
            }}>Cancel</Button>
            {confirmAction === 'delete' && confirmRule && (
              <>
                <Button variant="secondary" onClick={() => handleDeleteRule(confirmRule, false)}>Delete Rule Only</Button>
                <Button onClick={() => handleDeleteRule(confirmRule, true)}>
                  Delete + Uncategorize ({confirmMatchCount})
                </Button>
              </>
            )}
            {confirmAction === 'update' && (
              <>
                <Button variant="secondary" onClick={() => handleUpdateRule(false)}>Update Rule Only</Button>
                <Button onClick={() => handleUpdateRule(true)}>
                  Update + Recategorize ({confirmMatchCount})
                </Button>
              </>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default RuleManager;
