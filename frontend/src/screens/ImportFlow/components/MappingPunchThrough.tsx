import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  DollarSign,
  FileText,
  CreditCard,
  User,
  Globe,
  ArrowRight,
  ChevronLeft,
  ArrowUpDown,
} from 'lucide-react';

import { Button, Card, Input, Select, AutocompleteInput } from '../../../components';
import { type ImportMapping, type AmountMapping } from './ColumnMapperTypes';
import { useColumnMapping } from './useColumnMapping';
import { sampleUniqueRows } from '../utils';

interface MappingPunchThroughProps {
  csvHeaders: string[];
  rows: string[][];
  fileCount: number;
  onComplete: (mapping: ImportMapping) => void;
  initialMapping?: ImportMapping | null;
}

type StepKey = 'date' | 'amount' | 'description' | 'account' | 'owner' | 'currency';

type Step = {
  key: StepKey;
  label: string;
  instruction: string;
  icon: React.ElementType;
  optional?: boolean;
};

const STEPS: Step[] = [
  {
    key: 'date',
    label: 'Date',
    instruction: 'Click the column that contains the transaction date.',
    icon: Calendar,
  },
  {
    key: 'amount',
    label: 'Amount',
    instruction: 'Click the amount column (or map Debit/Credit).',
    icon: DollarSign,
  },
  {
    key: 'description',
    label: 'Description',
    instruction: 'Click one or more columns to build the transaction description.',
    icon: FileText,
  },
  {
    key: 'account',
    label: 'Account',
    instruction: 'Pick a static account (fast) or map an Account column (flexible).',
    icon: CreditCard,
  },
  {
    key: 'owner',
    label: 'Owner',
    instruction: 'Optional: pick a default owner or map an Owner column.',
    icon: User,
    optional: true,
  },
  {
    key: 'currency',
    label: 'Currency',
    instruction: 'Optional: keep a default currency or map a Currency column.',
    icon: Globe,
    optional: true,
  },
];

const CURRENCY_OPTIONS = [
  { value: 'CAD', label: 'CAD' },
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'GBP', label: 'GBP' },
];

