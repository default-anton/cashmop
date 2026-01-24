import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { database } from '../../../../wailsjs/go/models';
import { AutocompleteInput, Button, Input, Modal, useToast } from '../../../components';
import { RuleEditor, AmountFilter, SelectionRule } from '../../CategorizationLoop/components/RuleEditor';
import { useCurrency } from '@/contexts/CurrencyContext';
import { parseCents } from '../../../utils/currency';
import { MatchType, RulePayload, RuleRow } from '../types';

type MatchTypeOption = { value: MatchType; label: string };

interface RuleEditorModalProps {
  isOpen: boolean;
  activeRule: RuleRow | null;
  matchTypeOptions: MatchTypeOption[];
  onClose: () => void;
  onSaved: () => void;
}

const RuleEditorModal: React.FC<RuleEditorModalProps> = ({
  isOpen,
  activeRule,
  matchTypeOptions,
  onClose,
  onSaved,
}) => {
  const toast = useToast();
  const { mainCurrency } = useCurrency();
  const [matchType, setMatchType] = useState<MatchType>('contains');
  const [matchValue, setMatchValue] = useState('');
  const [categoryInput, setCategoryInput] = useState('');
  const [categoryId, setCategoryId] = useState(0);
  const [amountFilter, setAmountFilter] = useState<AmountFilter>({ operator: 'none', value1: '', value2: '' });
  const amountInputRef = useRef<HTMLInputElement | null>(null);

  const [categorySuggestions, setCategorySuggestions] = useState<database.Category[]>([]);
  const [matchingTransactions, setMatchingTransactions] = useState<database.TransactionModel[]>([]);
  const [matchingLoading, setMatchingLoading] = useState(false);
  const [matchingCount, setMatchingCount] = useState(0);
  const [matchingAmountRange, setMatchingAmountRange] = useState<{ min?: number | null; max?: number | null }>({});

  const [confirmUpdateOpen, setConfirmUpdateOpen] = useState(false);
  const [confirmMatchCount, setConfirmMatchCount] = useState(0);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const parseAmountValue = (value: string) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parseCents(parsed) : null;
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

  const currentAmountBasis = useMemo(() => {
    if (matchingTransactions.length > 0) {
      const first = matchingTransactions[0];
      const mainAmount = first.amount_in_main_currency;
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
  }, [activeRule, matchingAmountRange.max, matchingAmountRange.min, matchingTransactions]);

  useEffect(() => {
    if (!isOpen) return;
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
        const [amountRange, res] = await Promise.all([
          (window as any).go.main.App.GetRuleAmountRange(matchValue.trim(), matchType),
          (window as any).go.main.App.PreviewRuleMatches(matchValue.trim(), matchType, amountMin, amountMax),
        ]);
        if (!cancelled) {
          setMatchingTransactions(res?.transactions || []);
          setMatchingCount(res?.count || 0);
          setMatchingAmountRange({ min: amountRange?.min ?? null, max: amountRange?.max ?? null });
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
  }, [amountFilter, buildAmountBounds, currentAmountBasis, isOpen, matchType, matchValue]);

  const deriveAmountFilter = (rule: RuleRow): AmountFilter => {
    const min = rule.amount_min ?? null;
    const max = rule.amount_max ?? null;

    if (min === null && max === null) {
      return { operator: 'none', value1: '', value2: '' };
    }

    if (min !== null && max !== null) {
      const absMin = Math.abs(min) / 100;
      const absMax = Math.abs(max) / 100;
      return {
        operator: 'between',
        value1: String(Math.min(absMin, absMax)),
        value2: String(Math.max(absMin, absMax)),
      };
    }

    if (min !== null) {
      return {
        operator: min < 0 ? 'lt' : 'gt',
        value1: String(Math.abs(min) / 100),
        value2: '',
      };
    }

    return {
      operator: max !== null && max < 0 ? 'gt' : 'lt',
      value1: String(Math.abs(max || 0) / 100),
      value2: '',
    };
  };

  const resetEditorState = useCallback(() => {
    setMatchType('contains');
    setMatchValue('');
    setCategoryInput('');
    setCategoryId(0);
    setAmountFilter({ operator: 'none', value1: '', value2: '' });
    setMatchingTransactions([]);
    setMatchingCount(0);
    setMatchingAmountRange({});
    setMatchingLoading(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    if (activeRule) {
      setMatchType(activeRule.match_type);
      setMatchValue(activeRule.match_value);
      setCategoryInput(activeRule.category_name || '');
      setCategoryId(activeRule.category_id || 0);
      setAmountFilter(deriveAmountFilter(activeRule));
    } else {
      resetEditorState();
    }
  }, [activeRule, isOpen, resetEditorState]);

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

  const handleClose = () => {
    setConfirmUpdateOpen(false);
    setConfirmMatchCount(0);
    setConfirmLoading(false);
    onClose();
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
      handleClose();
      onSaved();
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
      handleClose();
      onSaved();
    } catch (e) {
      console.error('Failed to update rule', e);
      toast.showToast('Failed to update rule', 'error');
    } finally {
      setConfirmUpdateOpen(false);
    }
  };

  const openUpdateConfirm = async () => {
    if (!activeRule) return;
    setConfirmUpdateOpen(true);
    setConfirmMatchCount(0);
    setConfirmLoading(true);
    try {
      const count = await (window as any).go.main.App.GetRuleMatchCount(activeRule.id);
      setConfirmMatchCount(count || 0);
    } catch (e) {
      console.error('Failed to fetch rule match count', e);
      setConfirmMatchCount(0);
    } finally {
      setConfirmLoading(false);
    }
  };

  const selectionRule: SelectionRule = {
    text: matchValue,
    mode: matchType,
  };

  const matchingPreview = matchingTransactions.map((tx) => ({
    ...tx,
    main_amount: tx.amount_in_main_currency,
  }));

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
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
            showCategoryColumn
            showCategoryHint={false}
          />

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={handleClose}>Cancel</Button>
            {activeRule ? (
              <Button onClick={openUpdateConfirm}>Save Changes</Button>
            ) : (
              <Button onClick={handleSaveRule}>Save Rule</Button>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={confirmUpdateOpen}
        onClose={() => setConfirmUpdateOpen(false)}
        title="Update Rule"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-canvas-600 select-none">Choose how to apply your updated rule.</p>
          <div className="text-xs text-canvas-500 select-none">
            {confirmLoading ? 'Checking matches...' : `${confirmMatchCount} matching transaction${confirmMatchCount !== 1 ? 's' : ''}`}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmUpdateOpen(false)}>Cancel</Button>
            <Button variant="secondary" onClick={() => handleUpdateRule(false)}>Update Rule Only</Button>
            <Button onClick={() => handleUpdateRule(true)}>
              Update + Recategorize ({confirmMatchCount})
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default RuleEditorModal;
