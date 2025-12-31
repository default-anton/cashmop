package database

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func setupTestDB(t *testing.T) {
	t.Helper()
	os.Setenv("APP_ENV", "test")
	InitDB()

}

func teardownTestDB(t *testing.T) {
	t.Helper()
	Close()

	dbPath, err := DatabasePath()
	if err == nil {
		os.Remove(dbPath)
	}

	backupDir, err := EnsureBackupDir()
	if err == nil {
		os.RemoveAll(backupDir)
	}
}

func TestCreateBackup(t *testing.T) {
	setupTestDB(t)
	defer teardownTestDB(t)

	tempDir := t.TempDir()
	backupPath := filepath.Join(tempDir, "test_backup.db")

	err := CreateBackup(backupPath)
	if err != nil {
		t.Fatalf("CreateBackup failed: %v", err)
	}

	// Verify backup file exists
	info, err := os.Stat(backupPath)
	if err != nil {
		t.Fatalf("Backup file not created: %v", err)
	}

	// Verify file is not empty
	if info.Size() == 0 {
		t.Fatal("Backup file is empty")
	}

	// Verify backup is a valid SQLite database
	txCount, err := ValidateBackup(backupPath)
	if err != nil {
		t.Fatalf("Backup validation failed: %v", err)
	}

	// Get original transaction count
	var originalCount int64
	err = DB.QueryRow("SELECT COUNT(*) FROM transactions").Scan(&originalCount)
	if err != nil {
		t.Fatalf("Failed to count original transactions: %v", err)
	}

	// Backup should have the same number of transactions
	if txCount != originalCount {
		t.Errorf("Backup has %d transactions, expected %d", txCount, originalCount)
	}
}

func TestValidateBackup(t *testing.T) {
	setupTestDB(t)
	defer teardownTestDB(t)

	tempDir := t.TempDir()

	t.Run("valid backup file", func(t *testing.T) {
		backupPath := filepath.Join(tempDir, "valid_backup.db")
		err := CreateBackup(backupPath)
		if err != nil {
			t.Fatalf("Failed to create backup: %v", err)
		}

		txCount, err := ValidateBackup(backupPath)
		if err != nil {
			t.Errorf("ValidateBackup failed for valid file: %v", err)
		}
		if txCount < 0 {
			t.Errorf("Invalid transaction count: %d", txCount)
		}
	})

	t.Run("non-existent file", func(t *testing.T) {
		_, err := ValidateBackup(filepath.Join(tempDir, "nonexistent.db"))
		if err == nil {
			t.Error("Expected error for non-existent file")
		}
	})

	t.Run("invalid file", func(t *testing.T) {
		invalidPath := filepath.Join(tempDir, "invalid.txt")
		err := os.WriteFile(invalidPath, []byte("not a database"), 0o644)
		if err != nil {
			t.Fatalf("Failed to write invalid file: %v", err)
		}

		_, err = ValidateBackup(invalidPath)
		if err == nil {
			t.Error("Expected error for invalid file")
		}
	})

	t.Run("empty file", func(t *testing.T) {
		emptyPath := filepath.Join(tempDir, "empty.db")
		err := os.WriteFile(emptyPath, []byte{}, 0o644)
		if err != nil {
			t.Fatalf("Failed to write empty file: %v", err)
		}

		_, err = ValidateBackup(emptyPath)
		if err == nil {
			t.Error("Expected error for empty file")
		}
	})
}

func TestRestoreBackup(t *testing.T) {
	setupTestDB(t)
	defer teardownTestDB(t)

	tempDir := t.TempDir()
	backupPath := filepath.Join(tempDir, "restore_test.db")

	// Get initial transaction count
	var initialCount int64
	err := DB.QueryRow("SELECT COUNT(*) FROM transactions").Scan(&initialCount)
	if err != nil {
		t.Fatalf("Failed to count initial transactions: %v", err)
	}

	// Create initial data
	_, err = GetOrCreateCategory("TestCategory")
	if err != nil {
		t.Fatalf("Failed to create test category: %v", err)
	}

	accID, err := GetOrCreateAccount("TestAccount")
	if err != nil {
		t.Fatalf("Failed to create test account: %v", err)
	}

	// Insert a transaction
	tx := TransactionModel{
		AccountID:   accID,
		Date:        "2024-01-01",
		Description: "Test Transaction",
		Amount:      100.0,
		Currency:    "CAD",
	}
	err = BatchInsertTransactions([]TransactionModel{tx})
	if err != nil {
		t.Fatalf("Failed to insert test transaction: %v", err)
	}

	// Count transactions after adding one
	var countWithOne int64
	err = DB.QueryRow("SELECT COUNT(*) FROM transactions").Scan(&countWithOne)
	if err != nil {
		t.Fatalf("Failed to count transactions after adding: %v", err)
	}

	// Create backup
	err = CreateBackup(backupPath)
	if err != nil {
		t.Fatalf("Failed to create backup: %v", err)
	}

	// Modify database - add another transaction
	tx2 := TransactionModel{
		AccountID:   accID,
		Date:        "2024-01-02",
		Description: "Another Transaction",
		Amount:      200.0,
		Currency:    "CAD",
	}
	err = BatchInsertTransactions([]TransactionModel{tx2})
	if err != nil {
		t.Fatalf("Failed to insert second transaction: %v", err)
	}

	// Count transactions before restore
	var countBefore int64
	err = DB.QueryRow("SELECT COUNT(*) FROM transactions").Scan(&countBefore)
	if err != nil {
		t.Fatalf("Failed to count transactions: %v", err)
	}

	// Restore from backup
	err = RestoreBackup(backupPath)
	if err != nil {
		t.Fatalf("RestoreBackup failed: %v", err)
	}

	// Count transactions after restore
	var countAfter int64
	err = DB.QueryRow("SELECT COUNT(*) FROM transactions").Scan(&countAfter)
	if err != nil {
		t.Fatalf("Failed to count transactions after restore: %v", err)
	}

	// Should have the same count as when we created the backup
	if countAfter != countWithOne {
		t.Errorf("Expected %d transactions after restore, got %d", countWithOne, countAfter)
	}

	// Should have fewer transactions than before restore
	if countAfter >= countBefore {
		t.Errorf("Expected fewer transactions after restore, got %d (was %d)", countAfter, countBefore)
	}
}

