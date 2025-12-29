import React, { useEffect, useState } from 'react';
import { Database, Download, Upload, Folder, Clock, Check, AlertTriangle, HardDrive, RefreshCcw } from 'lucide-react';
import { Card, Button, Toast } from '../../components';

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
  const [backupInfo, setBackupInfo] = useState<BackupInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<BackupMetadata | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showRestartNotice, setShowRestartNotice] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  const fetchBackupInfo = async () => {
    try {
      const info = await (window as any).go.main.App.GetLastBackupInfo();
      setBackupInfo(info);
    } catch (e) {
      console.error('Failed to fetch backup info', e);
      setToast({ message: 'Failed to load backup info', type: 'error' });
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
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const handleCreateBackup = async () => {
    setBackupLoading(true);
    try {
      const path = await (window as any).go.main.App.CreateManualBackup();
      if (path) {
        setToast({ message: 'Backup created successfully', type: 'success' });
        await fetchBackupInfo();
      }
    } catch (e: any) {
      console.error('Failed to create backup', e);
      setToast({ message: `Failed to create backup: ${e?.message || 'Unknown error'}`, type: 'error' });
    } finally {
      setBackupLoading(false);
    }
  };

  const handleOpenBackupFolder = async () => {
    try {
      await (window as any).go.main.App.OpenBackupFolder();
    } catch (e: any) {
      console.error('Failed to open backup folder', e);
      setToast({ message: `Failed to open backup folder: ${e?.message || 'Unknown error'}`, type: 'error' });
    }
  };

  const handleSelectBackup = async () => {
    try {
      const meta: BackupMetadata = await (window as any).go.main.App.SelectBackupFile();
      setSelectedBackup(meta);
      setShowRestoreConfirm(true);
      setToast({ message: 'Backup validated. Review details before restoring.', type: 'warning' });
    } catch (e: any) {
      if (e?.message?.toLowerCase().includes('cancelled')) {
        return;
      }
      console.error('Failed to validate backup', e);
      setToast({ message: `Invalid backup file: ${e?.message || 'Unknown error'}`, type: 'error' });
    }
  };

  const handleConfirmRestore = async () => {
    if (!selectedBackup) return;
    setRestoreLoading(true);
    try {
      await (window as any).go.main.App.RestoreBackup(selectedBackup.path);
      setToast({ message: 'Database restored. Please restart the application.', type: 'success' });
      setShowRestoreConfirm(false);
      setShowRestartNotice(true);
    } catch (e: any) {
      console.error('Failed to restore backup', e);
      setToast({ message: `Failed to restore backup: ${e?.message || 'Unknown error'}`, type: 'error' });
    } finally {
      setRestoreLoading(false);
    }
  };

  const handleCancelRestore = () => {
    setShowRestoreConfirm(false);
    setSelectedBackup(null);
  };

  return (
    <div className="min-h-screen pt-24 pb-12 px-8 bg-canvas-100 texture-delight">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-brand/10 text-brand rounded-2xl shadow-brand/5 shadow-inner">
            <Database className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-canvas-800">Settings</h1>
            <p className="text-canvas-500 font-medium">Backup and restore your data</p>
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

        <Card variant="glass" className="p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-canvas-100 rounded-xl">
                <Clock className="w-6 h-6 text-canvas-500" />
              </div>
              <div>
                <p className="text-sm uppercase text-canvas-500 font-bold mb-1">Last Auto Backup</p>
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

        <Card variant="glass" className="p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Download className="w-6 h-6 text-brand" />
            <h2 className="text-xl font-bold text-canvas-800">Manual Backup</h2>
          </div>
          <p className="text-canvas-600 mb-4">
            Create a backup of your entire database. You can save it anywhere on your computer.
          </p>
          <div className="flex gap-3">
            <Button
              variant="primary"
              onClick={handleCreateBackup}
              disabled={backupLoading}
              className="px-4 py-2"
            >
              {backupLoading ? 'Creating Backup...' : 'Create Backup'}
            </Button>
            <Button
              variant="secondary"
              onClick={handleOpenBackupFolder}
              className="px-4 py-2 flex items-center"
            >
              <Folder className="w-4 h-4 mr-2" />
              Open Backup Folder
            </Button>
          </div>
        </Card>

        <Card variant="glass" className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Upload className="w-6 h-6 text-finance-expense" />
            <h2 className="text-xl font-bold text-canvas-800">Restore from Backup</h2>
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
            <Button
              variant="secondary"
              onClick={handleSelectBackup}
              className="px-4 py-2 flex items-center"
            >
              <Upload className="w-4 h-4 mr-2" />
              Select Backup File
            </Button>
          ) : (
            <div className="bg-canvas-50 rounded-xl p-4 border border-canvas-200">
              <div className="flex items-start gap-3 mb-4">
                <HardDrive className="w-5 h-5 text-canvas-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-canvas-800 mb-2">Backup Details</p>
                  <div className="space-y-1 text-sm">
                    <p className="text-canvas-600">
                      <span className="font-medium">Transactions:</span> {selectedBackup?.transaction_count?.toLocaleString()}
                    </p>
                    <p className="text-canvas-600">
                      <span className="font-medium">Size:</span> {formatBytes(selectedBackup?.size || 0)}
                    </p>
                    <p className="text-canvas-600">
                      <span className="font-medium">Created:</span> {formatDate(selectedBackup?.created_at || '')}
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
                  {restoreLoading ? 'Restoring...' : 'Restore Backup'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleCancelRestore}
                  className="px-4 py-2"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </Card>

        <Card variant="glass" className="p-6 mt-6">
          <div className="flex items-center gap-3 mb-3">
            <Clock className="w-5 h-5 text-canvas-500" />
            <h3 className="font-semibold text-canvas-800">Automatic Backups</h3>
          </div>
          <p className="text-sm text-canvas-600">
            Automatic backups run daily when 24+ hours have passed since the last backup, before database migrations, and on app exit. The last 10 daily and 5 weekly backups are retained in your backup folder.
          </p>
        </Card>
      </div>

      {toast && (
        <div className="fixed bottom-4 right-4 z-50">
          <Toast
            message={toast.message}
            type={toast.type === 'warning' ? 'warning' : toast.type}
            duration={4000}
            onClose={() => setToast(null)}
          />
        </div>
      )}
    </div>
  );
};

export default Settings;
