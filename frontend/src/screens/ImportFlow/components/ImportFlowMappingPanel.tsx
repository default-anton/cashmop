import { X } from "lucide-react";
import type React from "react";
import { AutocompleteInput, Card, DragReorderableList } from "@/components";
import type { ImportMapping } from "../components/ColumnMapperTypes";

type PresetOption = { value: string; label: string };

const sortOptions = <T extends string | { label: string }>(options: T[]) => {
  const labelFor = (option: T) => (typeof option === "string" ? option : option.label);
  return [...options].sort((a, b) => labelFor(a).localeCompare(labelFor(b), undefined, { sensitivity: "base" }));
};

type MappingPanelProps = {
  mapping: ImportMapping;
  presetInput: string;
  presetOptions: PresetOption[];
  presetInfoName: string;
  showAutoMatchBanner: boolean;
  showPrefillBanner: boolean;
  onPresetInputChange: (value: string) => void;
  onPresetSelect: (value: string) => void;
  onPresetSubmit: (value: string) => void;
  onFocusPreset: () => void;
  accountOptions: string[];
  ownerOptions: string[];
  currencyOptions: Array<{ value: string; label: string }>;
  currencyInput: string;
  onAccountChange: (value: string) => void;
  onOwnerChange: (value: string) => void;
  onCurrencySelect: (value: string) => void;
  onCurrencyInputChange: (value: string) => void;
  onClearHeader: (header: string) => void;
  onDescriptionRemove: (header: string) => void;
  onDescriptionReorder: (fromIndex: number, toIndex: number) => void;
};

const ImportFlowMappingPanel: React.FC<MappingPanelProps> = ({
  mapping,
  presetInput,
  presetOptions,
  presetInfoName,
  showAutoMatchBanner,
  showPrefillBanner,
  onPresetInputChange,
  onPresetSelect,
  onPresetSubmit,
  onFocusPreset,
  accountOptions,
  ownerOptions,
  currencyOptions,
  currencyInput,
  onAccountChange,
  onOwnerChange,
  onCurrencySelect,
  onCurrencyInputChange,
  onClearHeader,
  onDescriptionRemove,
  onDescriptionReorder,
}) => {
  const sortedPresetOptions = sortOptions(presetOptions);
  const sortedAccountOptions = sortOptions(accountOptions);
  const sortedOwnerOptions = sortOptions(ownerOptions);
  const sortedCurrencyOptions = sortOptions(currencyOptions);

  return (
    <Card variant="glass" className="p-6">
      <div className="text-[10px] font-bold text-canvas-500 uppercase tracking-widest mb-4 select-none">Mapping</div>

      <div className="space-y-4">
        <div className="rounded-xl border border-canvas-200 bg-canvas-50 p-4">
          <div className="text-[10px] font-bold text-canvas-500 uppercase tracking-wider mb-2 select-none">
            Mapping preset
          </div>
          <AutocompleteInput
            value={presetInput}
            onChange={onPresetInputChange}
            onSelect={(value) => onPresetSelect(value)}
            onSubmit={onPresetSubmit}
            options={sortedPresetOptions}
            placeholder="Search saved mappings"
            aria-label="Mapping preset"
          />
          {showAutoMatchBanner && (
            <div
              className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand/30 bg-brand/5 px-3 py-2 text-xs text-brand"
              data-testid="auto-mapping-banner"
            >
              <span className="font-semibold select-none">Auto matched: {presetInfoName}</span>
              <button
                type="button"
                className="text-[11px] font-bold uppercase tracking-widest text-brand hover:underline"
                onClick={onFocusPreset}
              >
                Change
              </button>
            </div>
          )}
          {showPrefillBanner && (
            <div className="mt-3 rounded-lg border border-brand/30 bg-brand/5 px-3 py-2 text-xs text-brand">
              Pre-filled from headers — review quickly.
            </div>
          )}
        </div>

        <div className="rounded-xl border border-canvas-200 bg-canvas-50 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-bold text-canvas-500 uppercase tracking-wider select-none">
              Account (required)
            </div>
            {mapping.csv.account && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-canvas-500 px-2 py-1 rounded-full border border-canvas-200 bg-canvas-50">
                  {mapping.csv.account}
                </span>
                <button
                  type="button"
                  onClick={() => onClearHeader(mapping.csv.account || "")}
                  className="p-1 rounded-full text-canvas-400 hover:text-brand hover:bg-brand/10 transition-colors"
                  aria-label="Clear account column"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
          <AutocompleteInput
            value={mapping.account || ""}
            onChange={onAccountChange}
            options={sortedAccountOptions}
            placeholder="Search accounts"
            aria-label="Account"
            disabled={!!mapping.csv.account}
          />
        </div>

        {mapping.csv.description.length > 1 && (
          <div className="rounded-xl border border-canvas-200 bg-canvas-50 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-bold text-canvas-500 uppercase tracking-wider select-none">
                Description order
              </div>
              <span className="text-[10px] text-canvas-500 select-none">Drag to reorder</span>
            </div>
            <DragReorderableList
              items={mapping.csv.description}
              renderItem={(item) => <span className="truncate flex-1 min-w-0">{item}</span>}
              onReorder={onDescriptionReorder}
              onRemove={(index) => onDescriptionRemove(mapping.csv.description[index])}
              emptyPlaceholder={
                <span className="text-xs text-canvas-400 italic select-none">No descriptions yet.</span>
              }
              itemClassName="w-full justify-between"
            />
          </div>
        )}

        <div className="rounded-xl border border-canvas-200 bg-canvas-50 p-4">
          <div className="text-[10px] font-bold text-canvas-500 uppercase tracking-wider mb-2 select-none">
            Owner (optional, static)
          </div>
          <AutocompleteInput
            value={mapping.owner || ""}
            onChange={onOwnerChange}
            options={sortedOwnerOptions}
            placeholder="Owner name"
            aria-label="Owner"
          />
        </div>

        <div className="rounded-xl border border-canvas-200 bg-canvas-50 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-bold text-canvas-500 uppercase tracking-wider select-none">
              Default currency (required)
            </div>
            {mapping.csv.currency && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-canvas-500 px-2 py-1 rounded-full border border-canvas-200 bg-canvas-50">
                  {mapping.csv.currency}
                </span>
                <button
                  type="button"
                  onClick={() => onClearHeader(mapping.csv.currency || "")}
                  className="p-1 rounded-full text-canvas-400 hover:text-brand hover:bg-brand/10 transition-colors"
                  aria-label="Clear currency column"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
          <AutocompleteInput
            value={currencyInput}
            onChange={onCurrencyInputChange}
            onSelect={onCurrencySelect}
            options={sortedCurrencyOptions}
            placeholder="Search currency"
          />
        </div>
      </div>
    </Card>
  );
};

export default ImportFlowMappingPanel;
