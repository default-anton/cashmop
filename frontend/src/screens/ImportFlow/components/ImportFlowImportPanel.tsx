import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type React from "react";

import { Button, Card, Input } from "@/components";
import type { MonthOption } from "../types";
import type { ImportMapping } from "./ColumnMapperTypes";

interface ImportPanelProps {
  mapping: ImportMapping;
  monthOptions: MonthOption[];
  selectedMonthKeys: Set<string>;
  onToggleMonth: (key: string) => void;
  onSelectAllMonths: () => void;
  onClearMonths: () => void;
  rememberChoice: "off" | "save" | "update";
  rememberName: string;
  rememberError?: string | null;
  presetInfoName: string;
  canUpdatePreset: boolean;
  onRememberChoiceChange: (choice: "off" | "save" | "update") => void;
  onRememberNameChange: (value: string) => void;
  canImport: boolean;
  importBusy: boolean;
  isLastFile: boolean;
  missingFields: string[];
  onImport: () => void;
}

const labelClass = "text-xs font-bold uppercase tracking-[0.1em] text-canvas-600 select-none";

const ImportFlowImportPanel: React.FC<ImportPanelProps> = ({
  mapping,
  monthOptions,
  selectedMonthKeys,
  onToggleMonth,
  onSelectAllMonths,
  onClearMonths,
  rememberChoice,
  rememberName,
  rememberError,
  presetInfoName,
  canUpdatePreset,
  onRememberChoiceChange,
  onRememberNameChange,
  canImport,
  importBusy,
  isLastFile,
  missingFields,
  onImport,
}) => {
  const rememberChoices: Array<{ key: "off" | "save" | "update"; label: string; disabled?: boolean }> = [
    { key: "off", label: "Off" },
    { key: "save", label: "Save as new" },
    { key: "update", label: "Update selected", disabled: !canUpdatePreset },
  ];

  return (
    <Card variant="glass" className="p-5 transition-all duration-200 hover:-translate-y-px hover:shadow-card-hover">
      <div className="text-xs font-bold uppercase tracking-[0.12em] text-canvas-500 select-none">Import</div>

      <div className="mt-4 rounded-2xl border border-canvas-200 bg-canvas-50/90 p-4 transition-all duration-200 hover:-translate-y-px hover:border-canvas-300">
        <div className={labelClass}>Months (per file)</div>

        {!mapping.csv.date && (
          <div className="mt-2 text-xs text-canvas-500 select-none">Map a Date column to unlock month selection.</div>
        )}

        {mapping.csv.date && (
          <div className="mt-3">
            <div className="flex flex-wrap gap-2">
              {monthOptions.map((month) => (
                <button
                  key={month.key}
                  type="button"
                  onClick={() => onToggleMonth(month.key)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-all duration-200 hover:-translate-y-px active:translate-y-0 ${
                    selectedMonthKeys.has(month.key)
                      ? "border-brand/30 bg-brand/10 text-brand shadow-sm"
                      : "border-canvas-200 bg-canvas-50 text-canvas-600 hover:border-canvas-300 hover:bg-canvas-100"
                  }`}
                >
                  {month.label}
                  <span className="ml-1.5 font-mono text-xs opacity-80">{month.count}</span>
                </button>
              ))}
            </div>

            <div className="mt-3 flex items-center gap-3 text-xs">
              <button type="button" className="font-semibold text-brand hover:underline" onClick={onSelectAllMonths}>
                Select all
              </button>
              <span className="text-canvas-300">|</span>
              <button type="button" className="font-semibold text-canvas-500 hover:underline" onClick={onClearMonths}>
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-canvas-200 bg-canvas-50/90 p-4 transition-all duration-200 hover:-translate-y-px hover:border-canvas-300">
        <div className={labelClass}>Remember mapping</div>
        <div className="mt-3 grid gap-2">
          {rememberChoices.map((choice) => (
            <label
              key={choice.key}
              className={`flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2.5 transition-all duration-200 ${
                choice.disabled
                  ? "cursor-not-allowed border-canvas-200 bg-canvas-100/80 text-canvas-400"
                  : rememberChoice === choice.key
                    ? "border-brand/30 bg-brand/[0.07] text-canvas-800 shadow-sm"
                    : "border-canvas-200 bg-canvas-50 text-canvas-600 hover:-translate-y-px hover:border-canvas-300"
              }`}
            >
              <span className="text-sm font-medium select-none">{choice.label}</span>
              <input
                type="radio"
                name="remember-mapping"
                checked={rememberChoice === choice.key}
                onChange={() => onRememberChoiceChange(choice.key)}
                disabled={choice.disabled}
                className="h-4 w-4 accent-brand"
              />
            </label>
          ))}
        </div>

        {rememberChoice === "save" && (
          <div className="mt-3">
            <div className={`${labelClass} mb-1`}>Mapping name</div>
            <Input value={rememberName} onChange={(e) => onRememberNameChange(e.target.value)} />
            {rememberError && <div className="mt-2 text-xs text-finance-expense">{rememberError}</div>}
          </div>
        )}

        {rememberChoice === "update" && (
          <div className="mt-3">
            <div className={`${labelClass} mb-1`}>Updating</div>
            <Input value={presetInfoName} disabled />
            <div className="mt-2 text-[11px] text-finance-expense">This will overwrite the saved mapping.</div>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="primary"
          onClick={onImport}
          disabled={!canImport || importBusy}
          className="gap-2"
          aria-label="Import data"
        >
          {importBusy ? "Importing..." : isLastFile ? "Import" : "Import this file"}
        </Button>

        {canImport ? (
          <div className="flex items-center gap-1.5 text-xs text-finance-income">
            <CheckCircle2 className="h-4 w-4" />
            <span className="font-semibold select-none">Ready to import</span>
          </div>
        ) : (
          missingFields.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-canvas-500">
              <AlertTriangle className="h-4 w-4 text-canvas-400" />
              <div className="flex flex-wrap gap-1.5">
                {missingFields.map((field) => (
                  <span
                    key={field}
                    className="rounded-full border border-canvas-200 bg-canvas-100 px-2 py-0.5 font-medium select-none"
                  >
                    {field}
                  </span>
                ))}
              </div>
            </div>
          )
        )}
      </div>
    </Card>
  );
};

export default ImportFlowImportPanel;
