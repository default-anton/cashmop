package database

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestCreateBackup(t *testing.T) {
	store := newTestStore(t)
	defer store.Close()

	tempDir := t.TempDir()
	backupPath := filepath.Join(tempDir, "test_backup.db")

	if err := store.CreateBackup(backupPath); err != nil {
		t.Fatalf("CreateBackup failed: %v", err)
	}

	info, err := os.Stat(backupPath)
	if err != nil {
		t.Fatalf("Backup file not created: %v", err)
	}
	if info.Size() == 0 {
		t.Fatal("Backup file is empty")
	}

	txCount, err := store.ValidateBackup(backupPath)
	if err != nil {
		t.Fatalf("Backup validation failed: %v", err)
	}

	var originalCount int64
	err = store.DB().QueryRow("SELECT COUNT(*) FROM transactions").Scan(&originalCount)
	if err != nil {
		t.Fatalf("Failed to count original transactions: %v", err)
	}

	if txCount != originalCount {
		t.Errorf("Backup has %d transactions, expected %d", txCount, originalCount)
	}
}

func TestValidateBackup(t *testing.T) {
	store := newTestStore(t)
	defer store.Close()

	tempDir := t.TempDir()

	t.Run("valid backup file", func(t *testing.T) {
		backupPath := filepath.Join(tempDir, "valid_backup.db")
		if err := store.CreateBackup(backupPath); err != nil {
			t.Fatalf("Failed to create backup: %v", err)
		}

		txCount, err := store.ValidateBackup(backupPath)
		if err != nil {
			t.Errorf("ValidateBackup failed for valid file: %v", err)
		}
		if txCount < 0 {
			t.Errorf("Invalid transaction count: %d", txCount)
		}
	})

	t.Run("non-existent file", func(t *testing.T) {
		_, err := store.ValidateBackup(filepath.Join(tempDir, "nonexistent.db"))
		if err == nil {
			t.Error("Expected error for non-existent file")
		}
	})

	t.Run("invalid file", func(t *testing.T) {
		invalidPath := filepath.Join(tempDir, "invalid.txt")
		if err := os.WriteFile(invalidPath, []byte("not a database"), 0o644); err != nil {
			t.Fatalf("Failed to write invalid file: %v", err)
		}

		_, err := store.ValidateBackup(invalidPath)
		if err == nil {
			t.Error("Expected error for invalid file")
		}
	})

	t.Run("empty file", func(t *testing.T) {
		emptyPath := filepath.Join(tempDir, "empty.db")
		if err := os.WriteFile(emptyPath, []byte{}, 0o644); err != nil {
			t.Fatalf("Failed to write empty file: %v", err)
		}

		_, err := store.ValidateBackup(emptyPath)
		if err == nil {
			t.Error("Expected error for empty file")
		}
	})
}

func TestRestoreBackup(t *testing.T) {
	store := newTestStore(t)
	defer store.Close()

	tempDir := t.TempDir()
	backupPath := filepath.Join(tempDir, "restore_test.db")

	var initialCount int64
	err := store.DB().QueryRow("SELECT COUNT(*) FROM transactions").Scan(&initialCount)
	if err != nil {
		t.Fatalf("Failed to count initial transactions: %v", err)
	}

	_, err = store.GetOrCreateCategory("TestCategory")
	if err != nil {
		t.Fatalf("Failed to create test category: %v", err)
	}

	accID, err := store.GetOrCreateAccount("TestAccount")
	if err != nil {
		t.Fatalf("Failed to create test account: %v", err)
	}

	tx := TransactionModel{AccountID: accID, Date: "2024-01-01", Description: "Test Transaction", Amount: 100, Currency: "CAD"}
	if err := store.BatchInsertTransactions([]TransactionModel{tx}); err != nil {
		t.Fatalf("Failed to insert test transaction: %v", err)
	}

	var countWithOne int64
	err = store.DB().QueryRow("SELECT COUNT(*) FROM transactions").Scan(&countWithOne)
	if err != nil {
		t.Fatalf("Failed to count transactions after adding: %v", err)
	}

	if err := store.CreateBackup(backupPath); err != nil {
		t.Fatalf("Failed to create backup: %v", err)
	}

	tx2 := TransactionModel{AccountID: accID, Date: "2024-01-02", Description: "Another Transaction", Amount: 200, Currency: "CAD"}
	if err := store.BatchInsertTransactions([]TransactionModel{tx2}); err != nil {
		t.Fatalf("Failed to insert second transaction: %v", err)
	}

	var countBefore int64
	err = store.DB().QueryRow("SELECT COUNT(*) FROM transactions").Scan(&countBefore)
	if err != nil {
		t.Fatalf("Failed to count transactions: %v", err)
	}

	if err := store.RestoreBackup(backupPath); err != nil {
		t.Fatalf("RestoreBackup failed: %v", err)
	}

	var countAfter int64
	err = store.DB().QueryRow("SELECT COUNT(*) FROM transactions").Scan(&countAfter)
	if err != nil {
		t.Fatalf("Failed to count transactions after restore: %v", err)
	}

	if countAfter != countWithOne {
		t.Errorf("Expected %d transactions after restore, got %d", countWithOne, countAfter)
	}
	if countAfter >= countBefore {
		t.Errorf("Expected fewer transactions after restore, got %d (was %d)", countAfter, countBefore)
	}

	_ = initialCount
}

