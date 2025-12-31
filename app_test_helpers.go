package main

import (
	"cashflow/internal/database"
	"database/sql"
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"
	"testing"

	_ "modernc.org/sqlite"
)

// setupTestDB initializes an in-memory SQLite database for testing
//
// NOTE: While this sets APP_ENV=test to prevent pre-migration backups,
// some functions like RestoreBackup create safety backups to the real filesystem
// as a side-effect. This is expected behavior for those production functions.
func setupTestDB(t *testing.T) *sql.DB {
	t.Helper()

	// Set test environment to prevent backup file creation
	t.Setenv("APP_ENV", "test")

	// Clean up any pre-restore backup files from previous test runs
	backupDir, err := database.EnsureBackupDir()
	if err == nil {
		files, _ := os.ReadDir(backupDir)
		for _, f := range files {
			if strings.HasPrefix(f.Name(), "cashflow_pre_restore_") {
				_ = os.Remove(filepath.Join(backupDir, f.Name()))
			}
		}
	}

	// Use in-memory database for fast, isolated tests
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("Failed to open test database: %v", err)
	}

	// Set the database package's DB variable
	database.DB = db

	// Run migrations to set up schema
	if err := database.Migrate(); err != nil {
		t.Fatalf("Failed to run migrations: %v", err)
	}

	// Register cleanup to close database even if test panics
	t.Cleanup(func() {
		if db != nil {
			db.Close()
		}
	})

	return db
}

// setupTestDBWithFile initializes a file-based SQLite database for testing
// Required for tests that use CreateBackup or RestoreBackup, which need a file-based DB
func setupTestDBWithFile(t *testing.T) *sql.DB {
	t.Helper()

	t.Setenv("APP_ENV", "test")

	// Clean up pre-restore backup files from previous test runs
	backupDir, err := database.EnsureBackupDir()
	if err == nil {
		files, _ := os.ReadDir(backupDir)
		for _, f := range files {
			if strings.HasPrefix(f.Name(), "cashflow_pre_restore_") {
				_ = os.Remove(filepath.Join(backupDir, f.Name()))
			}
		}
	}

	// Initialize the database package which uses a file-based database in test mode
	database.InitDB()
	db := database.DB

	// Clean up test database file and backup directory after test
	t.Cleanup(func() {
		database.Close()
		dbPath, _ := database.DatabasePath()
		if dbPath != "" {
			os.Remove(dbPath)
		}
		backupDir, _ := database.EnsureBackupDir()
		if backupDir != "" {
			os.RemoveAll(backupDir)
		}
	})

	return db
}

// teardownTestDB closes the test database
func teardownTestDB(t *testing.T, db *sql.DB) {
	t.Helper()
	if db != nil {
		db.Close()
	}
}

// createTestCategory creates a test category and returns its ID
func createTestCategory(t *testing.T, name string) int64 {
	t.Helper()
	id, err := database.GetOrCreateCategory(name)
	if err != nil {
		t.Fatalf("Failed to create test category '%s': %v", name, err)
	}
	return id
}

// createTestAccount creates a test account and returns its ID
func createTestAccount(t *testing.T, name string) int64 {
	t.Helper()
	id, err := database.GetOrCreateAccount(name)
	if err != nil {
		t.Fatalf("Failed to create test account '%s': %v", name, err)
	}
	return id
}

// createTestOwner creates a test owner/user and returns its ID
func createTestOwner(t *testing.T, name string) *int64 {
	t.Helper()
	id, err := database.GetOrCreateUser(name)
	if err != nil {
		t.Fatalf("Failed to create test owner '%s': %v", name, err)
	}
	return id
}

// createTestTransaction creates a test transaction with the given parameters
func createTestTransaction(t *testing.T, accountID int64, ownerID *int64, date, description string, amount float64, categoryID *int64) database.TransactionModel {
	t.Helper()

	tx := database.TransactionModel{
		AccountID:   accountID,
		OwnerID:     ownerID,
		Date:        date,
		Description: description,
		Amount:      amount,
		CategoryID:  categoryID,
		Currency:    "CAD",
	}

	err := database.BatchInsertTransactions([]database.TransactionModel{tx})
	if err != nil {
		t.Fatalf("Failed to create test transaction: %v", err)
	}

	// Query to get the inserted transaction ID
	var insertedID int64
	err = database.DB.QueryRow("SELECT id FROM transactions WHERE description = ? AND date = ?", description, date).Scan(&insertedID)
	if err != nil {
		t.Fatalf("Failed to get inserted transaction ID: %v", err)
	}

	tx.ID = insertedID
	return tx
}

// createTestRule creates a test categorization rule
func createTestRule(t *testing.T, rule database.CategorizationRule) int64 {
	t.Helper()
	id, err := database.SaveRule(rule)
	if err != nil {
		t.Fatalf("Failed to create test rule: %v", err)
	}
	return id
}

// encodeExcelToBase64 reads an Excel file and returns base64 encoded data
func encodeExcelToBase64(t *testing.T, excelData string) string {
	t.Helper()
	return base64.StdEncoding.EncodeToString([]byte(excelData))
}

// readExcelFile reads an Excel file from testdata and returns base64 encoded data
func readExcelFile(t *testing.T, filename string) string {
	t.Helper()
	data, err := os.ReadFile(filepath.Join("testdata", filename))
	if err != nil {
		t.Fatalf("Failed to read Excel file '%s': %v", filename, err)
	}
	return base64.StdEncoding.EncodeToString(data)
}

// countTransactions returns the number of transactions in the database
func countTransactions(t *testing.T) int64 {
	t.Helper()
	var count int64
	err := database.DB.QueryRow("SELECT COUNT(*) FROM transactions").Scan(&count)
	if err != nil {
		t.Fatalf("Failed to count transactions: %v", err)
	}
	return count
}

// countCategories returns the number of categories in the database
func countCategories(t *testing.T) int64 {
	t.Helper()
	var count int64
	err := database.DB.QueryRow("SELECT COUNT(*) FROM categories").Scan(&count)
	if err != nil {
		t.Fatalf("Failed to count categories: %v", err)
	}
	return count
}

// countAccounts returns the number of accounts in the database
func countAccounts(t *testing.T) int64 {
	t.Helper()
	var count int64
	err := database.DB.QueryRow("SELECT COUNT(*) FROM accounts").Scan(&count)
	if err != nil {
		t.Fatalf("Failed to count accounts: %v", err)
	}
	return count
}

// countUsers returns the number of users in the database
func countUsers(t *testing.T) int64 {
	t.Helper()
	var count int64
	err := database.DB.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if err != nil {
		t.Fatalf("Failed to count users: %v", err)
	}
	return count
}
