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
  return (
    <Card variant="glass" className="p-6">
      <div className="text-[10px] font-bold text-canvas-500 uppercase tracking-widest select-none">Import</div>

      <div className="mt-4 rounded-xl border border-canvas-200 bg-canvas-50 p-4">
        <div className="text-[10px] font-bold text-canvas-500 uppercase tracking-wider select-none">
          Months (per file)
        </div>
        {!mapping.csv.date && (
          <div className="mt-2 text-xs text-canvas-500 select-none">Map a Date column to see month options.</div>
        )}
        {mapping.csv.date && (
          <div className="mt-3">
            <div className="flex flex-wrap gap-2">
              {monthOptions.map((month) => (
                <button
                  key={month.key}
                  type="button"
                  onClick={() => onToggleMonth(month.key)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                    selectedMonthKeys.has(month.key)
                      ? "bg-brand/10 text-brand border-brand/30"
                      : "bg-canvas-50 text-canvas-600 border-canvas-200"
                  }`}
                >
                  {month.label}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-3 text-[11px] text-canvas-500">
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

      <div className="mt-4 rounded-xl border border-canvas-200 bg-canvas-50 p-4">
        <div className="text-[10px] font-bold text-canvas-500 uppercase tracking-wider select-none">
          Remember mapping
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="remember-mapping"
              checked={rememberChoice === "off"}
              onChange={() => onRememberChoiceChange("off")}
            />
            Off
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="remember-mapping"
              checked={rememberChoice === "save"}
              onChange={() => onRememberChoiceChange("save")}
            />
            Save as new
          </label>
          <label className={`flex items-center gap-2 ${canUpdatePreset ? "" : "opacity-40"}`}>
            <input
              type="radio"
              name="remember-mapping"
              checked={rememberChoice === "update"}
              onChange={() => onRememberChoiceChange("update")}
              disabled={!canUpdatePreset}
            />
            Update selected
          </label>
        </div>

        {rememberChoice === "save" && (
          <div className="mt-3">
            <div className="text-[10px] font-bold text-canvas-500 uppercase tracking-wider mb-1 select-none">
              Mapping name
            </div>
            <Input value={rememberName} onChange={(e) => onRememberNameChange(e.target.value)} />
            {rememberError && <div className="mt-2 text-xs text-finance-expense">{rememberError}</div>}
          </div>
        )}

        {rememberChoice === "update" && (
          <div className="mt-3">
            <div className="text-[10px] font-bold text-canvas-500 uppercase tracking-wider mb-1 select-none">
              Updating
            </div>
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
        {!canImport && missingFields.length > 0 && (
          <div className="text-xs text-canvas-500 select-none">Missing: {missingFields.join(", ")}</div>
        )}
      </div>
    </Card>
  );
};

export default ImportFlowImportPanel;
