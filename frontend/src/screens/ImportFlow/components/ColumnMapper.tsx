import React, { useState, useEffect } from 'react';
import { ArrowRight, Save } from 'lucide-react';
import { Button, Select, Input, Card, Table } from '../../../components';
import { SavedMapping, ImportMapping, CsvFieldKey } from './ColumnMapperTypes';
import { SourceColumnList } from './SourceColumnList';
import { useColumnMapping, defaultMapping } from './useColumnMapping';
import { DateMapping } from './MappingFields/DateMapping';
import { DescriptionMapping } from './MappingFields/DescriptionMapping';
import { AmountMapping } from './MappingFields/AmountMapping';
import { OwnerMapping } from './MappingFields/OwnerMapping';
import { AccountMapping } from './MappingFields/AccountMapping';
import { CurrencyMapping } from './MappingFields/CurrencyMapping';

// Redundant local storage keys removed

// Define DB Model shape (from Go)
type DbColumnMapping = {
  id: number;
  name: string;
  mapping_json: string;
};

interface ColumnMapperProps {
  csvHeaders: string[];
  rows: string[][];
  excelMock?: boolean;
  fileCount?: number;
  initialMapping?: ImportMapping | null;
  initialMappingId?: string | null;
  onComplete: (mapping: ImportMapping) => void;
}

