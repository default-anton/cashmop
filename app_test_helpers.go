package main

import (
	"github.com/default-anton/cashmop/internal/database"
	"database/sql"
	"encoding/base64"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"

	_ "modernc.org/sqlite"
)

// NOTE: While this sets APP_ENV=test to prevent pre-migration backups,
// some functions like RestoreBackup create safety backups to the real filesystem
// as a side-effect. This is expected behavior for those production functions.
func setupTestDB(t *testing.T) *sql.DB {
	t.Helper()

	database.Close()

	t.Setenv("APP_ENV", "test")

	backupDir, err := database.EnsureBackupDir()
	if err == nil {
		files, _ := os.ReadDir(backupDir)
		for _, f := range files {
			if strings.HasPrefix(f.Name(), "cashmop_pre_restore_") {
				_ = os.Remove(filepath.Join(backupDir, f.Name()))
			}
		}
	}

	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("Failed to open test database: %v", err)
	}
	db.SetMaxOpenConns(4)

	database.DB = db
	database.SetLogger(slog.New(slog.NewTextHandler(io.Discard, nil)))

	if err := database.Migrate(); err != nil {
		t.Fatalf("Failed to run migrations: %v", err)
	}

	t.Cleanup(func() {
		if db != nil {
			db.Close()
		}
	})

	return db
}

func setupTestDBWithFile(t *testing.T) *sql.DB {
	t.Helper()

	database.Close()

	t.Setenv("APP_ENV", "test")

	backupDir, err := database.EnsureBackupDir()
	if err == nil {
		files, _ := os.ReadDir(backupDir)
		for _, f := range files {
			if strings.HasPrefix(f.Name(), "cashmop_pre_restore_") {
				_ = os.Remove(filepath.Join(backupDir, f.Name()))
			}
		}
	}

	database.InitDB(slog.New(slog.NewTextHandler(io.Discard, nil)))
	db := database.DB

	t.Cleanup(func() {
		database.Close()
		dbPath, _ := database.DatabasePath()
		if dbPath != "" {
			if err := os.Remove(dbPath); err != nil && !os.IsNotExist(err) {
				t.Errorf("Error: failed to remove test database %s: %v", dbPath, err)
			}
		}
		backupDir, _ := database.EnsureBackupDir()
		if backupDir != "" {
			os.RemoveAll(backupDir)
		}
	})

	return db
}

func teardownTestDB(t *testing.T, db *sql.DB) {
	t.Helper()
	if db != nil {
		db.Close()
	}
}

func createTestCategory(t *testing.T, name string) int64 {
	t.Helper()
	id, err := database.GetOrCreateCategory(name)
	if err != nil {
		t.Fatalf("Failed to create test category '%s': %v", name, err)
	}
	return id
}

func createTestAccount(t *testing.T, name string) int64 {
	t.Helper()
	id, err := database.GetOrCreateAccount(name)
	if err != nil {
		t.Fatalf("Failed to create test account '%s': %v", name, err)
	}
	return id
}

func createTestOwner(t *testing.T, name string) *int64 {
	t.Helper()
	id, err := database.GetOrCreateUser(name)
	if err != nil {
		t.Fatalf("Failed to create test owner '%s': %v", name, err)
	}
	return id
}

func createTestTransaction(t *testing.T, accountID int64, ownerID *int64, date, description string, amount int64, categoryID *int64) database.TransactionModel {
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

	var insertedID int64
	err = database.DB.QueryRow("SELECT id FROM transactions WHERE description = ? AND date = ?", description, date).Scan(&insertedID)
	if err != nil {
		t.Fatalf("Failed to get inserted transaction ID: %v", err)
	}

	tx.ID = insertedID
	return tx
}

func createTestRule(t *testing.T, rule database.CategorizationRule) int64 {
	t.Helper()
	id, err := database.SaveRule(rule)
	if err != nil {
		t.Fatalf("Failed to create test rule: %v", err)
	}
	return id
}

func encodeExcelToBase64(t *testing.T, excelData string) string {
	t.Helper()
	return base64.StdEncoding.EncodeToString([]byte(excelData))
}

func readExcelFile(t *testing.T, filename string) string {
	t.Helper()
	data, err := os.ReadFile(filepath.Join("testdata", filename))
	if err != nil {
		t.Fatalf("Failed to read Excel file '%s': %v", filename, err)
	}
	return base64.StdEncoding.EncodeToString(data)
}

func countTransactions(t *testing.T) int64 {
	t.Helper()
	var count int64
	err := database.DB.QueryRow("SELECT COUNT(*) FROM transactions").Scan(&count)
	if err != nil {
		t.Fatalf("Failed to count transactions: %v", err)
	}
	return count
}

func countCategories(t *testing.T) int64 {
	t.Helper()
	var count int64
	err := database.DB.QueryRow("SELECT COUNT(*) FROM categories").Scan(&count)
	if err != nil {
		t.Fatalf("Failed to count categories: %v", err)
	}
	return count
}

func countAccounts(t *testing.T) int64 {
	t.Helper()
	var count int64
	err := database.DB.QueryRow("SELECT COUNT(*) FROM accounts").Scan(&count)
	if err != nil {
		t.Fatalf("Failed to count accounts: %v", err)
	}
	return count
}

func countUsers(t *testing.T) int64 {
	t.Helper()
	var count int64
	err := database.DB.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if err != nil {
		t.Fatalf("Failed to count users: %v", err)
	}
	return count
}