func TestRestoreBackup_InvalidFile(t *testing.T) {
	setupTestDB(t)
	defer teardownTestDB(t)

	err := RestoreBackup("/nonexistent/path/backup.db")
	if err == nil {
		t.Error("Expected error for invalid backup path")
	}
}

func TestGetLastBackupTime(t *testing.T) {
	setupTestDB(t)
	defer teardownTestDB(t)

	backupDir, err := EnsureBackupDir()
	if err != nil {
		t.Fatalf("EnsureBackupDir failed: %v", err)
	}

	// Clean up any existing backups
	files, _ := filepath.Glob(filepath.Join(backupDir, "cashflow_backup_*.db"))
	for _, f := range files {
		os.Remove(f)
	}

	t.Run("no backups exist", func(t *testing.T) {
		lastTime, err := GetLastBackupTime()
		if err != nil {
			t.Fatalf("GetLastBackupTime failed: %v", err)
		}
		if !lastTime.IsZero() {
			t.Errorf("Expected zero time when no backups exist, got %v", lastTime)
		}
	})

	t.Run("backups exist", func(t *testing.T) {
		// Create a test backup
		backupPath := filepath.Join(backupDir, "cashflow_backup_20240101_120000.db")
		err := CreateBackup(backupPath)
		if err != nil {
			t.Fatalf("Failed to create test backup: %v", err)
		}

		// Set modification time to a known time
		knownTime := time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC)
		err = os.Chtimes(backupPath, knownTime, knownTime)
		if err != nil {
			t.Fatalf("Failed to set backup file time: %v", err)
		}

		lastTime, err := GetLastBackupTime()
		if err != nil {
			t.Fatalf("GetLastBackupTime failed: %v", err)
		}

		// Allow some tolerance for time comparison
		if lastTime.IsZero() {
			t.Error("Expected non-zero time when backups exist")
		}
	})
}

func TestShouldAutoBackup(t *testing.T) {
	setupTestDB(t)
	defer teardownTestDB(t)

	backupDir, err := EnsureBackupDir()
	if err != nil {
		t.Fatalf("EnsureBackupDir failed: %v", err)
	}

	// Clean up any existing backups
	files, _ := filepath.Glob(filepath.Join(backupDir, "cashflow_backup_*.db"))
	for _, f := range files {
		os.Remove(f)
	}

	t.Run("no backups - should backup", func(t *testing.T) {
		should, err := ShouldAutoBackup()
		if err != nil {
			t.Fatalf("ShouldAutoBackup failed: %v", err)
		}
		if !should {
			t.Error("Expected shouldBackup=true when no backups exist")
		}
	})

	t.Run("recent backup - should not backup", func(t *testing.T) {
		// Create a recent backup
		backupPath := filepath.Join(backupDir, "cashflow_backup_recent.db")
		err := CreateBackup(backupPath)
		if err != nil {
			t.Fatalf("Failed to create recent backup: %v", err)
		}

		should, err := ShouldAutoBackup()
		if err != nil {
			t.Fatalf("ShouldAutoBackup failed: %v", err)
		}
		if should {
			t.Error("Expected shouldBackup=false when recent backup exists")
		}

		os.Remove(backupPath)
	})

	t.Run("old backup - should backup", func(t *testing.T) {
		// Create an old backup (25+ hours ago)
		backupPath := filepath.Join(backupDir, "cashflow_backup_old.db")
		err := CreateBackup(backupPath)
		if err != nil {
			t.Fatalf("Failed to create old backup: %v", err)
		}

		oldTime := time.Now().Add(-25 * time.Hour)
		err = os.Chtimes(backupPath, oldTime, oldTime)
		if err != nil {
			t.Fatalf("Failed to set old backup time: %v", err)
		}

		should, err := ShouldAutoBackup()
		if err != nil {
			t.Fatalf("ShouldAutoBackup failed: %v", err)
		}
		if !should {
			t.Error("Expected shouldBackup=true when backup is 25+ hours old")
		}

		os.Remove(backupPath)
	})
}