func TestRestoreBackup_InvalidFile(t *testing.T) {
	store := newTestStore(t)
	defer store.Close()

	if err := store.RestoreBackup("/nonexistent/path/backup.db"); err == nil {
		t.Error("Expected error for invalid backup path")
	}
}

func TestGetLastBackupTime(t *testing.T) {
	store := newTestStore(t)
	defer store.Close()

	backupDir, err := store.EnsureBackupDir()
	if err != nil {
		t.Fatalf("EnsureBackupDir failed: %v", err)
	}

	files, _ := filepath.Glob(filepath.Join(backupDir, "cashmop_backup_*.db"))
	for _, f := range files {
		_ = os.Remove(f)
	}

	t.Run("no backups exist", func(t *testing.T) {
		lastTime, err := store.GetLastBackupTime()
		if err != nil {
			t.Fatalf("GetLastBackupTime failed: %v", err)
		}
		if !lastTime.IsZero() {
			t.Errorf("Expected zero time when no backups exist, got %v", lastTime)
		}
	})

	t.Run("backups exist", func(t *testing.T) {
		backupPath := filepath.Join(backupDir, "cashmop_backup_20240101_120000.db")
		if err := store.CreateBackup(backupPath); err != nil {
			t.Fatalf("Failed to create test backup: %v", err)
		}

		knownTime := time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC)
		if err := os.Chtimes(backupPath, knownTime, knownTime); err != nil {
			t.Fatalf("Failed to set backup file time: %v", err)
		}

		lastTime, err := store.GetLastBackupTime()
		if err != nil {
			t.Fatalf("GetLastBackupTime failed: %v", err)
		}
		if lastTime.IsZero() {
			t.Error("Expected non-zero time when backups exist")
		}
	})
}

func TestShouldAutoBackup(t *testing.T) {
	store := newTestStore(t)
	defer store.Close()

	backupDir, err := store.EnsureBackupDir()
	if err != nil {
		t.Fatalf("EnsureBackupDir failed: %v", err)
	}

	files, _ := filepath.Glob(filepath.Join(backupDir, "cashmop_backup_*.db"))
	for _, f := range files {
		_ = os.Remove(f)
	}

	t.Run("no backups - should backup", func(t *testing.T) {
		should, err := store.ShouldAutoBackup()
		if err != nil {
			t.Fatalf("ShouldAutoBackup failed: %v", err)
		}
		if !should {
			t.Error("Expected shouldBackup=true when no backups exist")
		}
	})

	t.Run("recent backup - should not backup", func(t *testing.T) {
		backupPath := filepath.Join(backupDir, "cashmop_backup_recent.db")
		if err := store.CreateBackup(backupPath); err != nil {
			t.Fatalf("Failed to create recent backup: %v", err)
		}

		should, err := store.ShouldAutoBackup()
		if err != nil {
			t.Fatalf("ShouldAutoBackup failed: %v", err)
		}
		if should {
			t.Error("Expected shouldBackup=false when recent backup exists")
		}

		_ = os.Remove(backupPath)
	})

	t.Run("old backup - should backup", func(t *testing.T) {
		backupPath := filepath.Join(backupDir, "cashmop_backup_old.db")
		if err := store.CreateBackup(backupPath); err != nil {
			t.Fatalf("Failed to create old backup: %v", err)
		}

		oldTime := time.Now().Add(-25 * time.Hour)
		if err := os.Chtimes(backupPath, oldTime, oldTime); err != nil {
			t.Fatalf("Failed to set old backup time: %v", err)
		}

		should, err := store.ShouldAutoBackup()
		if err != nil {
			t.Fatalf("ShouldAutoBackup failed: %v", err)
		}
		if !should {
			t.Error("Expected shouldBackup=true when backup is 25+ hours old")
		}

		_ = os.Remove(backupPath)
	})
}

