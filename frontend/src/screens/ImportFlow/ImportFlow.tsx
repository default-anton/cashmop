import { AlertTriangle, CheckCircle2, FileSpreadsheet, Sparkles } from "lucide-react";

import { Button, Card, ScreenLayout } from "@/components";
import FileDropZone from "./components/FileDropZone";
import ImportFlowImportPanel from "./components/ImportFlowImportPanel";
import ImportFlowMappingPanel from "./components/ImportFlowMappingPanel";
import ImportFlowPreviewTable from "./components/ImportFlowPreviewTable";
import { useImportFlowModel } from "./useImportFlowModel";

interface ImportFlowProps {
  onImportComplete?: () => void;
}

export default function ImportFlow({ onImportComplete }: ImportFlowProps) {
  const model = useImportFlowModel(onImportComplete);
  const showFilePicker = !model.currentFile || !!model.parseError || model.fileErrors.size > 0;

  return (
    <ScreenLayout size="wide">
      <div className="space-y-6 font-sans text-canvas-800">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-3xl border border-brand/25 bg-gradient-to-br from-brand/20 to-indigo-400/20 p-3.5 text-brand shadow-brand-glow">
              <FileSpreadsheet className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-canvas-900 select-none">Import Transactions</h1>
              <p className="mt-1 text-base font-semibold text-canvas-600 select-none">
                Drag files in, verify mappings, and ship clean data into your inbox.
              </p>
            </div>
          </div>

          {model.currentFile && (
            <div className="rounded-2xl border border-canvas-200 bg-canvas-50/95 px-3.5 py-2.5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-canvas-500 select-none">
                File {model.currentFileIdx + 1} of {model.parsedFiles.length}
              </p>
              <p className="mt-0.5 max-w-[18rem] truncate font-mono text-xs text-canvas-700 select-none">
                {model.currentFile.file.name}
              </p>
            </div>
          )}
        </div>

        {model.warning && (
          <div
            className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 ${
              model.warning.tone === "error"
                ? "border-finance-expense/25 bg-finance-expense/10 text-finance-expense"
                : "border-yellow-300 bg-yellow-100 text-yellow-800"
            }`}
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold select-none">{model.warning.title}</p>
              <p className="text-sm select-none">{model.warning.detail}</p>
            </div>
          </div>
        )}

        {model.importComplete ? (
          <Card variant="glass" className="animate-snap-in p-10">
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-finance-income/10 text-finance-income">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h2 className="text-3xl font-black tracking-tight text-canvas-900 select-none">Import Complete!</h2>
              <p className="mt-2 max-w-md text-canvas-600 select-none">
                All selected files are now in your inbox. Ready for categorization when you are.
              </p>
              <Button onClick={model.resetImport} variant="primary" className="mt-8">
                <Sparkles className="h-4 w-4" />
                Import More
              </Button>
            </div>
          </Card>
        ) : (
          <div className="flex flex-col gap-6">
            {showFilePicker && (
              <Card variant="elevated" className="p-6 md:p-7">
                <FileDropZone
                  busy={model.parseBusy}
                  error={model.parseError}
                  multiple={true}
                  onFileSelected={(file) => model.handleFilesSelected([file])}
                  onFilesSelected={model.handleFilesSelected}
                />

                {model.fileErrors.size > 0 && (
                  <div className="mt-6 rounded-2xl border border-finance-expense/25 bg-finance-expense/[0.06] p-4">
                    <h4 className="text-xs font-bold uppercase tracking-[0.1em] text-finance-expense select-none">
                      File errors
                    </h4>
                    <div className="mt-3 space-y-2">
                      {Array.from(model.fileErrors.entries()).map(([fileName, error]) => (
                        <div
                          key={fileName}
                          className="rounded-xl border border-finance-expense/20 bg-canvas-50/80 px-3 py-2 text-xs text-canvas-700"
                        >
                          <span className="font-mono text-[11px] select-none">{fileName}</span>: {error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            )}

            {model.currentFile && (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                <div className="self-start xl:sticky xl:top-28">
                  <ImportFlowMappingPanel
                    mapping={model.mapping}
                    presetInput={model.presetInput}
                    presetOptions={model.presetOptions}
                    presetInfoName={model.presetInfo.name}
                    showAutoMatchBanner={model.showAutoMatchBanner}
                    showPrefillBanner={model.showPrefillBanner}
                    onPresetInputChange={model.setPresetInput}
                    onPresetSelect={model.handlePresetSelection}
                    onPresetSubmit={model.handlePresetSubmit}
                    onFocusPreset={() => {
                      const input = document.querySelector(
                        'input[aria-label="Mapping preset"]',
                      ) as HTMLInputElement | null;
                      input?.focus();
                    }}
                    accountOptions={model.availableAccounts}
                    ownerOptions={model.availableOwners}
                    currencyOptions={model.currencyOptions}
                    currencyInput={model.currencyInput}
                    onAccountChange={model.handleAccountChange}
                    onOwnerChange={model.handleOwnerChange}
                    onCurrencySelect={model.handleCurrencySelect}
                    onCurrencyInputChange={model.setCurrencyInput}
                    onClearHeader={(header) => model.handleRoleChange(header, "ignore")}
                    onDescriptionRemove={model.handleDescriptionRemove}
                    onDescriptionReorder={model.handleReorderDescription}
                  />
                </div>

                <div className="flex flex-col gap-6">
                  <ImportFlowPreviewTable
                    headers={model.currentFile.headers}
                    columns={model.visibleColumns}
                    rows={model.previewRows}
                    mapping={model.mapping}
                    roleOptions={model.roleOptions}
                    amountHint={model.amountHint}
                    onRoleChange={model.handleRoleChange}
                    onInvertToggle={model.handleInvertToggle}
                    onDirectionValueChange={model.handleDirectionValueChange}
                  />

                  <ImportFlowImportPanel
                    mapping={model.mapping}
                    monthOptions={model.monthOptions}
                    selectedMonthKeys={model.selectedMonthKeys}
                    onToggleMonth={model.toggleMonth}
                    onSelectAllMonths={model.selectAllMonths}
                    onClearMonths={model.clearMonths}
                    rememberChoice={model.rememberChoice}
                    rememberName={model.rememberName}
                    rememberError={model.rememberError}
                    presetInfoName={model.presetInfo.name}
                    canUpdatePreset={model.canUpdatePreset}
                    onRememberChoiceChange={model.handleRememberChoice}
                    onRememberNameChange={model.handleRememberNameChange}
                    canImport={model.canImport}
                    importBusy={model.importBusy}
                    isLastFile={model.isLastFile}
                    missingFields={model.missingFields}
                    onImport={model.handleImport}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </ScreenLayout>
  );
}