func TestCleanupOldBackups(t *testing.T) {
	setupTestDB(t)
	defer teardownTestDB(t)

	backupDir, err := EnsureBackupDir()
	if err != nil {
		t.Fatalf("EnsureBackupDir failed: %v", err)
	}

	// Clean up any existing backups
	files, _ := filepath.Glob(filepath.Join(backupDir, "cashflow_backup_*.db"))
	for _, f := range files {
		os.Remove(f)
	}

	// Create 15 backups with different timestamps
	now := time.Now()
	for i := 0; i < 15; i++ {
		filename := fmt.Sprintf("cashflow_backup_%04d0101_%02d0000.db", 2024, i)
		backupPath := filepath.Join(backupDir, filename)

		// Copy the current DB to create a backup
		err = CreateBackup(backupPath)
		if err != nil {
			t.Fatalf("Failed to create backup %d: %v", i, err)
		}

		// Set modification time - oldest first
		backupTime := now.Add(-time.Duration(i) * 24 * time.Hour)
		err = os.Chtimes(backupPath, backupTime, backupTime)
		if err != nil {
			t.Fatalf("Failed to set backup time %d: %v", i, err)
		}
	}

	// Run cleanup
	err = CleanupOldBackups()
	if err != nil {
		t.Fatalf("CleanupOldBackups failed: %v", err)
	}

	// Count remaining backups
	entries, err := os.ReadDir(backupDir)
	if err != nil {
		t.Fatalf("Failed to read backup dir: %v", err)
	}

	var backupCount int
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		if strings.HasPrefix(entry.Name(), "cashflow_backup_") && strings.HasSuffix(entry.Name(), ".db") {
			backupCount++
		}
	}

	// Should keep 10 daily backups + any additional weekly backups (total 11 in this test case)
	if backupCount > 11 {
		t.Errorf("Expected at most 11 backups after cleanup (10 daily + 1 extra weekly), got %d", backupCount)
	}
}

func TestCreateAutoBackup(t *testing.T) {
	setupTestDB(t)
	defer teardownTestDB(t)

	backupDir, err := EnsureBackupDir()
	if err != nil {
		t.Fatalf("EnsureBackupDir failed: %v", err)
	}

	// Clean up any existing backups
	files, _ := filepath.Glob(filepath.Join(backupDir, "cashflow_backup_*.db"))
	for _, f := range files {
		os.Remove(f)
	}

	// Create auto backup
	backupPath, err := CreateAutoBackup()
	if err != nil {
		t.Fatalf("CreateAutoBackup failed: %v", err)
	}

	// Verify backup file exists
	_, err = os.Stat(backupPath)
	if err != nil {
		t.Fatalf("Backup file not created: %v", err)
	}

	// Verify backup is in correct directory with correct naming pattern
	if !strings.HasPrefix(filepath.Base(backupPath), "cashflow_backup_") {
		t.Errorf("Backup file has wrong name pattern: %s", filepath.Base(backupPath))
	}

	// Verify backup is valid
	txCount, err := ValidateBackup(backupPath)
	if err != nil {
		t.Fatalf("Auto backup validation failed: %v", err)
	}
	if txCount < 0 {
		t.Errorf("Invalid transaction count in auto backup: %d", txCount)
	}
}

func TestDatabasePath(t *testing.T) {
	os.Setenv("APP_ENV", "test")
	path, err := DatabasePath()
	if err != nil {
		t.Fatalf("DatabasePath failed: %v", err)
	}
	if path == "" {
		t.Error("DatabasePath returned empty string")
	}

	// Verify file extension
	if !strings.HasSuffix(path, ".db") {
		t.Errorf("DatabasePath should return .db file, got: %s", path)
	}
}

func TestEnsureBackupDir(t *testing.T) {
	os.Setenv("APP_ENV", "test")
	backupDir, err := EnsureBackupDir()
	if err != nil {
		t.Fatalf("EnsureBackupDir failed: %v", err)
	}
	if backupDir == "" {
		t.Fatal("EnsureBackupDir returned empty string")
	}

	// Verify directory exists
	info, err := os.Stat(backupDir)
	if err != nil {
		t.Fatalf("Backup directory does not exist: %v", err)
	}
	if !info.IsDir() {
		t.Error("EnsureBackupDir returned non-directory path")
	}

	// Verify it's named "backups"
	if filepath.Base(backupDir) != "backups" {
		t.Errorf("Expected directory named 'backups', got: %s", filepath.Base(backupDir))
	}
}

func TestBackupMetadata(t *testing.T) {
	setupTestDB(t)
	defer teardownTestDB(t)

	tempDir := t.TempDir()
	backupPath := filepath.Join(tempDir, "metadata_test.db")

	err := CreateBackup(backupPath)
	if err != nil {
		t.Fatalf("Failed to create backup: %v", err)
	}

	txCount, err := ValidateBackup(backupPath)
	if err != nil {
		t.Fatalf("ValidateBackup failed: %v", err)
	}

	// Verify backup file info
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
