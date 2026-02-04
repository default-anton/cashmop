import { AlertTriangle, CheckCircle2 } from "lucide-react";

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
      <div className="font-sans text-canvas-800">
        {model.warning && (
          <div
            className={`mb-6 flex items-start gap-3 rounded-xl border px-4 py-3 ${
              model.warning.tone === "error"
                ? "bg-finance-expense/10 border-finance-expense/20 text-finance-expense"
                : "bg-yellow-100 border-yellow-300 text-yellow-800"
            }`}
          >
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div className="select-none">
              <p className="text-sm font-semibold select-none">{model.warning.title}</p>
              <p className="text-sm select-none">{model.warning.detail}</p>
            </div>
          </div>
        )}

        {model.importComplete ? (
          <div className="bg-canvas-50/30 border border-canvas-200/50 rounded-2xl p-8 backdrop-blur-sm shadow-card flex flex-col items-center justify-center py-12 animate-snap-in">
            <div className="w-20 h-20 bg-finance-income/10 rounded-full flex items-center justify-center mb-6 text-finance-income">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-3xl font-bold text-canvas-800 mb-2 select-none">Import Complete!</h2>
            <p className="text-canvas-500 text-center max-w-md select-none">
              Your transactions have been successfully imported.
            </p>
            <Button onClick={model.resetImport} variant="primary" className="mt-8">
              Import More
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {showFilePicker && (
              <Card variant="glass" className="p-6">
                <h2 className="text-xl font-bold mb-4 select-none">Import Transactions</h2>
                <FileDropZone
                  busy={model.parseBusy}
                  error={model.parseError}
                  multiple={true}
                  onFileSelected={(file) => model.handleFilesSelected([file])}
                  onFilesSelected={model.handleFilesSelected}
                />

                {model.fileErrors.size > 0 && (
                  <div className="mt-6">
                    <h4 className="text-sm font-semibold text-finance-expense mb-2 select-none">File Errors</h4>
                    <div className="space-y-2">
                      {Array.from(model.fileErrors.entries()).map(([fileName, error]) => (
                        <div
                          key={fileName}
                          className="text-xs text-canvas-600 bg-canvas-300/60 border border-canvas-400 rounded-lg px-3 py-2 select-none"
                        >
                          <span className="font-mono select-none">{fileName}</span>: {error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            )}

            {model.currentFile && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-canvas-500 uppercase tracking-widest select-none">
                    File {model.currentFileIdx + 1} of {model.parsedFiles.length}
                  </span>
                  <span className="text-sm font-mono text-canvas-700 select-none">{model.currentFile.file.name}</span>
                </div>
              </div>
            )}

            {model.currentFile && (
              <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-6">
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