export const MappingPunchThrough: React.FC<MappingPunchThroughProps> = ({
  csvHeaders,
  rows,
  fileCount,
  onComplete,
  initialMapping,
}) => {
  const {
    mapping,
    setMapping,
    assignHeaderToField,
    removeHeaderEverywhere,
    canProceed,
    isMissing,
    isAmountMappingValid,
    handleAmountMappingTypeChange,
    assignAmountMappingColumn,
  } = useColumnMapping(initialMapping || undefined);

  const mappingRef = useRef(mapping);
  useEffect(() => {
    mappingRef.current = mapping;
  }, [mapping]);

  const getStartStepIdx = (m: ImportMapping) => {
    const idx = (key: StepKey) => Math.max(0, STEPS.findIndex((s) => s.key === key));

    if (!m.csv.date) return idx('date');

    const am = m.csv.amountMapping;
    const amountOk = (() => {
      if (!am) return m.csv.amount.trim().length > 0;
      if (am.type === 'single') return am.column.trim().length > 0;
      if (am.type === 'debitCredit') return !!(am.debitColumn || am.creditColumn);
      return !!(am.amountColumn && am.typeColumn);
    })();

    if (!amountOk) return idx('amount');
    if (m.csv.description.length === 0) return idx('description');

    const hasAccount = m.account.trim().length > 0 || (m.csv.account ?? '').trim().length > 0;
    if (!hasAccount) return idx('account');

    return idx('owner');
  };

  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [hoveredColIdx, setHoveredColIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!initialMapping) return;
    setCurrentStepIdx(getStartStepIdx(initialMapping));
  }, [initialMapping]);

  const currentStep = STEPS[currentStepIdx];

  const mappedHeaders = useMemo(() => {
    const set = new Set<string>();
    const { csv } = mapping;
    if (csv.date) set.add(csv.date);
    if (csv.amount) set.add(csv.amount);
    if (csv.account) set.add(csv.account);
    if (csv.owner) set.add(csv.owner);
    if (csv.currency) set.add(csv.currency);
    csv.description.forEach((h) => set.add(h));
    const am = csv.amountMapping;
    if (am) {
      if (am.type === 'single' && am.column) set.add(am.column);
      if (am.type === 'debitCredit') {
        if (am.debitColumn) set.add(am.debitColumn);
        if (am.creditColumn) set.add(am.creditColumn);
      }
      if (am.type === 'amountWithType') {
        if (am.amountColumn) set.add(am.amountColumn);
        if (am.typeColumn) set.add(am.typeColumn);
      }
    }
    return set;
  }, [mapping]);

  const visibleColumnIndexes = useMemo(() => {
    if (csvHeaders.length === 0) return [];
    if (rows.length === 0) return csvHeaders.map((_, idx) => idx);

    return csvHeaders
      .map((header, idx) => ({ header, idx }))
      .filter(({ header, idx }) => {
        const hasValue = rows.some((row) => (row[idx] ?? '').trim().length > 0);
        const isMapped = header ? mappedHeaders.has(header) : false;
        return hasValue || isMapped;
      })
      .map(({ idx }) => idx);
  }, [csvHeaders, rows, mappedHeaders]);

  const visibleColumns = useMemo(
    () => visibleColumnIndexes.map((idx) => ({ header: csvHeaders[idx], index: idx })),
    [visibleColumnIndexes, csvHeaders]
  );

  const previewRows = useMemo(() => {
    const unique = sampleUniqueRows(rows, 5, (r) => r.join('\u0000'));
    return unique.map((r) => visibleColumnIndexes.map((idx) => r[idx] ?? ''));
  }, [rows, visibleColumnIndexes]);

  const [amountAssignTarget, setAmountAssignTarget] = useState<
    'single' | 'debitColumn' | 'creditColumn' | 'amountColumn' | 'typeColumn'
  >('single');

  useEffect(() => {
    if (currentStep.key !== 'amount') return;

    const am = mapping.csv.amountMapping ?? { type: 'single', column: '' };
    if (am.type === 'single') {
      setAmountAssignTarget('single');
      return;
    }

    if (am.type === 'debitCredit') {
      if (!am.debitColumn) setAmountAssignTarget('debitColumn');
      else if (!am.creditColumn) setAmountAssignTarget('creditColumn');
      else setAmountAssignTarget('debitColumn');
      return;
    }

    if (am.type === 'amountWithType') {
      if (!am.amountColumn) setAmountAssignTarget('amountColumn');
      else if (!am.typeColumn) setAmountAssignTarget('typeColumn');
      else setAmountAssignTarget('amountColumn');
    }
  }, [currentStep.key, mapping.csv.amountMapping]);

  const [availableAccounts, setAvailableAccounts] = useState<string[]>([]);
  const [availableOwners, setAvailableOwners] = useState<string[]>([]);

  const [accountInput, setAccountInput] = useState('');
  const [ownerInput, setOwnerInput] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [dbAccounts, dbOwners]: [string[], string[]] = await Promise.all([
          (window as any).go.main.App.GetAccounts(),
          (window as any).go.main.App.GetOwners(),
        ]);
        setAvailableAccounts(dbAccounts || []);
        setAvailableOwners(dbOwners || []);
      } catch (e) {
        console.error('Failed to load accounts/owners', e);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (currentStep.key === 'account') {
      setAccountInput(mapping.account || '');
    }
    if (currentStep.key === 'owner') {
      setOwnerInput(mapping.defaultOwner || '');
    }
  }, [currentStep.key, mapping.account, mapping.defaultOwner]);

  const handleAdvance = async () => {
    if (currentStep.key === 'account') {
      const name = accountInput.trim();
      if (name && !availableAccounts.includes(name)) {
        try {
          await (window as any).go.main.App.CreateAccount(name);
          setAvailableAccounts((prev) => [...prev, name].sort((a, b) => a.localeCompare(b)));
        } catch (e) {
          console.error('Failed to create account', e);
        }
      }
    }

    if (currentStep.key === 'owner') {
      const name = ownerInput.trim();
      if (name && !availableOwners.includes(name)) {
        try {
          await (window as any).go.main.App.CreateOwner(name);
          setAvailableOwners((prev) => [...prev, name].sort((a, b) => a.localeCompare(b)));
        } catch (e) {
          console.error('Failed to create owner', e);
        }
      }
    }

    if (currentStepIdx >= STEPS.length - 1) {
      onComplete(mappingRef.current);
      return;
    }
    setCurrentStepIdx((prev) => prev + 1);
  };

  const handleBack = () => {
    if (currentStepIdx > 0) setCurrentStepIdx((prev) => prev - 1);
  };

  const getColumnStatus = (header: string): 'current' | 'other' | 'none' => {
    if (!header) return 'none';

    const { csv } = mapping;

    const isMappedTo = (step: StepKey): boolean => {
      if (step === 'date') return csv.date === header;
      if (step === 'description') return csv.description.includes(header);
      if (step === 'account') return csv.account === header;
      if (step === 'owner') return csv.owner === header;
      if (step === 'currency') return csv.currency === header;
      if (step === 'amount') {
        const am = csv.amountMapping;
        if (!am || am.type === 'single') return csv.amount === header || am?.column === header;
        if (am.type === 'debitCredit') return am.debitColumn === header || am.creditColumn === header;
        if (am.type === 'amountWithType') return am.amountColumn === header || am.typeColumn === header;
      }
      return false;
    };

    const isTarget = (): boolean => {
      if (currentStep.key === 'amount') {
        const am = csv.amountMapping;
        if (!am || am.type === 'single') return am?.column === header || csv.amount === header;
        if (am.type === 'debitCredit') {
          return amountAssignTarget === 'debitColumn' ? am.debitColumn === header : am.creditColumn === header;
        }
        if (am.type === 'amountWithType') {
          return amountAssignTarget === 'amountColumn' ? am.amountColumn === header : am.typeColumn === header;
        }
      }
      return isMappedTo(currentStep.key);
    };

    if (isTarget()) return 'current';
    if (STEPS.some((s) => isMappedTo(s.key))) return 'other';

    return 'none';
  };

  const getHeaderLabel = (header: string) => {
    if (mapping.csv.date === header) return 'Date';

    const am = mapping.csv.amountMapping;
    if (am?.type === 'single' && am.column === header) return 'Amount';
    if (am?.type === 'debitCredit') {
      if (am.debitColumn === header) return 'Debit';
      if (am.creditColumn === header) return 'Credit';
    }
    if (am?.type === 'amountWithType') {
      if (am.amountColumn === header) return 'Amount';
      if (am.typeColumn === header) return 'Type';
    }

    if (mapping.csv.description.includes(header)) return 'Desc';
    if (mapping.csv.account === header) return 'Account';
    if (mapping.csv.owner === header) return 'Owner';
    if (mapping.csv.currency === header) return 'Currency';

    return null;
  };

  const handleHeaderClick = (header: string) => {
    if (!header) return;

    const status = getColumnStatus(header);
    if (status === 'other') return;

    if (status === 'current') {
      removeHeaderEverywhere(header);
      return;
    }

    if (currentStep.key === 'date') {
      assignHeaderToField('date', header);
      return;
    }

    if (currentStep.key === 'amount') {
      const am: AmountMapping = mapping.csv.amountMapping ?? { type: 'single', column: '' };

      if (am.type === 'single') {
        assignHeaderToField('amount', header);
        return;
      }

      if (am.type === 'debitCredit') {
        const target = amountAssignTarget === 'creditColumn' ? 'creditColumn' : 'debitColumn';
        assignAmountMappingColumn(target, header);
        return;
      }

      if (am.type === 'amountWithType') {
        const target = amountAssignTarget === 'typeColumn' ? 'typeColumn' : 'amountColumn';
        assignAmountMappingColumn(target, header);
        return;
      }

      return;
    }

    if (currentStep.key === 'description') {
      assignHeaderToField('description', header);
      return;
    }

    if (currentStep.key === 'account') {
      assignHeaderToField('account', header);
      return;
    }

    if (currentStep.key === 'owner') {
      assignHeaderToField('owner', header);
      return;
    }

    if (currentStep.key === 'currency') {
      assignHeaderToField('currency', header);
    }
  };

  const toggleInvertSign = () => {
    setMapping((prev) => {
      const fallbackColumn = prev.csv.amount || '';
      const prevAm: AmountMapping = prev.csv.amountMapping ?? { type: 'single', column: fallbackColumn, invertSign: false };
      const nextAm: AmountMapping = { ...prevAm, invertSign: !prevAm.invertSign };
      return {
        ...prev,
        csv: {
          ...prev.csv,
          amountMapping: nextAm,
          amount: nextAm.type === 'single' ? nextAm.column : prev.csv.amount,
        },
      };
    });
  };


  const canGoNext = useMemo(() => {
    if (currentStep.key === 'date') return !isMissing('date');
    if (currentStep.key === 'amount') return isAmountMappingValid;
    if (currentStep.key === 'description') return !isMissing('description');
    if (currentStep.key === 'account') return !isMissing('account');
    if (currentStep.key === 'owner' || currentStep.key === 'currency') return canProceed;
    return true;
  }, [currentStep.key, isAmountMappingValid, isMissing, canProceed]);

  const amountMappingType = mapping.csv.amountMapping?.type ?? 'single';
  const invertSignEnabled = mapping.csv.amountMapping?.invertSign ?? false;

  return (
    <div className="flex flex-col gap-6 animate-snap-in">
      <Card variant="glass" className="p-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-brand/10 text-brand rounded-xl">
              <currentStep.icon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-canvas-800">{currentStep.label}</h2>
                <span className="text-xs font-mono text-canvas-500 uppercase tracking-widest">
                  {currentStepIdx + 1} / {STEPS.length}
                </span>
              </div>
              <p className="text-canvas-500">{currentStep.instruction}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleBack} disabled={currentStepIdx === 0}>
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleAdvance}
              disabled={!canGoNext}
            >
              {currentStepIdx === STEPS.length - 1 ? 'Continue' : 'Next'} <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {currentStep.key === 'amount' && (
          <div className="mt-6 space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                className={
                  'px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ' +
                  (amountMappingType === 'single'
                    ? 'bg-brand text-white border-brand'
                    : 'bg-canvas-50 text-canvas-700 border-canvas-300 hover:border-canvas-600')
                }
                onClick={() => handleAmountMappingTypeChange('single')}
                type="button"
              >
                Single column
              </button>
              <button
                className={
                  'px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ' +
                  (amountMappingType === 'debitCredit'
                    ? 'bg-brand text-white border-brand'
                    : 'bg-canvas-50 text-canvas-700 border-canvas-300 hover:border-canvas-600')
                }
                onClick={() => handleAmountMappingTypeChange('debitCredit')}
                type="button"
              >
                Debit / Credit
              </button>
              <button
                className={
                  'px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ' +
                  (amountMappingType === 'amountWithType'
                    ? 'bg-brand text-white border-brand'
                    : 'bg-canvas-50 text-canvas-700 border-canvas-300 hover:border-canvas-600')
                }
                onClick={() => handleAmountMappingTypeChange('amountWithType')}
                type="button"
              >
                Amount + Type
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={toggleInvertSign}
                className={
                  'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ' +
                  (invertSignEnabled
                    ? 'bg-brand text-white border-brand'
                    : 'bg-canvas-50 text-canvas-700 border-canvas-300 hover:border-canvas-600')
                }
              >
                <ArrowUpDown className="w-4 h-4" />
                {invertSignEnabled ? 'Flip sign: On' : 'Flip sign: Off'}
              </button>
              <span className="text-xs text-canvas-500">
                Turn on if your file shows expenses as positive numbers.
              </span>
            </div>

            {amountMappingType === 'debitCredit' && (
              <div className="grid gap-3 p-4 bg-canvas-100 rounded-xl border border-canvas-200">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setAmountAssignTarget('debitColumn')}
                    className={
                      'px-3 py-1.5 rounded-lg border text-sm font-semibold transition-colors ' +
                      (amountAssignTarget === 'debitColumn'
                        ? 'bg-brand/10 border-brand text-brand'
                        : 'bg-canvas-50 border-canvas-300 text-canvas-700 hover:border-canvas-600')
                    }
                  >
                    Debit column
                  </button>
                  <span className="text-sm text-canvas-600 font-mono">
                    {mapping.csv.amountMapping?.type === 'debitCredit' ? mapping.csv.amountMapping.debitColumn || '—' : '—'}
                  </span>
                  {mapping.csv.amountMapping?.type === 'debitCredit' && mapping.csv.amountMapping.debitColumn && (
                    <button
                      type="button"
                      onClick={() => removeHeaderEverywhere(mapping.csv.amountMapping?.type === 'debitCredit' ? mapping.csv.amountMapping.debitColumn || '' : '')}
                      className="text-xs font-semibold text-canvas-500 hover:text-canvas-800"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setAmountAssignTarget('creditColumn')}
                    className={
                      'px-3 py-1.5 rounded-lg border text-sm font-semibold transition-colors ' +
                      (amountAssignTarget === 'creditColumn'
                        ? 'bg-brand/10 border-brand text-brand'
                        : 'bg-canvas-50 border-canvas-300 text-canvas-700 hover:border-canvas-600')
                    }
                  >
                    Credit column
                  </button>
                  <span className="text-sm text-canvas-600 font-mono">
                    {mapping.csv.amountMapping?.type === 'debitCredit' ? mapping.csv.amountMapping.creditColumn || '—' : '—'}
                  </span>
                  {mapping.csv.amountMapping?.type === 'debitCredit' && mapping.csv.amountMapping.creditColumn && (
                    <button
                      type="button"
                      onClick={() => removeHeaderEverywhere(mapping.csv.amountMapping?.type === 'debitCredit' ? mapping.csv.amountMapping.creditColumn || '' : '')}
                      className="text-xs font-semibold text-canvas-500 hover:text-canvas-800"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="text-xs text-canvas-500">
                  Tip: you can proceed with just one of these mapped. Use Next when you're happy.
                </div>
              </div>
            )}

            {amountMappingType === 'amountWithType' && (
              <div className="grid gap-3 p-4 bg-canvas-100 rounded-xl border border-canvas-200">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setAmountAssignTarget('amountColumn')}
                    className={
                      'px-3 py-1.5 rounded-lg border text-sm font-semibold transition-colors ' +
                      (amountAssignTarget === 'amountColumn'
                        ? 'bg-brand/10 border-brand text-brand'
                        : 'bg-canvas-50 border-canvas-300 text-canvas-700 hover:border-canvas-600')
                    }
                  >
                    Amount column
                  </button>
                  <span className="text-sm text-canvas-600 font-mono">
                    {mapping.csv.amountMapping?.type === 'amountWithType' ? (mapping.csv.amountMapping as any).amountColumn || '—' : '—'}
                  </span>
                  {mapping.csv.amountMapping?.type === 'amountWithType' && (mapping.csv.amountMapping as any).amountColumn && (
                    <button
                      type="button"
                      onClick={() => removeHeaderEverywhere((mapping.csv.amountMapping as any).amountColumn)}
                      className="text-xs font-semibold text-canvas-500 hover:text-canvas-800"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setAmountAssignTarget('typeColumn')}
                    className={
                      'px-3 py-1.5 rounded-lg border text-sm font-semibold transition-colors ' +
                      (amountAssignTarget === 'typeColumn'
                        ? 'bg-brand/10 border-brand text-brand'
                        : 'bg-canvas-50 border-canvas-300 text-canvas-700 hover:border-canvas-600')
                    }
                  >
                    Type column
                  </button>
                  <span className="text-sm text-canvas-600 font-mono">
                    {mapping.csv.amountMapping?.type === 'amountWithType' ? (mapping.csv.amountMapping as any).typeColumn || '—' : '—'}
                  </span>
                  {mapping.csv.amountMapping?.type === 'amountWithType' && (mapping.csv.amountMapping as any).typeColumn && (
                    <button
                      type="button"
                      onClick={() => removeHeaderEverywhere((mapping.csv.amountMapping as any).typeColumn)}
                      className="text-xs font-semibold text-canvas-500 hover:text-canvas-800"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {mapping.csv.amountMapping?.type === 'amountWithType' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10px] font-bold text-canvas-500 uppercase tracking-wider mb-1">Negative value</div>
                      <Input
                        value={mapping.csv.amountMapping.negativeValue ?? 'debit'}
                        onChange={(e) =>
                          setMapping((prev) => {
                            const am = prev.csv.amountMapping;
                            if (!am || am.type !== 'amountWithType') return prev;
                            return {
                              ...prev,
                              csv: {
                                ...prev.csv,
                                amountMapping: { ...am, negativeValue: e.target.value },
                              },
                            };
                          })
                        }
                        placeholder="debit"
                      />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-canvas-500 uppercase tracking-wider mb-1">Positive value</div>
                      <Input
                        value={mapping.csv.amountMapping.positiveValue ?? 'credit'}
                        onChange={(e) =>
                          setMapping((prev) => {
                            const am = prev.csv.amountMapping;
                            if (!am || am.type !== 'amountWithType') return prev;
                            return {
                              ...prev,
                              csv: {
                                ...prev.csv,
                                amountMapping: { ...am, positiveValue: e.target.value },
                              },
                            };
                          })
                        }
                        placeholder="credit"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {currentStep.key === 'description' && (
          <div className="mt-6 min-h-[44px] flex flex-wrap gap-2 items-center border-t border-canvas-100 pt-4">
            {mapping.csv.description.length === 0 ? (
              <span className="text-xs text-canvas-400 italic">No columns selected yet...</span>
            ) : (
              mapping.csv.description.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => removeHeaderEverywhere(h)}
                  className="px-2 py-1 rounded-lg bg-brand/10 text-brand border border-brand/20 text-xs font-semibold animate-in zoom-in-95 duration-200"
                >
                  {h}
                </button>
              ))
            )}
          </div>
        )}

        {currentStep.key === 'account' && (
          <div className="mt-6 grid gap-4 p-4 bg-canvas-100 rounded-xl border border-canvas-200">
            <div>
              <div className="text-[10px] font-bold text-canvas-500 uppercase tracking-wider mb-2">Static account (fast)</div>
              <div className="flex items-center gap-2">
                <div className="w-full max-w-sm">
                  <AutocompleteInput
                    value={accountInput}
                    onChange={(val) => {
                      setAccountInput(val);
                      setMapping(prev => ({ ...prev, account: val, csv: { ...prev.csv, account: undefined } }));
                    }}
                    options={availableAccounts}
                    placeholder="e.g. RBC Checking"
                    className="w-full"
                  />
                </div>
              </div>
              {mapping.csv.account && (
                <div className="mt-2 text-xs text-canvas-500 flex items-center gap-2">
                  Currently mapped from file: <span className="font-mono">{mapping.csv.account}</span>
                  <button
                    type="button"
                    onClick={() => removeHeaderEverywhere(mapping.csv.account || '')}
                    className="text-[10px] font-semibold text-brand hover:underline"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            <div className="border-t border-canvas-200 pt-3 text-xs text-canvas-500">
              Or click a column header to map account per-row.
            </div>
          </div>
        )}

        {currentStep.key === 'owner' && (
          <div className="mt-6 grid gap-4 p-4 bg-canvas-100 rounded-xl border border-canvas-200">
            <div>
              <div className="text-[10px] font-bold text-canvas-500 uppercase tracking-wider mb-2">Default owner</div>
              <div className="flex items-center gap-2">
                <div className="w-full max-w-sm">
                  <AutocompleteInput
                    value={ownerInput}
                    onChange={(val) => {
                      setOwnerInput(val);
                      setMapping(prev => ({ ...prev, defaultOwner: val, csv: { ...prev.csv, owner: undefined } }));
                    }}
                    options={availableOwners}
                    placeholder="e.g. Alex"
                    className="w-full"
                  />
                </div>
              </div>
              {mapping.csv.owner && (
                <div className="mt-2 text-xs text-canvas-500 flex items-center gap-2">
                  Currently mapped from file: <span className="font-mono">{mapping.csv.owner}</span>
                  <button
                    type="button"
                    onClick={() => removeHeaderEverywhere(mapping.csv.owner || '')}
                    className="text-[10px] font-semibold text-brand hover:underline"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            <div className="border-t border-canvas-200 pt-3 text-xs text-canvas-500">Or click a column header to map owner per-row.</div>
          </div>
        )}

        {currentStep.key === 'currency' && (
          <div className="mt-6 grid gap-3 p-4 bg-canvas-100 rounded-xl border border-canvas-200">
            <div>
              <div className="text-[10px] font-bold text-canvas-500 uppercase tracking-wider mb-2">Default currency</div>
              <Select
                value={mapping.currencyDefault}
                onChange={(e) => setMapping((prev) => ({ ...prev, currencyDefault: e.target.value }))}
                options={CURRENCY_OPTIONS}
              />
              {mapping.csv.currency && (
                <div className="mt-2 text-xs text-canvas-500 flex items-center gap-2">
                  Currently mapped from file: <span className="font-mono">{mapping.csv.currency}</span>
                  <button
                    type="button"
                    onClick={() => removeHeaderEverywhere(mapping.csv.currency || '')}
                    className="text-[10px] font-semibold text-brand hover:underline"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            <div className="border-t border-canvas-200 pt-3 text-xs text-canvas-500">Or click a column header to map currency per-row.</div>
          </div>
        )}

        {!canProceed && currentStepIdx >= STEPS.findIndex((s) => s.key === 'account') && (
          <div className="mt-6 text-xs text-canvas-500">
            Required to continue: Date, Amount, Description, and Account.
          </div>
        )}
      </Card>

      <div className={`bg-canvas-50 rounded-2xl border transition-all duration-300 overflow-hidden shadow-sm ${hoveredColIdx !== null ? 'border-brand/40 ring-1 ring-brand/10' : 'border-canvas-200'}`}>
        <div className="px-6 py-3 bg-canvas-100 border-b border-canvas-200 flex justify-between items-center">
          <span className="text-xs font-bold text-canvas-500 uppercase tracking-widest">
            File preview ({fileCount} file{fileCount === 1 ? '' : 's'})
          </span>
          <div className="flex items-center gap-2 px-2 py-1 bg-brand/10 border border-brand/20 rounded-lg animate-in fade-in slide-in-from-right-2">
            <div className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
            <span className="text-[10px] text-brand font-bold uppercase tracking-tight">
              Click any column to map {currentStep.label}
            </span>
          </div>
        </div>
        <div className="overflow-x-auto" onMouseLeave={() => setHoveredColIdx(null)}>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-canvas-100/50">
                {visibleColumns.map(({ header, index }, idx) => {
                  const status = getColumnStatus(header);
                  const label = getHeaderLabel(header);
                  const isHovered = hoveredColIdx === index;
                  
                  return (
                    <th
                      key={header || index}
                      onClick={() => handleHeaderClick(header)}
                      onMouseEnter={() => setHoveredColIdx(index)}
                      className={
                        'px-4 py-4 text-left text-xs font-bold uppercase tracking-wider transition-all duration-200 border-b-2 min-w-[150px] relative ' +
                        (status === 'current'
                          ? 'bg-brand/20 border-brand text-brand cursor-pointer '
                          : status === 'other'
                          ? 'bg-brand/5 border-brand/20 text-brand/40 cursor-not-allowed '
                          : isHovered
                          ? 'bg-canvas-200 border-canvas-400 text-canvas-800 cursor-pointer '
                          : 'text-canvas-600 border-transparent hover:bg-canvas-200 hover:text-canvas-800 cursor-pointer ')
                      }
                    >
                      {label ? (
                        <span
                          className={
                            'absolute -top-1 left-4 px-1.5 py-0.5 text-[8px] text-white rounded-b-sm animate-in fade-in slide-in-from-top-1 ' +
                            (status === 'current' ? 'bg-brand' : 'bg-brand/40')
                          }
                        >
                          {label}
                        </span>
                      ) : (
                        isHovered && status === 'none' && (
                          <span className="absolute -top-1 left-4 px-1.5 py-0.5 text-[8px] bg-brand/60 text-white rounded-b-sm animate-in fade-in slide-in-from-top-1">
                            Map as {currentStep.label}
                          </span>
                        )
                      )}
                      <span>{header}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-canvas-200">
              {previewRows.map((row, i) => (
                <tr key={i} className="hover:bg-canvas-100/30 transition-colors">
                  {visibleColumns.map(({ header, index }, j) => {
                    const status = getColumnStatus(header);
                    const isHovered = hoveredColIdx === index;
                    
                    const cellClass =
                      status === 'current'
                        ? 'bg-brand/10 text-brand cursor-pointer'
                        : status === 'other'
                        ? 'bg-brand/[0.02] text-brand/40 cursor-not-allowed'
                        : isHovered
                        ? 'bg-brand/5 text-brand/80 cursor-pointer'
                        : 'text-canvas-600 cursor-pointer hover:bg-canvas-200/50';
                        
                    const cell = row[j] ?? '';
                    return (
                      <td
                        key={header || j}
                        onClick={() => handleHeaderClick(header)}
                        onMouseEnter={() => setHoveredColIdx(index)}
                        className={`px-4 py-3 text-sm whitespace-nowrap transition-colors ${cellClass}`}
                      >
                        {cell}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
