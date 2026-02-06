import { Landmark, Sparkles, UserRound, Wallet2, X } from "lucide-react";
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

const sectionClass =
  "rounded-2xl border border-canvas-200 bg-canvas-50/90 p-4 transition-all duration-200 hover:-translate-y-px hover:border-canvas-300";
const labelClass = "text-xs font-bold uppercase tracking-[0.1em] text-canvas-600 select-none";

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
    <Card variant="glass" className="p-5 transition-all duration-200 hover:-translate-y-px hover:shadow-card-hover">
      <div className="mb-4">
        <div className="text-xs font-bold uppercase tracking-[0.12em] text-canvas-500 select-none">Mapping</div>
        <p className="mt-1 text-sm text-canvas-600 select-none">Required: Date, Amount, Description, Account.</p>
      </div>

      <div className="space-y-4">
        <div className={sectionClass}>
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-brand" />
            <div className={labelClass}>Mapping preset</div>
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
              className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/30 bg-brand/[0.08] px-3 py-2 text-xs text-brand"
              data-testid="auto-mapping-banner"
            >
              <span className="font-semibold select-none">Auto matched: {presetInfoName}</span>
              <button
                type="button"
                className="text-[11px] font-bold uppercase tracking-[0.08em] hover:underline"
                onClick={onFocusPreset}
              >
                Change
              </button>
            </div>
          )}

          {showPrefillBanner && (
            <div className="mt-3 rounded-xl border border-brand/25 bg-brand/[0.06] px-3 py-2 text-xs text-brand">
              Pre-filled from headers — quick check recommended.
            </div>
          )}
        </div>

        <div className={sectionClass}>
          <div className="mb-2 flex items-center gap-2">
            <Landmark className="h-3.5 w-3.5 text-canvas-500" />
            <div className={labelClass}>Account (required)</div>
          </div>

          {mapping.csv.account && (
            <div className="mb-2.5 flex items-center gap-2 rounded-xl border border-canvas-200 bg-canvas-100/80 px-2.5 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-canvas-500 select-none">
                Column
              </span>
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-canvas-600" title={mapping.csv.account}>
                {mapping.csv.account}
              </span>
              <button
                type="button"
                onClick={() => onClearHeader(mapping.csv.account || "")}
                className="rounded-full p-1 text-canvas-400 transition-colors hover:bg-brand/10 hover:text-brand"
                aria-label="Clear account column"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

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
          <div className={sectionClass}>
            <div className="mb-2 flex items-center justify-between">
              <div className={labelClass}>Description order</div>
              <span className="text-xs text-canvas-500 select-none">Drag to reorder</span>
            </div>
            <DragReorderableList
              items={mapping.csv.description}
              renderItem={(item) => <span className="min-w-0 flex-1 truncate text-xs text-canvas-700">{item}</span>}
              onReorder={onDescriptionReorder}
              onRemove={(index) => onDescriptionRemove(mapping.csv.description[index])}
              emptyPlaceholder={
                <span className="text-xs italic text-canvas-400 select-none">No descriptions yet.</span>
              }
              itemClassName="w-full justify-between"
            />
          </div>
        )}

        <div className={sectionClass}>
          <div className="mb-2 flex items-center gap-2">
            <UserRound className="h-3.5 w-3.5 text-canvas-500" />
            <div className={labelClass}>Owner (optional, static)</div>
          </div>
          <AutocompleteInput
            value={mapping.owner || ""}
            onChange={onOwnerChange}
            options={sortedOwnerOptions}
            placeholder="Owner name"
            aria-label="Owner"
          />
        </div>

        <div className={sectionClass}>
          <div className="mb-2 flex items-center gap-2">
            <Wallet2 className="h-3.5 w-3.5 text-canvas-500" />
            <div className={labelClass}>Default currency (required)</div>
          </div>

          {mapping.csv.currency && (
            <div className="mb-2.5 flex items-center gap-2 rounded-xl border border-canvas-200 bg-canvas-100/80 px-2.5 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-canvas-500 select-none">
                Column
              </span>
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-canvas-600" title={mapping.csv.currency}>
                {mapping.csv.currency}
              </span>
              <button
                type="button"
                onClick={() => onClearHeader(mapping.csv.currency || "")}
                className="rounded-full p-1 text-canvas-400 transition-colors hover:bg-brand/10 hover:text-brand"
                aria-label="Clear currency column"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

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
