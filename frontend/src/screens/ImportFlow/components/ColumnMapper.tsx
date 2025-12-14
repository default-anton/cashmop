import React, { useMemo, useState, useEffect } from 'react';
import { ArrowRight, Save, X } from 'lucide-react';
import {
  DropTarget,
  FieldMeta,
  SingleMappingPill,
  DragReorderableList,
  Button,
  Select,
  Input,
  Card
} from '../../../components';

const LOCAL_STORAGE_KEY = 'cashflow.savedMappings';
const ACCOUNTS_LOCAL_STORAGE_KEY = 'cashflow.accounts';
const OWNERS_LOCAL_STORAGE_KEY = 'cashflow.owners';

type CsvFieldKey = 'date' | 'description' | 'amount' | 'owner' | 'currency' | 'debit' | 'credit' | 'amountColumn' | 'typeColumn';

type AmountMapping =
  | { type: 'single'; column: string }
  | { type: 'debitCredit'; debitColumn?: string; creditColumn?: string }
  | { type: 'amountWithType'; amountColumn: string; typeColumn: string; negativeValue?: string; positiveValue?: string };

export type ImportMapping = {
  csv: {
    date: string;
    description: string[];
    amount: string; // legacy, keep for backward compatibility
    amountMapping?: AmountMapping;
    owner?: string;
    currency?: string;
  };
  account: string;
  defaultOwner?: string;
  currencyDefault: string; // Used when csv.currency is not set
};

interface ColumnMapperProps {
  csvHeaders: string[];
  excelMock?: boolean;
  fileCount?: number;
  onComplete: (mapping: ImportMapping) => void;
}

type SavedMapping = {
  id: string;
  name: string;
  mapping: ImportMapping;
};

const defaultMapping = (): ImportMapping => ({
  csv: {
    date: '',
    description: [],
    amount: '',
    amountMapping: { type: 'single', column: '' },
  },
  account: '',
  currencyDefault: 'CAD',
});

