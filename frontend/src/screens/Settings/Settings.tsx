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
  }, [settings]);

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
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-brand/10 text-brand rounded-2xl shadow-brand/5 shadow-inner">
          <Database className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-canvas-800 select-none">Settings</h1>
          <p className="text-canvas-500 font-medium select-none">Backup and restore your data</p>
        </div>
      </div>

      {showRestartNotice && (
        <div className="mb-6 p-4 bg-brand/10 text-brand border border-brand/20 rounded-xl flex items-start gap-3">
          <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Database restored successfully.</p>
            <p className="text-sm mt-1">Please restart the application to complete the restore.</p>
          </div>
        </div>
      )}

      <Card variant="elevated" className="p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Globe className="w-6 h-6 text-brand" />
          <h2 className="text-xl font-bold text-canvas-800 select-none">Currency</h2>
        </div>

        {!isBaseSupported && (
          <div className="mb-4 bg-finance-expense/10 border border-finance-expense/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-finance-expense flex-shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-finance-expense">
                Exchange rate conversion is unavailable for {mainCurrency}. Select a supported main currency to enable
                conversions.
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase text-canvas-500 font-bold mb-2 select-none">Main Currency</p>
            <AutocompleteInput
              value={mainCurrencyInput}
              onChange={setMainCurrencyInput}
              onSelect={handleMainCurrencySelect}
              options={currencyOptions}
              placeholder="Search currency"
              className="w-full"
            />
            <p className="text-xs text-canvas-500 mt-2">Only currencies with official providers can be converted.</p>
          </div>
        </div>

        <div className="mt-5 bg-canvas-50 border border-canvas-200 rounded-lg p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Clock
                className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isStale ? "text-finance-expense" : "text-canvas-500"}`}
              />
              <div>
                <p className="text-sm font-semibold text-canvas-800 select-none">Exchange rate freshness</p>
                <p className={`text-sm ${isStale ? "text-finance-expense" : "text-canvas-600"}`}>
                  {latestRateDate
                    ? `Latest rate date: ${formatDateOnly(latestRateDate)}.`
                    : "No exchange rates cached yet."}
                  {isStale && latestRateDate ? ` Rates are ${staleDays} days old.` : ""}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <div className="flex items-baseline gap-2">
                <p className="text-xs uppercase text-canvas-500 font-bold select-none">Rates</p>
                <p className="text-xs text-canvas-500 hidden md:block">Pull only what your transactions need.</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSyncFxRates}
                disabled={fxSyncing || !isBaseSupported}
                className="px-3 py-1.5 flex items-center gap-2"
              >
                <RefreshCcw className="w-4 h-4" />
                {fxSyncing ? "Syncing…" : "Sync rates"}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card variant="elevated" className="p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-canvas-100 rounded-xl">
              <Clock className="w-6 h-6 text-canvas-500" />
            </div>
            <div>
              <p className="text-sm uppercase text-canvas-500 font-bold mb-1 select-none">Last Auto Backup</p>
              {loading ? (
                <p className="text-canvas-700">Loading...</p>
              ) : backupInfo?.hasBackup ? (
                <p className="text-canvas-800 font-semibold">{formatDate(backupInfo.lastBackupTime)}</p>
              ) : (
                <p className="text-canvas-600">Never</p>
              )}
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchBackupInfo}
            className="px-3 py-1.5 flex items-center gap-2"
          >
            <RefreshCcw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </Card>

      <Card variant="elevated" className="p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Download className="w-6 h-6 text-brand" />
          <h2 className="text-xl font-bold text-canvas-800 select-none">Manual Backup</h2>
        </div>
        <p className="text-canvas-600 mb-4">
          Create a backup of your entire database. You can save it anywhere on your computer.
        </p>
        <div className="flex gap-3">
          <Button variant="primary" onClick={handleCreateBackup} disabled={backupLoading} className="px-4 py-2">
            {backupLoading ? "Creating Backup..." : "Create Backup"}
          </Button>
          <Button variant="secondary" onClick={handleOpenBackupFolder} className="px-4 py-2 flex items-center">
            <Folder className="w-4 h-4 mr-2" />
            Open Backup Folder
          </Button>
        </div>
      </Card>

      <Card variant="elevated" className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Upload className="w-6 h-6 text-finance-expense" />
          <h2 className="text-xl font-bold text-canvas-800 select-none">Restore from Backup</h2>
        </div>
        <p className="text-canvas-600 mb-4">
          Restore your database from a backup file. This will replace all current data.
        </p>

        <div className="bg-finance-expense/10 border border-finance-expense/20 rounded-lg p-3 mb-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-finance-expense flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-finance-expense">
              Warning: This will replace your current data. A safety backup will be created before restoring.
            </p>
          </div>
        </div>

        {!showRestoreConfirm ? (
          <Button variant="secondary" onClick={handleSelectBackup} className="px-4 py-2 flex items-center">
            <Upload className="w-4 h-4 mr-2" />
            Select Backup File
          </Button>
        ) : (
          <div className="bg-canvas-50 rounded-xl p-4 border border-canvas-200">
            <div className="flex items-start gap-3 mb-4">
              <HardDrive className="w-5 h-5 text-canvas-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-canvas-800 mb-2 select-none">Backup Details</p>
                <div className="space-y-1 text-sm">
                  <p className="text-canvas-600">
                    <span className="font-medium select-none">Transactions:</span>{" "}
                    {selectedBackup?.transaction_count?.toLocaleString()}
                  </p>
                  <p className="text-canvas-600">
                    <span className="font-medium select-none">Size:</span> {formatBytes(selectedBackup?.size || 0)}
                  </p>
                  <p className="text-canvas-600">
                    <span className="font-medium select-none">Created:</span>{" "}
                    {formatDate(selectedBackup?.created_at || "")}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-finance-expense/10 border border-finance-expense/20 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-finance-expense flex-shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-finance-expense">
                  This will replace your current data. Make sure you have a recent backup if needed.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="primary"
                onClick={handleConfirmRestore}
                disabled={restoreLoading}
                className="px-4 py-2 bg-finance-expense hover:bg-red-700"
              >
                {restoreLoading ? "Restoring..." : "Restore Backup"}
              </Button>
              <Button variant="secondary" onClick={handleCancelRestore} className="px-4 py-2">
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card variant="elevated" className="p-6 mt-6">
        <div className="flex items-center gap-3 mb-3">
          <Clock className="w-5 h-5 text-canvas-500" />
          <h3 className="font-semibold text-canvas-800 select-none">Automatic Backups</h3>
        </div>
        <p className="text-sm text-canvas-600">
          Automatic backups run daily when 24+ hours have passed since the last backup, before database migrations, and
          on app exit. The last 10 daily and 5 weekly backups are retained in your backup folder.
        </p>
      </Card>
    </ScreenLayout>
  );
};

export default Settings;