func TestCleanupOldBackups(t *testing.T) {
	store := newTestStore(t)
	defer store.Close()

	backupDir, err := store.EnsureBackupDir()
	if err != nil {
		t.Fatalf("EnsureBackupDir failed: %v", err)
	}

	files, _ := filepath.Glob(filepath.Join(backupDir, "cashmop_backup_*.db"))
	for _, f := range files {
		_ = os.Remove(f)
	}

	now := time.Now()
	for i := 0; i < 15; i++ {
		filename := fmt.Sprintf("cashmop_backup_%04d0101_%02d0000.db", 2024, i)
		backupPath := filepath.Join(backupDir, filename)

		err = store.CreateBackup(backupPath)
		if err != nil {
			t.Fatalf("Failed to create backup %d: %v", i, err)
		}

		backupTime := now.Add(-time.Duration(i) * 24 * time.Hour)
		err = os.Chtimes(backupPath, backupTime, backupTime)
		if err != nil {
			t.Fatalf("Failed to set backup time %d: %v", i, err)
		}
	}

	if err := store.CleanupOldBackups(); err != nil {
		t.Fatalf("CleanupOldBackups failed: %v", err)
	}

	entries, err := os.ReadDir(backupDir)
	if err != nil {
		t.Fatalf("Failed to read backup dir: %v", err)
	}

	backupCount := 0
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		if strings.HasPrefix(entry.Name(), "cashmop_backup_") && strings.HasSuffix(entry.Name(), ".db") {
			backupCount++
		}
	}

	if backupCount > 11 {
		t.Errorf("Expected at most 11 backups after cleanup (10 daily + 1 extra weekly), got %d", backupCount)
	}
}

func TestCreateAutoBackup(t *testing.T) {
	store := newTestStore(t)
	defer store.Close()

	backupDir, err := store.EnsureBackupDir()
	if err != nil {
		t.Fatalf("EnsureBackupDir failed: %v", err)
	}

	files, _ := filepath.Glob(filepath.Join(backupDir, "cashmop_backup_*.db"))
	for _, f := range files {
		_ = os.Remove(f)
	}

	backupPath, err := store.CreateAutoBackup()
	if err != nil {
		t.Fatalf("CreateAutoBackup failed: %v", err)
	}

	if _, err := os.Stat(backupPath); err != nil {
		t.Fatalf("Backup file not created: %v", err)
	}

	if !strings.HasPrefix(filepath.Base(backupPath), "cashmop_backup_") {
		t.Errorf("Backup file has wrong name pattern: %s", filepath.Base(backupPath))
	}

	if txCount, err := store.ValidateBackup(backupPath); err != nil {
		t.Fatalf("Auto backup validation failed: %v", err)
	} else if txCount < 0 {
		t.Errorf("Invalid transaction count in auto backup: %d", txCount)
	}
}

func TestResolveDatabasePath(t *testing.T) {
	os.Setenv("APP_ENV", "test")
	path, err := ResolveDatabasePath()
	if err != nil {
		t.Fatalf("ResolveDatabasePath failed: %v", err)
	}
	if path == "" {
		t.Error("ResolveDatabasePath returned empty string")
	}
	if !strings.HasSuffix(path, ".db") {
		t.Errorf("ResolveDatabasePath should return .db file, got: %s", path)
	}
}

func TestEnsureBackupDir(t *testing.T) {
	store := newTestStore(t)
	defer store.Close()

	backupDir, err := store.EnsureBackupDir()
	if err != nil {
		t.Fatalf("EnsureBackupDir failed: %v", err)
	}
	if backupDir == "" {
		t.Fatal("EnsureBackupDir returned empty string")
	}

	info, err := os.Stat(backupDir)
	if err != nil {
		t.Fatalf("Backup directory does not exist: %v", err)
	}
	if !info.IsDir() {
		t.Error("EnsureBackupDir returned non-directory path")
	}
	if filepath.Base(backupDir) != "backups" {
		t.Errorf("Expected directory named 'backups', got: %s", filepath.Base(backupDir))
	}
}

func TestBackupMetadata(t *testing.T) {
	store := newTestStore(t)
	defer store.Close()

	tempDir := t.TempDir()
	backupPath := filepath.Join(tempDir, "metadata_test.db")

	if err := store.CreateBackup(backupPath); err != nil {
		t.Fatalf("Failed to create backup: %v", err)
	}

	txCount, err := store.ValidateBackup(backupPath)
	if err != nil {
		t.Fatalf("ValidateBackup failed: %v", err)
	}

	info, err := os.Stat(backupPath)
	if err != nil {
		t.Fatalf("Failed to stat backup file: %v", err)
	}

	if info.Size() <= 0 {
		t.Errorf("Expected positive size, got %d", info.Size())
	}
	if txCount < 0 {
		t.Errorf("Expected non-negative transaction count, got %d", txCount)
	}
	if info.ModTime().IsZero() {
		t.Error("Expected non-zero mod time")
	}
}
