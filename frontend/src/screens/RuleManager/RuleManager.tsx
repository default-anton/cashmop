import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFuzzySearch } from '../../hooks/useFuzzySearch';
import { Plus, Wand2, Pencil, Trash2, Check } from 'lucide-react';
import { database } from '../../../wailsjs/go/models';
import { Button, Card, CategoryFilterContent, Modal, ScreenLayout, Table, useToast } from '../../components';
import { FilterConfig } from '../../components/TableHeaderFilter';
import { useCurrency } from '../../contexts/CurrencyContext';
import RuleEditorModal from './components/RuleEditorModal';
import RuleManagerHeader from './components/RuleManagerHeader';
import { MatchType, RuleRow } from './types';

type SortField = 'match_type' | 'match_value' | 'amount' | 'category_name' | 'created_at';
type SortOrder = 'asc' | 'desc';

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
  const { mainCurrency } = useCurrency();
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [categories, setCategories] = useState<database.Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [ruleSearch, setRuleSearch] = useState('');

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [selectedMatchTypes, setSelectedMatchTypes] = useState<MatchType[]>([]);
  const [categoryFilterSearch, setCategoryFilterSearch] = useState('');
  const categoryFilterInputRef = useRef<HTMLInputElement>(null);

  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [activeRule, setActiveRule] = useState<RuleRow | null>(null);

  const [confirmRule, setConfirmRule] = useState<RuleRow | null>(null);
  const [confirmMatchCount, setConfirmMatchCount] = useState(0);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

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

  const openCreateModal = () => {
    setActiveRule(null);
    setIsEditorOpen(true);
  };

  const openEditModal = (rule: RuleRow) => {
    setActiveRule(rule);
    setIsEditorOpen(true);
  };

  const closeEditor = () => {
    setIsEditorOpen(false);
    setActiveRule(null);
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
      setConfirmOpen(false);
      setConfirmRule(null);
    }
  };

  const openDeleteConfirm = async (rule: RuleRow) => {
    setConfirmOpen(true);
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

  const buildRuleSearchLabel = useCallback((rule: RuleRow) => {
    const parts = [
      rule.match_type,
      rule.match_value,
      rule.amount_min ?? '',
      rule.amount_max ?? '',
      rule.category_name || 'Uncategorized',
      rule.created_at || '',
    ];
    return `${parts.join(' | ')} ::${rule.id}`;
  }, []);

  const baseFilteredRules = useMemo(() => {
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

  const filteredRules = useFuzzySearch(baseFilteredRules, buildRuleSearchLabel, ruleSearch);

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
            onClick={() => openDeleteConfirm(row)}
            className="p-2 text-canvas-500 hover:text-finance-expense hover:bg-finance-expense/10 rounded-lg transition-colors select-none"
            aria-label={`Delete rule ${row.match_value}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <ScreenLayout size="wide">
      <div className="space-y-6">
        <RuleManagerHeader
          ruleSearch={ruleSearch}
          onRuleSearchChange={setRuleSearch}
          onClearSearch={() => setRuleSearch('')}
          onCreate={openCreateModal}
        />

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

      <RuleEditorModal
        isOpen={isEditorOpen}
        activeRule={activeRule}
        matchTypeOptions={matchTypeOptions}
        onClose={closeEditor}
        onSaved={fetchRules}
      />

      <Modal
        isOpen={confirmOpen}
        onClose={() => {
          setConfirmOpen(false);
          setConfirmRule(null);
        }}
        title="Delete Rule"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-canvas-600 select-none">Choose how to handle existing categorizations for this rule.</p>
          <div className="text-xs text-canvas-500 select-none">
            {confirmLoading ? 'Checking matches...' : `${confirmMatchCount} matching transaction${confirmMatchCount !== 1 ? 's' : ''}`}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => {
              setConfirmOpen(false);
              setConfirmRule(null);
            }}>Cancel</Button>
            {confirmRule && (
              <>
                <Button variant="secondary" onClick={() => handleDeleteRule(confirmRule, false)}>Delete Rule Only</Button>
                <Button onClick={() => handleDeleteRule(confirmRule, true)}>
                  Delete + Uncategorize ({confirmMatchCount})
                </Button>
              </>
            )}
          </div>
        </div>
      </Modal>
    </ScreenLayout>
  );
};

export default RuleManager;