const ColumnMapper: React.FC<ColumnMapperProps> = ({ csvHeaders, excelMock, fileCount = 1, onComplete }) => {
  const [mapping, setMapping] = useState<ImportMapping>(() => defaultMapping());
  const [activeDropKey, setActiveDropKey] = useState<CsvFieldKey | null>(null);
  const [attemptedNext, setAttemptedNext] = useState(false);

  const [savedMappings, setSavedMappings] = useState<SavedMapping[]>(() => [
    {
      id: 'rbc-bank',
      name: 'RBC Bank (Saved)',
      mapping: {
        csv: {
          date: 'Transaction Date',
          description: ['Description 1'],
          amount: 'Debit',
          amountMapping: { type: 'single', column: 'Debit' },
          owner: 'Card Member',
        },
        account: 'RBC Checking',
        currencyDefault: 'CAD',
      },
    },
    {
      id: 'td-visa',
      name: 'TD Visa (Saved)',
      mapping: {
        csv: {
          date: 'Posting Date',
          description: ['Description 1'],
          amount: 'Credit',
          amountMapping: { type: 'single', column: 'Credit' },
        },
        account: 'TD Visa',
        currencyDefault: 'CAD',
      },
    },
  ]);

  const [availableAccounts, setAvailableAccounts] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(ACCOUNTS_LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load accounts from localStorage', e);
    }
    return ['RBC Checking', 'TD Visa', 'Wealthsimple Cash'];
  });

  const [availableOwners, setAvailableOwners] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(OWNERS_LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load owners from localStorage', e);
    }
    return [];
  });

  const [newAccountInput, setNewAccountInput] = useState('');
  const [isAddingNewAccount, setIsAddingNewAccount] = useState(false);

  const [newOwnerInput, setNewOwnerInput] = useState('');
  const [isAddingNewOwner, setIsAddingNewOwner] = useState(false);

  // Load saved mappings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Validate structure? For now assume correct
          setSavedMappings(parsed);
        }
      }
    } catch (e) {
      console.warn('Failed to load saved mappings from localStorage', e);
    }
  }, []);

  // Save saved mappings to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(savedMappings));
    } catch (e) {
      console.warn('Failed to save mappings to localStorage', e);
    }
  }, [savedMappings]);

  // Save accounts to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(ACCOUNTS_LOCAL_STORAGE_KEY, JSON.stringify(availableAccounts));
    } catch (e) {
      console.warn('Failed to save accounts to localStorage', e);
    }
  }, [availableAccounts]);

  // Save owners to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(OWNERS_LOCAL_STORAGE_KEY, JSON.stringify(availableOwners));
    } catch (e) {
      console.warn('Failed to save owners to localStorage', e);
    }
  }, [availableOwners]);

  const [selectedMappingId, setSelectedMappingId] = useState<string>('new');
  const [saveName, setSaveName] = useState('');

  const usedHeaders = useMemo(() => {
    const used = new Set<string>();
    if (mapping.csv.date) used.add(mapping.csv.date);
    if (mapping.csv.amount) used.add(mapping.csv.amount);
    if (mapping.csv.owner) used.add(mapping.csv.owner);
    if (mapping.csv.currency) used.add(mapping.csv.currency);
    mapping.csv.description.forEach((h) => used.add(h));
    // Add columns from amountMapping
    const am = mapping.csv.amountMapping;
    if (am) {
      if (am.type === 'single' && am.column) used.add(am.column);
      if (am.type === 'debitCredit') {
        if (am.debitColumn) used.add(am.debitColumn);
        if (am.creditColumn) used.add(am.creditColumn);
      }
      if (am.type === 'amountWithType') {
        if (am.amountColumn) used.add(am.amountColumn);
        if (am.typeColumn) used.add(am.typeColumn);
      }
    }
    return used;
  }, [mapping]);

  const isAmountMappingValid = useMemo(() => {
    const am = mapping.csv.amountMapping;
    if (!am) return mapping.csv.amount.trim().length > 0; // legacy
    switch (am.type) {
      case 'single':
        return am.column.trim().length > 0;
      case 'debitCredit':
        return !!(am.debitColumn || am.creditColumn);
      case 'amountWithType':
        return !!(am.amountColumn && am.typeColumn);
    }
  }, [mapping.csv.amountMapping, mapping.csv.amount]);

  const amountMappingType = mapping.csv.amountMapping?.type ?? 'single';

  const isMissing = (key: 'date' | 'description' | 'amount' | 'account') => {
    if (key === 'account') return mapping.account.trim().length === 0;
    if (key === 'description') return mapping.csv.description.length === 0;
    if (key === 'amount') return !isAmountMappingValid;
    return (mapping.csv[key] ?? '').trim().length === 0;
  };

  const canProceed = useMemo(() => {
    const dateOk = mapping.csv.date.trim().length > 0;
    const descriptionOk = mapping.csv.description.length > 0;
    const amountOk = isAmountMappingValid;
    const accountOk = mapping.account.trim().length > 0;
    return dateOk && descriptionOk && amountOk && accountOk;
  }, [mapping.csv.date, mapping.csv.description, mapping.account, isAmountMappingValid]);

  const removeHeaderEverywhere = (header: string) => {
    if (!header) return;

    setMapping((prev) => {
      const next: ImportMapping = {
        ...prev,
        csv: {
          ...prev.csv,
          description: prev.csv.description.filter((h) => h !== header),
        },
      };

      if (next.csv.date === header) next.csv.date = '';
      if (next.csv.amount === header) next.csv.amount = '';
      if (next.csv.owner === header) delete next.csv.owner;
      if (next.csv.currency === header) delete next.csv.currency;

      // Clear from amountMapping
      const am = next.csv.amountMapping;
      if (am) {
        switch (am.type) {
          case 'single':
            if (am.column === header) {
              next.csv.amountMapping = { type: 'single', column: '' };
              next.csv.amount = '';
            }
            break;
          case 'debitCredit':
            if (am.debitColumn === header) {
              next.csv.amountMapping = { ...am, debitColumn: undefined };
            }
            if (am.creditColumn === header) {
              next.csv.amountMapping = { ...am, creditColumn: undefined };
            }
            break;
          case 'amountWithType':
            if (am.amountColumn === header) {
              next.csv.amountMapping = { ...am, amountColumn: '' };
            }
            if (am.typeColumn === header) {
              next.csv.amountMapping = { ...am, typeColumn: '' };
            }
            break;
        }
      }

      return next;
    });
  };

  const assignHeaderToField = (field: CsvFieldKey, header: string) => {
    if (!header) return;

    setMapping((prev) => {
      const next: ImportMapping = JSON.parse(JSON.stringify(prev));

      // Ensure one-to-one mapping across fields (Description can be multi)
      const clearHeader = (h: string) => {
        if (next.csv.date === h) next.csv.date = '';
        if (next.csv.amount === h) next.csv.amount = '';
        if (next.csv.owner === h) delete next.csv.owner;
        if (next.csv.currency === h) delete next.csv.currency;
        next.csv.description = next.csv.description.filter((x) => x !== h);
        // Clear from amountMapping
        const am = next.csv.amountMapping;
        if (am) {
          switch (am.type) {
            case 'single':
              if (am.column === h) {
                next.csv.amountMapping = { type: 'single', column: '' };
                next.csv.amount = '';
              }
              break;
            case 'debitCredit':
              if (am.debitColumn === h) {
                next.csv.amountMapping = { ...am, debitColumn: undefined };
              }
              if (am.creditColumn === h) {
                next.csv.amountMapping = { ...am, creditColumn: undefined };
              }
              break;
            case 'amountWithType':
              if (am.amountColumn === h) {
                next.csv.amountMapping = { ...am, amountColumn: '' };
              }
              if (am.typeColumn === h) {
                next.csv.amountMapping = { ...am, typeColumn: '' };
              }
              break;
          }
        }
      };

      clearHeader(header);

      if (field === 'description') {
        next.csv.description = [...next.csv.description, header];
        return next;
      }

      if (field === 'date') {
        next.csv.date = header;
        return next;
      }

      if (field === 'amount') {
        // Update amountMapping to single column
        next.csv.amount = header;
        next.csv.amountMapping = { type: 'single', column: header };
        return next;
      }

      if (field === 'owner') {
        next.csv.owner = header;
        return next;
      }

      if (field === 'currency') {
        next.csv.currency = header;
        return next;
      }

      return next;
    });
  };

  const reorderDescription = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setMapping((prev) => {
      const newDescription = [...prev.csv.description];
      const [removed] = newDescription.splice(fromIndex, 1);
      newDescription.splice(toIndex, 0, removed);
      return {
        ...prev,
        csv: {
          ...prev.csv,
          description: newDescription,
        },
      };
    });
  };

  const handleAmountMappingTypeChange = (newType: AmountMapping['type']) => {
    setMapping((prev) => {
      const prevAm = prev.csv.amountMapping;
      let newAm: AmountMapping;
      // Preserve existing columns where applicable
      switch (newType) {
        case 'single':
          const column = prevAm?.type === 'single' ? prevAm.column : '';
          newAm = { type: 'single', column };
          break;
        case 'debitCredit':
          const debitColumn = prevAm?.type === 'debitCredit' ? prevAm.debitColumn : undefined;
          const creditColumn = prevAm?.type === 'debitCredit' ? prevAm.creditColumn : undefined;
          newAm = { type: 'debitCredit', debitColumn, creditColumn };
          break;
        case 'amountWithType':
          const amountColumn = prevAm?.type === 'amountWithType' ? prevAm.amountColumn : '';
          const typeColumn = prevAm?.type === 'amountWithType' ? prevAm.typeColumn : '';
          const negativeValue = prevAm?.type === 'amountWithType' ? prevAm.negativeValue ?? 'debit' : 'debit';
          const positiveValue = prevAm?.type === 'amountWithType' ? prevAm.positiveValue ?? 'credit' : 'credit';
          newAm = { type: 'amountWithType', amountColumn, typeColumn, negativeValue, positiveValue };
          break;
      }
      return {
        ...prev,
        csv: {
          ...prev.csv,
          amountMapping: newAm,
          // Keep legacy amount field in sync for single type
          amount: newAm.type === 'single' ? newAm.column : prev.csv.amount,
        },
      };
    });
  };

  const assignAmountMappingColumn = (field: 'column' | 'debitColumn' | 'creditColumn' | 'amountColumn' | 'typeColumn', header: string) => {
    if (!header) return;
    setMapping((prev) => {
      const prevAm = prev.csv.amountMapping ?? { type: 'single', column: '' };
      let newAm: AmountMapping;
      switch (prevAm.type) {
        case 'single':
          newAm = { ...prevAm, column: header };
          break;
        case 'debitCredit':
          newAm = { ...prevAm, [field]: header };
          break;
        case 'amountWithType':
          newAm = { ...prevAm, [field]: header };
          break;
        default:
          newAm = prevAm;
      }
      return {
        ...prev,
        csv: {
          ...prev.csv,
          amountMapping: newAm,
          amount: newAm.type === 'single' ? newAm.column : prev.csv.amount,
        },
      };
    });
  };

  const updateAmountWithTypeValues = (field: 'negativeValue' | 'positiveValue', value: string) => {
    setMapping((prev) => {
      const prevAm = prev.csv.amountMapping;
      if (!prevAm || prevAm.type !== 'amountWithType') return prev;
      const newAm = { ...prevAm, [field]: value };
      return {
        ...prev,
        csv: {
          ...prev.csv,
          amountMapping: newAm,
        },
      };
    });
  };

  const handleNext = () => {
    setAttemptedNext(true);
    if (!canProceed) return;
    onComplete(mapping);
  };

  const handleSelectSavedMapping = (id: string) => {
    setSelectedMappingId(id);

    if (id === 'new') {
      setMapping(defaultMapping());
      setSaveName('');
      setAttemptedNext(false);
      return;
    }

    const found = savedMappings.find((m) => m.id === id);
    if (!found) return;
    setMapping(found.mapping);
    setSaveName('');
    setAttemptedNext(false);
  };

  const handleSaveMapping = () => {
    const name = saveName.trim();
    if (!name) return;

    const id = `saved-${Date.now()}`;
    const entry: SavedMapping = {
      id,
      name: `${name} (Saved)`,
      mapping,
    };

    setSavedMappings((prev) => [entry, ...prev]);
    setSelectedMappingId(id);
    setSaveName('');
  };

  return (
    <Card variant="glass" className="overflow-hidden animate-snap-in">
      <div className="bg-canvas-100 p-4 border-b border-canvas-200 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h2 className="font-bold text-canvas-800">Map Columns</h2>
          <div className="h-4 w-px bg-canvas-300 mx-2" />
          <Select
            value={selectedMappingId}
            onChange={(e) => handleSelectSavedMapping(e.target.value)}
            options={[
              { value: 'new', label: 'New Mapping...' },
              ...savedMappings.map(m => ({ value: m.id, label: m.name }))
            ]}
            className="bg-canvas-50"
          />
        </div>

        <Button
          onClick={handleNext}
          disabled={!canProceed}
          variant="primary"
          size="md"
          className="flex items-center gap-2"
        >
          Next Step <ArrowRight className="w-4 h-4" />
        </Button>
      </div>

      {excelMock && (
        <div className="px-6 py-3 bg-brand/10 border-b border-brand/30 text-sm text-canvas-700">
          Excel parsing is mocked for now. We extracted placeholder headers so you can continue the flow.
        </div>
      )}

      {fileCount > 1 && (
        <div className="px-6 py-3 bg-canvas-200/50 border-b border-canvas-300 text-sm text-canvas-600">
          Mapping will be applied to all {fileCount} files.
        </div>
      )}

      <div className="flex h-[560px]">
        <div className="w-1/3 bg-canvas-50 p-6 border-r border-canvas-200 overflow-y-auto">
          <h3 className="text-xs font-mono uppercase text-canvas-500 mb-4 tracking-wider">Found in File</h3>
          <div className="space-y-3">
            {csvHeaders.map((header) => {
              const isUsed = usedHeaders.has(header);
              return (
                <div
                  key={header}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', header);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  className={
                    'p-3 border rounded-lg cursor-grab active:cursor-grabbing transition-colors shadow-sm group ' +
                    (isUsed
                      ? 'bg-canvas-50 border-canvas-200 text-canvas-600'
                      : 'bg-canvas-200 border-canvas-300 hover:border-canvas-500')
                  }
                  title={isUsed ? 'Already mapped (dropping elsewhere will move it)' : 'Drag to map'}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm">{header}</span>
                    <div className={
                      'w-1.5 h-1.5 rounded-full transition-colors ' +
                      (isUsed ? 'bg-canvas-300' : 'bg-canvas-600 group-hover:bg-brand')
                    } />
                  </div>
                </div>
              );
            })}

            {csvHeaders.length === 0 && (
              <div className="text-sm text-canvas-500">No headers found.</div>
            )}
          </div>
        </div>

        <div className="w-2/3 bg-canvas-100/50 p-6 overflow-y-auto">
          <h3 className="text-xs font-mono uppercase text-canvas-500 mb-4 tracking-wider">App Schema</h3>

          <div className="grid gap-4">
            {/* Date */}
            <DropTarget
              isActive={activeDropKey === 'date'}
              isMissing={attemptedNext && isMissing('date')}
              onDragOver={(e) => {
                e.preventDefault();
                setActiveDropKey('date');
              }}
              onDragLeave={() => setActiveDropKey(null)}
              onDrop={(e) => {
                e.preventDefault();
                setActiveDropKey(null);
                assignHeaderToField('date', e.dataTransfer.getData('text/plain'));
              }}
            >
              <FieldMeta label="Date" required />
              <SingleMappingPill
                value={mapping.csv.date}
                placeholder="Drop column here"
                onClear={() => removeHeaderEverywhere(mapping.csv.date)}
              />
            </DropTarget>

            {/* Description (combine) */}
            <DropTarget
              isActive={activeDropKey === 'description'}
              isMissing={attemptedNext && isMissing('description')}
              className="items-start"
              onDragOver={(e) => {
                e.preventDefault();
                setActiveDropKey('description');
              }}
              onDragLeave={() => setActiveDropKey(null)}
              onDrop={(e) => {
                e.preventDefault();
                setActiveDropKey(null);
                const header = e.dataTransfer.getData('text/plain');
                if (!csvHeaders.includes(header)) {
                  return;
                }
                assignHeaderToField('description', header);
              }}
            >
              <FieldMeta label="Description" required hint="Supports combining multiple columns" />
              <div className="flex flex-col gap-2">
                {mapping.csv.description.length === 0 ? (
                  <SingleMappingPill
                    value=""
                    placeholder="Drop column(s) here"
                  />
                ) : (
                  <DragReorderableList
                    items={mapping.csv.description}
                    renderItem={(h, _index) => h}
                    onReorder={reorderDescription}
                    onRemove={(index) => {
                      const header = mapping.csv.description[index];
                      if (header) removeHeaderEverywhere(header);
                    }}
                    emptyPlaceholder={null}
                  />
                )}
                {mapping.csv.description.length >= 2 && (
                  <div className="text-xs text-canvas-500 text-right">
                    Drag columns to reorder
                  </div>
                )}
              </div>
            </DropTarget>

            {/* Amount */}
            <div className="bg-canvas-200/50 border border-canvas-300 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <FieldMeta label="Amount" required />
                <Select
                  value={amountMappingType}
                  onChange={(e) => handleAmountMappingTypeChange(e.target.value as AmountMapping['type'])}
                  options={[
                    { value: 'single', label: 'Single column' },
                    { value: 'debitCredit', label: 'Separate Debit/Credit columns' },
                    { value: 'amountWithType', label: 'Amount + Type column' }
                  ]}
                  className="bg-canvas-50"
                />
              </div>

              {amountMappingType === 'single' && (
                <DropTarget
                  isActive={activeDropKey === 'amount'}
                  isMissing={attemptedNext && isMissing('amount')}
                  className="border-dashed rounded-lg p-3"
                  onDragOver={(e) => {
                    e.preventDefault();
                    setActiveDropKey('amount');
                  }}
                  onDragLeave={() => setActiveDropKey(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setActiveDropKey(null);
                    assignHeaderToField('amount', e.dataTransfer.getData('text/plain'));
                  }}
                >
                  <SingleMappingPill
                    value={mapping.csv.amountMapping?.type === 'single' ? mapping.csv.amountMapping.column : mapping.csv.amount}
                    placeholder="Drop column here"
                    onClear={() => {
                      const col = mapping.csv.amountMapping?.type === 'single' ? mapping.csv.amountMapping.column : mapping.csv.amount;
                      if (col) removeHeaderEverywhere(col);
                    }}
                  />
                </DropTarget>
              )}

              {amountMappingType === 'debitCredit' && (
                <div className="space-y-3">
                  <DropTarget
                    isActive={activeDropKey === 'debit'}
                    className="border-dashed rounded-lg p-3"
                    onDragOver={(e) => {
                      e.preventDefault();
                      setActiveDropKey('debit');
                    }}
                    onDragLeave={() => setActiveDropKey(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setActiveDropKey(null);
                      assignAmountMappingColumn('debitColumn', e.dataTransfer.getData('text/plain'));
                    }}
                  >
                    <div className="text-xs font-semibold text-canvas-600 mb-1">Debit (negative)</div>
                    <SingleMappingPill
                      value={mapping.csv.amountMapping?.type === 'debitCredit' ? mapping.csv.amountMapping.debitColumn ?? '' : ''}
                      placeholder="Drop debit column here"
                      onClear={() => {
                        const col = mapping.csv.amountMapping?.type === 'debitCredit' ? mapping.csv.amountMapping.debitColumn : undefined;
                        if (col) removeHeaderEverywhere(col);
                      }}
                    />
                  </DropTarget>
                  <DropTarget
                    isActive={activeDropKey === 'credit'}
                    className="border-dashed rounded-lg p-3"
                    onDragOver={(e) => {
                      e.preventDefault();
                      setActiveDropKey('credit');
                    }}
                    onDragLeave={() => setActiveDropKey(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setActiveDropKey(null);
                      assignAmountMappingColumn('creditColumn', e.dataTransfer.getData('text/plain'));
                    }}
                  >
                    <div className="text-xs font-semibold text-canvas-600 mb-1">Credit (positive)</div>
                    <SingleMappingPill
                      value={mapping.csv.amountMapping?.type === 'debitCredit' ? mapping.csv.amountMapping.creditColumn ?? '' : ''}
                      placeholder="Drop credit column here"
                      onClear={() => {
                        const col = mapping.csv.amountMapping?.type === 'debitCredit' ? mapping.csv.amountMapping.creditColumn : undefined;
                        if (col) removeHeaderEverywhere(col);
                      }}
                    />
                  </DropTarget>
                  <p className="text-xs text-canvas-500">Map at least one column. Debits are treated as negative amounts.</p>
                </div>
              )}

              {amountMappingType === 'amountWithType' && (
                <div className="space-y-3">
                  <DropTarget
                    isActive={activeDropKey === 'amountColumn'}
                    className="border-dashed rounded-lg p-3"
                    onDragOver={(e) => {
                      e.preventDefault();
                      setActiveDropKey('amountColumn');
                    }}
                    onDragLeave={() => setActiveDropKey(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setActiveDropKey(null);
                      assignAmountMappingColumn('amountColumn', e.dataTransfer.getData('text/plain'));
                    }}
                  >
                    <div className="text-xs font-semibold text-canvas-600 mb-1">Amount column</div>
                    <SingleMappingPill
                      value={mapping.csv.amountMapping?.type === 'amountWithType' ? mapping.csv.amountMapping.amountColumn : ''}
                      placeholder="Drop amount column here"
                      onClear={() => {
                        const col = mapping.csv.amountMapping?.type === 'amountWithType' ? mapping.csv.amountMapping.amountColumn : undefined;
                        if (col) removeHeaderEverywhere(col);
                      }}
                    />
                  </DropTarget>
                  <DropTarget
                    isActive={activeDropKey === 'typeColumn'}
                    className="border-dashed rounded-lg p-3"
                    onDragOver={(e) => {
                      e.preventDefault();
                      setActiveDropKey('typeColumn');
                    }}
                    onDragLeave={() => setActiveDropKey(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setActiveDropKey(null);
                      assignAmountMappingColumn('typeColumn', e.dataTransfer.getData('text/plain'));
                    }}
                  >
                    <div className="text-xs font-semibold text-canvas-600 mb-1">Type column</div>
                    <SingleMappingPill
                      value={mapping.csv.amountMapping?.type === 'amountWithType' ? mapping.csv.amountMapping.typeColumn : ''}
                      placeholder="Drop type column here"
                      onClear={() => {
                        const col = mapping.csv.amountMapping?.type === 'amountWithType' ? mapping.csv.amountMapping.typeColumn : undefined;
                        if (col) removeHeaderEverywhere(col);
                      }}
                    />
                  </DropTarget>
                  <div className="space-y-2">
                    <p className="text-xs text-canvas-500">Map both columns. Type column values:</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-canvas-600 mb-1">Negative amount value</label>
                        <Input
                          type="text"
                          variant="mono"
                          value={mapping.csv.amountMapping?.type === 'amountWithType' ? mapping.csv.amountMapping.negativeValue ?? 'debit' : 'debit'}
                          onChange={(e) => updateAmountWithTypeValues('negativeValue', e.target.value)}
                          className="w-full"
                          placeholder="debit"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-canvas-600 mb-1">Positive amount value</label>
                        <Input
                          type="text"
                          variant="mono"
                          value={mapping.csv.amountMapping?.type === 'amountWithType' ? mapping.csv.amountMapping.positiveValue ?? 'credit' : 'credit'}
                          onChange={(e) => updateAmountWithTypeValues('positiveValue', e.target.value)}
                          className="w-full"
                          placeholder="credit"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-canvas-500">Values are matched case‑insensitively.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Owner */}
            <DropTarget
              isActive={activeDropKey === 'owner'}
              className="items-start"
              onDragOver={(e) => {
                e.preventDefault();
                setActiveDropKey('owner');
              }}
              onDragLeave={() => setActiveDropKey(null)}
              onDrop={(e) => {
                e.preventDefault();
                setActiveDropKey(null);
                assignHeaderToField('owner', e.dataTransfer.getData('text/plain'));
              }}
            >
              <FieldMeta label="Owner" required={false} hint="Map column or select" />

              <div className="space-y-3">
                <SingleMappingPill
                  value={mapping.csv.owner ?? ''}
                  placeholder="Drop column here"
                  onClear={() => (mapping.csv.owner ? removeHeaderEverywhere(mapping.csv.owner) : undefined)}
                />

                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Select
                      value={isAddingNewOwner ? '__add_new' : (mapping.defaultOwner || '')}
                      onChange={(e) => {
                        if (e.target.value === '__add_new') {
                          setIsAddingNewOwner(true);
                        } else {
                          setMapping((prev) => ({ ...prev, defaultOwner: e.target.value }));
                          setIsAddingNewOwner(false);
                        }
                      }}
                      disabled={!!mapping.csv.owner}
                      options={[
                        { value: '', label: 'Select default owner...' },
                        ...availableOwners.map(owner => ({ value: owner, label: owner })),
                        { value: '', label: '---', disabled: true },
                        { value: '__add_new', label: 'Add new owner...' }
                      ]}
                      className="w-full"
                    />
                    {mapping.defaultOwner && !mapping.csv.owner && !isAddingNewOwner && (
                      <button
                        type="button"
                        onClick={() => setMapping((prev) => ({ ...prev, defaultOwner: undefined }))}
                        className="text-canvas-500 hover:text-brand"
                        aria-label="Clear selection"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {isAddingNewOwner && (
                    <div className="space-y-1 animate-in fade-in slide-in-from-top-1">
                      <div className="flex items-center gap-2">
                        <Input
                          type="text"
                          variant="mono"
                          value={newOwnerInput}
                          onChange={(e) => setNewOwnerInput(e.target.value)}
                          placeholder="New owner name"
                          maxLength={25}
                          className="flex-1"
                          autoFocus
                        />
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            const trimmed = newOwnerInput.trim().slice(0, 25);
                            if (trimmed) {
                              if (!availableOwners.includes(trimmed)) {
                                setAvailableOwners((prev) => [...prev, trimmed]);
                              }
                              setMapping((prev) => ({ ...prev, defaultOwner: trimmed }));
                              setNewOwnerInput('');
                              setIsAddingNewOwner(false);
                            }
                          }}
                        >
                          Save
                        </Button>
                      </div>
                      <div className="text-xs text-canvas-500 text-right font-mono">
                        {newOwnerInput.length}/25
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-canvas-500">
                    {mapping.csv.owner
                      ? 'Owner is mapped from CSV column.'
                      : 'Pick a default owner or add a new one.'}
                  </p>
                </div>
              </div>
            </DropTarget>

            {/* Account (constant) */}
            <div
              className={
                'bg-canvas-200/50 border rounded-xl p-4 flex items-center justify-between group transition-colors ' +
                (attemptedNext && isMissing('account') ? 'border-finance-expense/60 bg-finance-expense/5' : 'border-canvas-300')
              }
            >
              <FieldMeta label="Account" required />
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Select
                    value={isAddingNewAccount ? '__add_new' : mapping.account}
                    onChange={(e) => {
                      if (e.target.value === '__add_new') {
                        setIsAddingNewAccount(true);
                      } else {
                        setMapping((prev) => ({ ...prev, account: e.target.value }));
                        setIsAddingNewAccount(false);
                      }
                    }}
                    options={[
                      { value: '', label: 'Select account...' },
                      ...availableAccounts.map(acc => ({ value: acc, label: acc })),
                      { value: '', label: '---', disabled: true },
                      { value: '__add_new', label: 'Add new account...' }
                    ]}
                    className="w-full"
                  />
                  {mapping.account && !isAddingNewAccount && (
                    <button
                      type="button"
                      onClick={() => setMapping((prev) => ({ ...prev, account: '' }))}
                      className="text-canvas-500 hover:text-brand"
                      aria-label="Clear selection"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {isAddingNewAccount && (
                  <div className="space-y-1 animate-in fade-in slide-in-from-top-1">
                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        variant="mono"
                        value={newAccountInput}
                        onChange={(e) => setNewAccountInput(e.target.value)}
                        placeholder="New account name"
                        maxLength={25}
                        className="flex-1"
                        autoFocus
                      />
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          const trimmed = newAccountInput.trim().slice(0, 25);
                          if (trimmed) {
                            if (!availableAccounts.includes(trimmed)) {
                              setAvailableAccounts((prev) => [...prev, trimmed]);
                            }
                            setMapping((prev) => ({ ...prev, account: trimmed }));
                            setNewAccountInput('');
                            setIsAddingNewAccount(false);
                          }
                        }}
                      >
                        Save
                      </Button>
                    </div>
                    <div className="text-xs text-canvas-500 text-right font-mono">
                      {newAccountInput.length}/25
                    </div>
                  </div>
                )}
                <p className="text-xs text-canvas-500">Pick an existing account or add a new one.</p>
              </div>
            </div>

            {/* Currency */}
            <DropTarget
              isActive={activeDropKey === 'currency'}
              onDragOver={(e) => {
                e.preventDefault();
                setActiveDropKey('currency');
              }}
              onDragLeave={() => setActiveDropKey(null)}
              onDrop={(e) => {
                e.preventDefault();
                setActiveDropKey(null);
                assignHeaderToField('currency', e.dataTransfer.getData('text/plain'));
              }}
            >
              <FieldMeta label="Currency" required={false} />

              <div className="space-y-3">
                <SingleMappingPill
                  value={mapping.csv.currency ?? ''}
                  placeholder="Drop column here"
                  onClear={() => (mapping.csv.currency ? removeHeaderEverywhere(mapping.csv.currency) : undefined)}
                />

                <div className="flex flex-col gap-2">
                  <Select
                    value={mapping.currencyDefault}
                    onChange={(e) => setMapping((prev) => ({ ...prev, currencyDefault: e.target.value }))}
                    disabled={!!mapping.csv.currency}
                    options={[
                      { value: 'CAD', label: 'CAD' },
                      { value: 'USD', label: 'USD' },
                      { value: 'EUR', label: 'EUR' }
                    ]}
                    className="w-full"
                  />
                  <p className="text-xs text-canvas-500">
                    {mapping.csv.currency
                      ? 'Currency is mapped from CSV column.'
                      : 'Pick a currency.'}
                  </p>
                </div>
              </div>
            </DropTarget>
          </div>

          {!canProceed && attemptedNext && (
            <div className="mt-6 text-sm text-finance-expense bg-finance-expense/10 border border-finance-expense/30 rounded-lg px-4 py-3">
              Map all required fields: Date, Description, Amount, and pick an Account.
            </div>
          )}

          <div className="mt-8 flex items-center gap-3 p-4 bg-brand/5 border border-brand/20 rounded-lg">
            <Save className="w-4 h-4 text-brand" />
            <Input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Name this mapping (e.g., RBC Checking)"
              className="bg-transparent text-sm text-canvas-800 placeholder-canvas-500 focus:outline-none w-full border-0"
            />
            <Button
              onClick={handleSaveMapping}
              disabled={!saveName.trim()}
              variant={saveName.trim() ? "primary" : "secondary"}
              size="sm"
            >
              Save
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ColumnMapper;
