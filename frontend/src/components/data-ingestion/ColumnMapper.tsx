import React, { useMemo, useState } from 'react';
import { ArrowRight, Save, X } from 'lucide-react';

type CsvFieldKey = 'date' | 'description' | 'amount' | 'owner' | 'currency';

export type ImportMapping = {
  csv: {
    date: string;
    description: string[];
    amount: string;
    owner?: string;
    currency?: string;
  };
  account: string;
  currencyDefault: string; // Used when csv.currency is not set
};

interface ColumnMapperProps {
  csvHeaders: string[];
  excelMock?: boolean;
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
  },
  account: '',
  currencyDefault: 'CAD',
});

const requiredCsvFields: Array<Exclude<CsvFieldKey, 'owner' | 'currency'>> = ['date', 'description', 'amount'];

const ColumnMapper: React.FC<ColumnMapperProps> = ({ csvHeaders, excelMock, onComplete }) => {
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
        },
        account: 'TD Visa',
        currencyDefault: 'CAD',
      },
    },
  ]);
  const [selectedMappingId, setSelectedMappingId] = useState<string>('new');
  const [saveName, setSaveName] = useState('');

  const isMissing = (key: 'date' | 'description' | 'amount' | 'account') => {
    if (key === 'account') return mapping.account.trim().length === 0;
    if (key === 'description') return mapping.csv.description.length === 0;
    return (mapping.csv[key] ?? '').trim().length === 0;
  };

  const canProceed = useMemo(() => {
    const csvOk = requiredCsvFields.every((k) => {
      if (k === 'description') return mapping.csv.description.length > 0;
      return mapping.csv[k].trim().length > 0;
    });
    return csvOk && mapping.account.trim().length > 0;
  }, [mapping]);

  const usedHeaders = useMemo(() => {
    const used = new Set<string>();
    if (mapping.csv.date) used.add(mapping.csv.date);
    if (mapping.csv.amount) used.add(mapping.csv.amount);
    if (mapping.csv.owner) used.add(mapping.csv.owner);
    if (mapping.csv.currency) used.add(mapping.csv.currency);
    mapping.csv.description.forEach((h) => used.add(h));
    return used;
  }, [mapping]);

  const availableForDescription = useMemo(() => {
    return csvHeaders.filter((h) => !mapping.csv.description.includes(h));
  }, [csvHeaders, mapping.csv.description]);

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
      };

      clearHeader(header);

      if (field === 'description') {
        next.csv.description = [...next.csv.description, header];
        return next;
      }

      if (field === 'date' || field === 'amount') {
        next.csv[field] = header;
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

  const dropTargetBase =
    'bg-obsidian-800/50 border-2 border-dashed rounded-xl p-4 flex items-center justify-between group transition-colors';

  const missingBorder = 'border-finance-expense/60 bg-finance-expense/5';

  return (
    <div className="bg-obsidian-900 border border-obsidian-800 rounded-xl shadow-glass overflow-hidden animate-snap-in">
      <div className="bg-obsidian-950 p-4 border-b border-obsidian-800 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h2 className="font-bold text-white">Map Columns</h2>
          <div className="h-4 w-px bg-obsidian-700 mx-2" />
          <select
            value={selectedMappingId}
            onChange={(e) => handleSelectSavedMapping(e.target.value)}
            className="bg-obsidian-900 border border-obsidian-700 text-sm rounded-md px-2 py-1 focus:ring-1 focus:ring-brand outline-none"
          >
            <option value="new">New Mapping...</option>
            {savedMappings.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleNext}
          disabled={!canProceed}
          className={
            'flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg transition-colors ' +
            (canProceed
              ? 'bg-brand hover:bg-brand-hover text-white'
              : 'bg-obsidian-800 text-obsidian-500 cursor-not-allowed')
          }
        >
          Next Step <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {excelMock && (
        <div className="px-6 py-3 bg-brand/10 border-b border-brand/30 text-sm text-obsidian-200">
          Excel parsing is mocked for now. We extracted placeholder headers so you can continue the flow.
        </div>
      )}

      <div className="flex h-[560px]">
        <div className="w-1/3 bg-obsidian-900 p-6 border-r border-obsidian-800 overflow-y-auto">
          <h3 className="text-xs font-mono uppercase text-obsidian-500 mb-4 tracking-wider">Found in File</h3>
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
                      ? 'bg-obsidian-900 border-obsidian-800 text-obsidian-600'
                      : 'bg-obsidian-800 border-obsidian-700 hover:border-obsidian-500')
                  }
                  title={isUsed ? 'Already mapped (dropping elsewhere will move it)' : 'Drag to map'}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm">{header}</span>
                    <div className={
                      'w-1.5 h-1.5 rounded-full transition-colors ' +
                      (isUsed ? 'bg-obsidian-700' : 'bg-obsidian-600 group-hover:bg-brand')
                    } />
                  </div>
                </div>
              );
            })}

            {csvHeaders.length === 0 && (
              <div className="text-sm text-obsidian-500">No headers found.</div>
            )}
          </div>
        </div>

        <div className="w-2/3 bg-obsidian-950/50 p-6 overflow-y-auto">
          <h3 className="text-xs font-mono uppercase text-obsidian-500 mb-4 tracking-wider">App Schema</h3>

          <div className="grid gap-4">
            {/* Date */}
            <div
              className={
                dropTargetBase +
                ' ' +
                (activeDropKey === 'date' ? 'border-brand' : 'border-obsidian-700 hover:border-obsidian-600') +
                ' ' +
                (attemptedNext && isMissing('date') ? missingBorder : '')
              }
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
                placeholder="Drop CSV column here"
                onClear={() => removeHeaderEverywhere(mapping.csv.date)}
              />
            </div>

            {/* Description (combine) */}
            <div
              className={
                dropTargetBase +
                ' items-start ' +
                (activeDropKey === 'description' ? 'border-brand' : 'border-obsidian-700 hover:border-obsidian-600') +
                ' ' +
                (attemptedNext && isMissing('description') ? missingBorder : '')
              }
              onDragOver={(e) => {
                e.preventDefault();
                setActiveDropKey('description');
              }}
              onDragLeave={() => setActiveDropKey(null)}
              onDrop={(e) => {
                e.preventDefault();
                setActiveDropKey(null);
                assignHeaderToField('description', e.dataTransfer.getData('text/plain'));
              }}
            >
              <FieldMeta label="Description" required hint="Supports combining multiple columns" />
              <div className="w-[280px]">
                {mapping.csv.description.length === 0 ? (
                  <div className="text-xs text-obsidian-600 font-mono bg-obsidian-900 px-3 py-1.5 rounded border border-obsidian-800 text-center">
                    Drop one or more CSV columns here
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 justify-end">
                    {mapping.csv.description.map((h) => (
                      <span
                        key={h}
                        className="inline-flex items-center gap-2 text-xs font-mono bg-obsidian-900 px-3 py-1.5 rounded border border-obsidian-800"
                      >
                        {h}
                        <button
                          onClick={() => removeHeaderEverywhere(h)}
                          className="text-obsidian-500 hover:text-white"
                          aria-label={`Remove ${h}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex items-center gap-2 justify-end">
                  <span className="text-xs text-obsidian-500">Combine with</span>
                  <select
                    value=""
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) return;
                      assignHeaderToField('description', v);
                    }}
                    className="bg-obsidian-900 border border-obsidian-700 text-xs rounded-md px-2 py-1 focus:ring-1 focus:ring-brand outline-none"
                  >
                    <option value="">Select...</option>
                    {availableForDescription.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Amount */}
            <div
              className={
                dropTargetBase +
                ' ' +
                (activeDropKey === 'amount' ? 'border-brand' : 'border-obsidian-700 hover:border-obsidian-600') +
                ' ' +
                (attemptedNext && isMissing('amount') ? missingBorder : '')
              }
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
              <FieldMeta label="Amount" required />
              <SingleMappingPill
                value={mapping.csv.amount}
                placeholder="Drop CSV column here"
                onClear={() => removeHeaderEverywhere(mapping.csv.amount)}
              />
            </div>

            {/* Owner */}
            <div
              className={
                dropTargetBase +
                ' ' +
                (activeDropKey === 'owner' ? 'border-brand' : 'border-obsidian-700 hover:border-obsidian-600')
              }
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
              <FieldMeta label="Owner" required={false} />
              <SingleMappingPill
                value={mapping.csv.owner ?? ''}
                placeholder="Optional"
                onClear={() => (mapping.csv.owner ? removeHeaderEverywhere(mapping.csv.owner) : undefined)}
              />
            </div>

            {/* Account (constant) */}
            <div
              className={
                'bg-obsidian-800/50 border rounded-xl p-4 flex items-center justify-between group transition-colors ' +
                (attemptedNext && isMissing('account') ? 'border-finance-expense/60 bg-finance-expense/5' : 'border-obsidian-700')
              }
            >
              <FieldMeta label="Account" required hint="Required (constant)" />
              <select
                value={mapping.account}
                onChange={(e) => setMapping((prev) => ({ ...prev, account: e.target.value }))}
                className="bg-obsidian-900 border border-obsidian-700 text-sm rounded-md px-2 py-1 focus:ring-1 focus:ring-brand outline-none"
              >
                <option value="">Select account...</option>
                <option value="RBC Checking">RBC Checking</option>
                <option value="TD Visa">TD Visa</option>
                <option value="Wealthsimple Cash">Wealthsimple Cash</option>
              </select>
            </div>

            {/* Currency */}
            <div
              className={
                dropTargetBase +
                ' ' +
                (activeDropKey === 'currency' ? 'border-brand' : 'border-obsidian-700 hover:border-obsidian-600')
              }
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
              <FieldMeta label="Currency" required={false} hint="Defaults to CAD" />
              <div className="flex items-center gap-2">
                <select
                  value={mapping.currencyDefault}
                  onChange={(e) => setMapping((prev) => ({ ...prev, currencyDefault: e.target.value }))}
                  className="bg-obsidian-900 border border-obsidian-700 text-xs rounded-md px-2 py-1 focus:ring-1 focus:ring-brand outline-none"
                >
                  <option value="CAD">CAD</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>

                <SingleMappingPill
                  value={mapping.csv.currency ?? ''}
                  placeholder="Drop CSV column (optional)"
                  onClear={() => (mapping.csv.currency ? removeHeaderEverywhere(mapping.csv.currency) : undefined)}
                />
              </div>
            </div>
          </div>

          {!canProceed && attemptedNext && (
            <div className="mt-6 text-sm text-finance-expense bg-finance-expense/10 border border-finance-expense/30 rounded-lg px-4 py-3">
              Map all required fields: Date, Description, Amount, and pick an Account.
            </div>
          )}

          <div className="mt-8 flex items-center gap-3 p-4 bg-brand/5 border border-brand/20 rounded-lg">
            <Save className="w-4 h-4 text-brand" />
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Name this mapping (e.g., RBC Checking)"
              className="bg-transparent text-sm text-white placeholder-obsidian-500 focus:outline-none w-full"
            />
            <button
              onClick={handleSaveMapping}
              disabled={!saveName.trim()}
              className={
                'text-xs font-semibold px-3 py-1.5 rounded-md border transition-colors ' +
                (saveName.trim()
                  ? 'bg-brand text-white border-brand hover:bg-brand-hover'
                  : 'bg-obsidian-900 text-obsidian-600 border-obsidian-800 cursor-not-allowed')
              }
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function FieldMeta({ label, required, hint }: { label: string; required: boolean; hint?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={
          'w-8 h-8 rounded-lg flex items-center justify-center ' +
          (required ? 'bg-obsidian-700 text-obsidian-300' : 'bg-obsidian-800 text-obsidian-500')
        }
      >
        <span className="text-xs font-bold">{label[0]}</span>
      </div>
      <div>
        <p className="text-sm font-semibold text-obsidian-200">{label}</p>
        <p className="text-xs text-obsidian-500">
          {required ? 'Required' : 'Optional'}
          {hint ? ` • ${hint}` : ''}
        </p>
      </div>
    </div>
  );
}

function SingleMappingPill({
  value,
  placeholder,
  onClear,
}: {
  value: string;
  placeholder: string;
  onClear?: () => void;
}) {
  if (!value) {
    return (
      <div className="text-xs text-obsidian-600 font-mono bg-obsidian-900 px-3 py-1.5 rounded border border-obsidian-800">
        {placeholder}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 text-xs font-mono bg-obsidian-900 px-3 py-1.5 rounded border border-obsidian-800">
      {value}
      {onClear && (
        <button onClick={onClear} className="text-obsidian-500 hover:text-white" aria-label="Clear mapping">
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

export default ColumnMapper;