const ColumnMapper: React.FC<ColumnMapperProps> = ({ csvHeaders, rows, excelMock, fileCount = 1, initialMapping, initialMappingId, onComplete }) => {
  const {
    mapping,
    setMapping,
    usedHeaders,
    isAmountMappingValid, // eslint-disable-line @typescript-eslint/no-unused-vars
    isMissing,
    canProceed,
    removeHeaderEverywhere,
    assignHeaderToField,
    reorderDescription,
    handleAmountMappingTypeChange,
    assignAmountMappingColumn,
    updateAmountWithTypeValues,
  } = useColumnMapping(initialMapping || undefined);

  const [activeDropKey, setActiveDropKey] = useState<CsvFieldKey | null>(null);
  const [attemptedNext, setAttemptedNext] = useState(false);

  const [savedMappings, setSavedMappings] = useState<SavedMapping[]>([]);

  const [availableAccounts, setAvailableAccounts] = useState<string[]>([]);
  const [availableOwners, setAvailableOwners] = useState<string[]>([]);

  // Load saved mappings, accounts and owners from Backend on mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [dbMappings, dbAccounts, dbOwners]: [DbColumnMapping[], string[], string[]] = await Promise.all([
          (window as any).go.main.App.GetColumnMappings(),
          (window as any).go.main.App.GetAccounts(),
          (window as any).go.main.App.GetOwners(),
        ]);

        const parsed = dbMappings.map(m => ({
          id: m.id,
          name: m.name,
          mapping: JSON.parse(m.mapping_json) as ImportMapping,
        }));
        setSavedMappings(parsed);

        if (dbAccounts && dbAccounts.length > 0) {
          setAvailableAccounts(dbAccounts);
        } else {
          // Default fallback if DB is empty
          setAvailableAccounts(['RBC Checking', 'TD Visa', 'Wealthsimple Cash']);
        }

        setAvailableOwners(dbOwners || []);
      } catch (e) {
        console.error('Failed to load data from backend', e);
      }
    };
    loadInitialData();
  }, []);

  const [selectedMappingId, setSelectedMappingId] = useState<string>(initialMappingId || 'new');
  const [saveName, setSaveName] = useState('');

  const handleNext = () => {
    setAttemptedNext(true);
    if (!canProceed) return;
    onComplete(mapping);
  };

  const handleSelectSavedMapping = (val: string) => {
    setSelectedMappingId(val);

    if (val === 'new') {
      setMapping(defaultMapping());
      setSaveName('');
      setAttemptedNext(false);
      return;
    }

    const id = parseInt(val, 10);
    const found = savedMappings.find((m) => m.id === id);
    if (!found) return;
    setMapping(found.mapping);
    setSaveName(''); // Clear save name when loading
    setAttemptedNext(false);
  };

  const handleSaveMapping = async () => {
    const name = saveName.trim();
    if (!name) return;

    try {
      const id: number = await (window as any).go.main.App.SaveColumnMapping(name, mapping);

      const newEntry: SavedMapping = {
        id,
        name: name, // We might want to format existing naming convention of appending "(Saved)" if desired, but clean name is better
        mapping,
      };

      setSavedMappings((prev) => {
        // Replace if exists (id check) or name check? Backend upserts by name.
        // Let's filter out any with same id (update)
        const others = prev.filter(p => p.id !== id);
        return [...others, newEntry].sort((a, b) => a.name.localeCompare(b.name));
      });

      setSelectedMappingId(id.toString());
      setSaveName('');
      alert('Mapping saved!');
    } catch (e) {
      console.error('Failed to save mapping', e);
      alert('Failed to save mapping: ' + e);
    }
  };

  const previewData = React.useMemo(() => rows.slice(0, 5), [rows]);
  const previewColumns = React.useMemo(() => csvHeaders.map((h, i) => ({
    key: i as any,
    header: h,
    className: 'whitespace-nowrap'
  })), [csvHeaders]);

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
              ...savedMappings.map(m => ({ value: m.id.toString(), label: m.name }))
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

      <div className="px-6 py-4 border-b border-canvas-200 bg-canvas-50/50">
        <h3 className="text-xs font-semibold text-canvas-500 uppercase tracking-wider mb-3">File Preview</h3>
        <Table
          columns={previewColumns}
          data={previewData}
          className="bg-white max-h-48 overflow-y-auto"
        />
      </div>

      <div className="flex h-[560px]">
        <SourceColumnList csvHeaders={csvHeaders} usedHeaders={usedHeaders} />

        <div className="w-2/3 bg-canvas-100/50 p-6 overflow-y-auto">
          <h3 className="text-xs font-mono uppercase text-canvas-500 mb-4 tracking-wider">App Schema</h3>

          <div className="grid gap-4">
            <DateMapping
              value={mapping.csv.date}
              activeDropKey={activeDropKey}
              isMissing={attemptedNext && isMissing('date')}
              onDragOver={setActiveDropKey}
              onDragLeave={() => setActiveDropKey(null)}
              onDrop={(key, header) => {
                setActiveDropKey(null);
                assignHeaderToField(key, header);
              }}
              onClear={() => removeHeaderEverywhere(mapping.csv.date)}
            />

            <DescriptionMapping
              values={mapping.csv.description}
              activeDropKey={activeDropKey}
              isMissing={attemptedNext && isMissing('description')}
              onDragOver={setActiveDropKey}
              onDragLeave={() => setActiveDropKey(null)}
              onDrop={(key, header) => {
                setActiveDropKey(null);
                assignHeaderToField(key, header);
              }}
              onRemove={(index) => {
                const header = mapping.csv.description[index];
                if (header) removeHeaderEverywhere(header);
              }}
              onReorder={reorderDescription}
              csvHeaders={csvHeaders}
            />

            <AmountMapping
              amountMapping={mapping.csv.amountMapping}
              legacyAmount={mapping.csv.amount}
              activeDropKey={activeDropKey}
              isMissing={attemptedNext && isMissing('amount')}
              onDragOver={setActiveDropKey}
              onDragLeave={() => setActiveDropKey(null)}
              onDrop={(key, header) => {
                setActiveDropKey(null);
                if (key === 'amount') {
                  assignHeaderToField('amount', header);
                } else if (key === 'debit' || key === 'credit' || key === 'amountColumn' || key === 'typeColumn') {
                  // This is handled by assignAmountMappingColumn inside the component logic but here we receive key
                  // We need to map key to 'debitColumn', 'creditColumn', etc.
                  // Wait, AmountMapping component calls onDrop with 'amount', 'debit', 'credit', etc.
                  // assignHeaderToField can handle 'amount'.
                  // For others, AmountMapping calls onAssignAmountMappingColumn directly?
                  // Let's check AmountMapping.tsx
                }
              }}
              onClear={(header) => removeHeaderEverywhere(header)}
              onTypeChange={handleAmountMappingTypeChange}
              onAssignAmountColumn={(field, header) => {
                setActiveDropKey(null);
                assignAmountMappingColumn(field, header);
              }}
              onUpdateAmountWithTypeValues={updateAmountWithTypeValues}
            />

            <OwnerMapping
              ownerValue={mapping.csv.owner}
              defaultOwner={mapping.defaultOwner}
              availableOwners={availableOwners}
              activeDropKey={activeDropKey}
              onDragOver={setActiveDropKey}
              onDragLeave={() => setActiveDropKey(null)}
              onDrop={(key, header) => {
                setActiveDropKey(null);
                assignHeaderToField(key, header);
              }}
              onClear={(header) => removeHeaderEverywhere(header)}
              onSetDefaultOwner={(owner) => setMapping((prev) => ({ ...prev, defaultOwner: owner }))}
              onAddOwner={async (owner) => {
                if (!availableOwners.includes(owner)) {
                  try {
                    await (window as any).go.main.App.CreateOwner(owner);
                    setAvailableOwners((prev) => [...prev, owner]);
                  } catch (e) {
                    console.error('Failed to create owner', e);
                  }
                }
              }}
            />

            <AccountMapping
              account={mapping.account}
              accountValue={mapping.csv.account}
              availableAccounts={availableAccounts}
              isMissing={attemptedNext && isMissing('account')}
              activeDropKey={activeDropKey}
              onDragOver={setActiveDropKey}
              onDragLeave={() => setActiveDropKey(null)}
              onDrop={(key, header) => {
                setActiveDropKey(null);
                assignHeaderToField(key, header);
              }}
              onClear={(header) => removeHeaderEverywhere(header)}
              onSetAccount={(account) => setMapping((prev) => ({ ...prev, account }))}
              onAddAccount={async (account) => {
                if (!availableAccounts.includes(account)) {
                  try {
                    await (window as any).go.main.App.CreateAccount(account);
                    setAvailableAccounts((prev) => [...prev, account]);
                  } catch (e) {
                    console.error('Failed to create account', e);
                  }
                }
              }}
            />

            <CurrencyMapping
              currencyValue={mapping.csv.currency}
              currencyDefault={mapping.currencyDefault}
              activeDropKey={activeDropKey}
              onDragOver={setActiveDropKey}
              onDragLeave={() => setActiveDropKey(null)}
              onDrop={(key, header) => {
                setActiveDropKey(null);
                assignHeaderToField(key, header);
              }}
              onClear={(header) => removeHeaderEverywhere(header)}
              onSetCurrencyDefault={(currency) => setMapping((prev) => ({ ...prev, currencyDefault: currency }))}
            />
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
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSaveName(e.target.value)}
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
