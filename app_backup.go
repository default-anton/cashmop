package main

import (
	"fmt"
	"os"
	osexec "os/exec"
	stdlibRuntime "runtime"
	"strings"
	"time"

	"github.com/default-anton/cashmop/internal/database"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

func (a *App) CreateManualBackup() (string, error) {
	timestamp := time.Now().Format("20060102_150405")
	defaultFilename := fmt.Sprintf("cashmop_backup_%s.db", timestamp)

	var destinationPath string
	var err error
	if isTestEnv() {
		destinationPath, err = a.testSavePath("backup", "db")
	} else {
		destinationPath, err = wailsRuntime.SaveFileDialog(a.ctx, wailsRuntime.SaveDialogOptions{
			Title:           "Create Backup",
			DefaultFilename: defaultFilename,
			Filters: []wailsRuntime.FileFilter{
				{DisplayName: "SQLite Database", Pattern: "*.db"},
				{DisplayName: "All Files", Pattern: "*.*"},
			},
		})
	}
	if err != nil {
		return "", err
	}
	if destinationPath == "" {
		return "", nil
	}

	if err := a.svc.CreateBackup(destinationPath); err != nil {
		return "", fmt.Errorf("Unable to create backup: %s", err.Error())
	}

	return destinationPath, nil
}

func (a *App) GetLastBackupInfo() (map[string]interface{}, error) {
	lastTime, err := a.svc.GetLastBackupTime()
	if err != nil {
		return nil, err
	}

	last := ""
	if !lastTime.IsZero() {
		last = lastTime.Format(time.RFC3339)
	}

	return map[string]interface{}{
		"lastBackupTime": last,
		"hasBackup":      !lastTime.IsZero(),
	}, nil
}

func (a *App) ValidateBackupFile(path string) (*database.BackupMetadata, error) {
	txCount, err := a.svc.ValidateBackup(path)
	if err != nil {
		return nil, err
	}

	info, err := os.Stat(path)
	if err != nil {
		return nil, err
	}

	return &database.BackupMetadata{
		Path:             path,
		Size:             info.Size(),
		TransactionCount: txCount,
		CreatedAt:        info.ModTime(),
	}, nil
}

func (a *App) SelectBackupFile() (*database.BackupMetadata, error) {
	var backupPath string
	var err error
	if isTestEnv() {
		backupPath, err = a.testRestorePath()
	} else {
		backupPath, err = wailsRuntime.OpenFileDialog(a.ctx, wailsRuntime.OpenDialogOptions{
			Title: "Select Backup to Restore",
			Filters: []wailsRuntime.FileFilter{
				{DisplayName: "SQLite Database", Pattern: "*.db"},
			},
		})
	}
	if err != nil {
		return nil, err
	}
	if backupPath == "" {
		return nil, fmt.Errorf("No backup file selected.")
	}

	return a.ValidateBackupFile(backupPath)
}

func (a *App) RestoreBackup(backupPath string) error {
	if strings.TrimSpace(backupPath) == "" {
		return fmt.Errorf("No backup file selected.")
	}
	return a.svc.RestoreBackup(backupPath)
}

func (a *App) RestoreBackupFromDialog() (string, error) {
	meta, err := a.SelectBackupFile()
	if err != nil {
		return "", err
	}

	if err := a.svc.RestoreBackup(meta.Path); err != nil {
		return "", fmt.Errorf("Unable to restore backup: %s", err.Error())
	}

	return meta.Path, nil
}

func (a *App) OpenBackupFolder() (string, error) {
	backupDir, err := a.svc.EnsureBackupDir()
	if err != nil {
		return "", err
	}

	if isTestEnv() {
		return backupDir, nil
	}

	var cmd *osexec.Cmd
	switch stdlibRuntime.GOOS {
	case "darwin":
		cmd = osexec.Command("open", backupDir)
	case "windows":
		cmd = osexec.Command("explorer", backupDir)
	default:
		cmd = osexec.Command("xdg-open", backupDir)
	}

	if err := cmd.Start(); err != nil {
		return backupDir, nil
	}

	return backupDir, nil
}

func (a *App) TriggerAutoBackup() (string, error) {
	shouldBackup, err := a.svc.ShouldAutoBackup()
	if err != nil {
		return "", err
	}

	if !shouldBackup {
		return "", nil
	}

	return a.svc.CreateAutoBackup()
}
