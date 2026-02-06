import {
  AlertTriangle,
  Check,
  Clock,
  Database,
  Download,
  Folder,
  Globe,
  HardDrive,
  RefreshCcw,
  Upload,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { AutocompleteInput, Button, Card, ScreenLayout, useToast } from "../../components";

interface BackupInfo {
  hasBackup: boolean;
  lastBackupTime: string;
}

interface BackupMetadata {
  path: string;
  size: number;
  transaction_count: number;
  created_at: string;
}

const Settings: React.FC = () => {
  const toast = useToast();
  const [backupInfo, setBackupInfo] = useState<BackupInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<BackupMetadata | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showRestartNotice, setShowRestartNotice] = useState(false);
  const [, setCurrencySaving] = useState(false);
  const [fxSyncing, setFxSyncing] = useState(false);

  const { settings, currencyOptions, updateSettings, refresh, latestRateDate, isStale, staleDays, isBaseSupported } =
    useCurrency();

  const [mainCurrency, setMainCurrency] = useState("CAD");
  const [mainCurrencyInput, setMainCurrencyInput] = useState("CAD");

  const fetchBackupInfo = async () => {
    try {
      const info = await (window as any).go.main.App.GetLastBackupInfo();
      setBackupInfo(info);
    } catch (e) {
      console.error("Failed to fetch backup info", e);
      toast.showToast("Failed to load backup info", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackupInfo();
  }, []);

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const formatDateOnly = (dateString: string): string => {
    if (!dateString) return "Never";
    const date = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "Never";
    return date.toLocaleDateString();
  };

  useEffect(() => {
    if (!settings) return;
    setMainCurrency(settings.main_currency);
    const label =
      currencyOptions.find((option) => option.value === settings.main_currency)?.label || settings.main_currency;
    setMainCurrencyInput(label);
  }, [settings, currencyOptions]);

  const handleMainCurrencySelect = async (value: string) => {
    if (!settings) return;
    setMainCurrency(value);
    setCurrencySaving(true);
    try {
      await updateSettings({ ...settings, main_currency: value });
    } catch (e: any) {
      console.error("Failed to update main currency", e);
      toast.showToast(`Failed to update currency: ${e?.message || "Unknown error"}`, "error");
      setMainCurrency(settings.main_currency);
    } finally {
      setCurrencySaving(false);
    }
  };

  const handleSyncFxRates = async () => {
    if (!isBaseSupported) return;
    setFxSyncing(true);
    try {
      await (window as any).go.main.App.SyncFxRatesNow();
      await refresh();
    } catch (e: any) {
      console.error("Failed to sync exchange rates", e);
      toast.showToast(`Couldn't fetch exchange rates: ${e?.message || "Unknown error"}`, "error");
    } finally {
      setFxSyncing(false);
    }
  };

  const handleCreateBackup = async () => {
    setBackupLoading(true);
    try {
      const path = await (window as any).go.main.App.CreateManualBackup();
      if (path) {
        toast.showToast("Backup created successfully", "success");
        await fetchBackupInfo();
      }
    } catch (e: any) {
      console.error("Failed to create backup", e);
      toast.showToast(`Failed to create backup: ${e?.message || "Unknown error"}`, "error");
    } finally {
      setBackupLoading(false);
    }
  };

  const handleOpenBackupFolder = async () => {
    try {
      await (window as any).go.main.App.OpenBackupFolder();
    } catch (e: any) {
      console.error("Failed to open backup folder", e);
      toast.showToast(`Failed to open backup folder: ${e?.message || "Unknown error"}`, "error");
    }
  };

  const handleSelectBackup = async () => {
    try {
      const meta: BackupMetadata = await (window as any).go.main.App.SelectBackupFile();
      setSelectedBackup(meta);
      setShowRestoreConfirm(true);
      toast.showToast("Backup validated. Review details before restoring.", "warning");
    } catch (e: any) {
      if (e?.message?.toLowerCase().includes("cancelled")) {
        return;
      }
      console.error("Failed to validate backup", e);
      toast.showToast(`Invalid backup file: ${e?.message || "Unknown error"}`, "error");
    }
  };

  const handleConfirmRestore = async () => {
    if (!selectedBackup) return;
    setRestoreLoading(true);
    try {
      await (window as any).go.main.App.RestoreBackup(selectedBackup.path);
      toast.showToast("Database restored. Please restart the application.", "success");
      setShowRestoreConfirm(false);
      setShowRestartNotice(true);
    } catch (e: any) {
      console.error("Failed to restore backup", e);
      toast.showToast(`Failed to restore backup: ${e?.message || "Unknown error"}`, "error");
    } finally {
      setRestoreLoading(false);
    }
  };

  const handleCancelRestore = () => {
    setShowRestoreConfirm(false);
    setSelectedBackup(null);
  };

  return (
    <ScreenLayout size="medium">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-3xl border border-brand/25 bg-gradient-to-br from-brand/20 to-indigo-400/20 p-3.5 text-brand shadow-brand-glow">
              <Database className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-canvas-900 select-none">Settings</h1>
              <p className="mt-1 text-base font-semibold text-canvas-600 select-none">
                Keep your money setup healthy and your backups recoverable.
              </p>
            </div>
          </div>
        </div>

        {showRestartNotice && (
          <div className="flex items-start gap-3 rounded-2xl border border-brand/25 bg-brand/10 px-4 py-3.5 text-brand">
            <Check className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold select-none">Database restored successfully</p>
              <p className="text-sm select-none">Restart the app to complete the restore.</p>
            </div>
          </div>
        )}

        <Card variant="default" className="space-y-4 p-5 shadow-card">
          <div className="flex items-center gap-2.5">
            <Globe className="h-5 w-5 text-brand" />
            <h2 className="text-lg font-bold text-canvas-900 select-none">Currency & rates</h2>
          </div>

          {!isBaseSupported && (
            <div className="rounded-2xl border border-finance-expense/25 bg-finance-expense/10 px-4 py-3 text-finance-expense">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <p className="text-sm font-medium">
                  Exchange-rate conversion is unavailable for {mainCurrency}. Pick a supported main currency to turn
                  conversions back on.
                </p>
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-canvas-500 select-none">
              Main currency
            </p>
            <AutocompleteInput
              value={mainCurrencyInput}
              onChange={setMainCurrencyInput}
              onSelect={handleMainCurrencySelect}
              options={currencyOptions}
              placeholder="Search currency"
              className="w-full md:max-w-xs"
            />
            <p className="mt-2 text-sm text-canvas-600">Only currencies with official providers can be converted.</p>
          </div>

          <div className="rounded-2xl border border-canvas-200 bg-canvas-50/90 px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <Clock
                  className={`mt-0.5 h-4 w-4 flex-shrink-0 ${isStale ? "text-finance-expense" : "text-canvas-500"}`}
                />
                <div>
                  <p className="text-sm font-bold text-canvas-800 select-none">Exchange-rate freshness</p>
                  <p className={`text-sm ${isStale ? "text-finance-expense" : "text-canvas-600"}`}>
                    {latestRateDate
                      ? `Latest rate date: ${formatDateOnly(latestRateDate)}.`
                      : "No exchange rates cached yet."}
                    {isStale && latestRateDate ? ` Rates are ${staleDays} days old.` : ""}
                  </p>
                </div>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={handleSyncFxRates}
                disabled={fxSyncing || !isBaseSupported}
                className="w-fit whitespace-nowrap"
              >
                <RefreshCcw className="h-4 w-4" />
                {fxSyncing ? "Syncing…" : "Sync rates"}
              </Button>
            </div>
          </div>
        </Card>

        <Card variant="default" className="p-5 shadow-card">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-canvas-100 p-2.5 text-canvas-600">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-canvas-500 select-none">
                  Last auto backup
                </p>
                {loading ? (
                  <p className="text-sm font-semibold text-canvas-700">Loading…</p>
                ) : backupInfo?.hasBackup ? (
                  <p className="text-sm font-semibold text-canvas-900">{formatDate(backupInfo.lastBackupTime)}</p>
                ) : (
                  <p className="text-sm font-semibold text-canvas-600">Never</p>
                )}
              </div>
            </div>

            <Button variant="secondary" size="sm" onClick={fetchBackupInfo} className="w-fit whitespace-nowrap">
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card variant="default" className="space-y-4 p-5 shadow-card">
            <div className="flex items-center gap-2.5">
              <Download className="h-5 w-5 text-brand" />
              <h2 className="text-lg font-bold text-canvas-900 select-none">Manual backup</h2>
            </div>
            <p className="text-sm text-canvas-600">
              Create a full snapshot of your database and store it wherever you want.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                onClick={handleCreateBackup}
                disabled={backupLoading}
                className="whitespace-nowrap"
              >
                {backupLoading ? "Creating backup…" : "Create backup"}
              </Button>
              <Button variant="secondary" onClick={handleOpenBackupFolder} className="whitespace-nowrap">
                <Folder className="h-4 w-4" />
                Open backup folder
              </Button>
            </div>
          </Card>

          <Card variant="default" className="space-y-4 p-5 shadow-card">
            <div className="flex items-center gap-2.5">
              <Upload className="h-5 w-5 text-finance-expense" />
              <h2 className="text-lg font-bold text-canvas-900 select-none">Restore backup</h2>
            </div>
            <p className="text-sm text-canvas-600">Replace your current database using a previous backup file.</p>

            <div className="rounded-2xl border border-finance-expense/25 bg-finance-expense/10 px-4 py-3 text-finance-expense">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <p className="text-sm font-medium">This replaces current data. A safety backup is created first.</p>
              </div>
            </div>

            {!showRestoreConfirm ? (
              <Button variant="secondary" onClick={handleSelectBackup} className="w-fit whitespace-nowrap">
                <Upload className="h-4 w-4" />
                Select backup file
              </Button>
            ) : (
              <div className="space-y-3 rounded-2xl border border-canvas-200 bg-canvas-50/90 p-4">
                <div className="flex items-start gap-3">
                  <HardDrive className="mt-0.5 h-4 w-4 flex-shrink-0 text-canvas-500" />
                  <div className="space-y-1 text-sm text-canvas-700">
                    <p className="font-semibold text-canvas-900 select-none">Backup details</p>
                    <p>
                      <span className="font-semibold text-canvas-800 select-none">Transactions:</span>{" "}
                      {selectedBackup?.transaction_count?.toLocaleString()}
                    </p>
                    <p>
                      <span className="font-semibold text-canvas-800 select-none">Size:</span>{" "}
                      {formatBytes(selectedBackup?.size || 0)}
                    </p>
                    <p>
                      <span className="font-semibold text-canvas-800 select-none">Created:</span>{" "}
                      {formatDate(selectedBackup?.created_at || "")}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    onClick={handleConfirmRestore}
                    disabled={restoreLoading}
                    className="!bg-finance-expense hover:!bg-finance-expense/90 whitespace-nowrap"
                  >
                    {restoreLoading ? "Restoring…" : "Restore backup"}
                  </Button>
                  <Button variant="secondary" onClick={handleCancelRestore} className="whitespace-nowrap">
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        <Card variant="default" className="p-5 shadow-card">
          <div className="flex items-center gap-2.5">
            <Clock className="h-4 w-4 text-canvas-500" />
            <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-canvas-500 select-none">
              Automatic backups
            </h3>
          </div>
          <p className="mt-2 text-sm text-canvas-600">
            Automatic backups run daily when 24+ hours have passed since the last backup, before database migrations,
            and on app exit. The last 10 daily and 5 weekly backups are retained in your backup folder.
          </p>
        </Card>
      </div>
    </ScreenLayout>
  );
};

export default Settings;
