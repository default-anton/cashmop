package main

import (
	"context"
	"encoding/base64"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"testing"

	"github.com/default-anton/cashmop/internal/cashmop"
	"github.com/default-anton/cashmop/internal/database"
)

func setupTestDB(t *testing.T) *database.Store {
	t.Helper()

	t.Setenv("APP_ENV", "test")

	store, err := database.Open(":memory:", slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatalf("open test store: %v", err)
	}
	t.Cleanup(func() { _ = store.Close() })

	return store
}

func setupTestDBWithFile(t *testing.T) *database.Store {
	t.Helper()

	t.Setenv("APP_ENV", "test")

	path := filepath.Join(t.TempDir(), "cashmop_test.db")
	store, err := database.Open(path, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatalf("open test store: %v", err)
	}
	t.Cleanup(func() { _ = store.Close() })

	return store
}

func newTestApp(t *testing.T, store *database.Store) *App {
	t.Helper()
	app := NewApp()
	app.ctx = context.Background()
	app.store = store
	app.svc = cashmop.New(store)
	return app
}

func createTestCategory(t *testing.T, store *database.Store, name string) int64 {
	t.Helper()
	id, err := store.GetOrCreateCategory(name)
	if err != nil {
		t.Fatalf("Failed to create test category '%s': %v", name, err)
	}
	return id
}

func createTestAccount(t *testing.T, store *database.Store, name string) int64 {
	t.Helper()
	id, err := store.GetOrCreateAccount(name)
	if err != nil {
		t.Fatalf("Failed to create test account '%s': %v", name, err)
	}
	return id
}

func createTestOwner(t *testing.T, store *database.Store, name string) *int64 {
	t.Helper()
	id, err := store.GetOrCreateUser(name)
	if err != nil {
		t.Fatalf("Failed to create test owner '%s': %v", name, err)
	}
	return id
}

func createTestTransaction(t *testing.T, store *database.Store, accountID int64, ownerID *int64, date, description string, amount int64, categoryID *int64) database.TransactionModel {
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

	if err := store.BatchInsertTransactions([]database.TransactionModel{tx}); err != nil {
		t.Fatalf("Failed to create test transaction: %v", err)
	}

	var insertedID int64
	err := store.DB().QueryRow("SELECT id FROM transactions WHERE description = ? AND date = ?", description, date).Scan(&insertedID)
	if err != nil {
		t.Fatalf("Failed to get inserted transaction ID: %v", err)
	}

	tx.ID = insertedID
	return tx
}

func createTestRule(t *testing.T, store *database.Store, rule database.CategorizationRule) int64 {
	t.Helper()
	id, err := store.SaveRule(rule)
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

func countTransactions(t *testing.T, store *database.Store) int64 {
	t.Helper()
	var count int64
	if err := store.DB().QueryRow("SELECT COUNT(*) FROM transactions").Scan(&count); err != nil {
		t.Fatalf("Failed to count transactions: %v", err)
	}
	return count
}

func countCategories(t *testing.T, store *database.Store) int64 {
	t.Helper()
	var count int64
	if err := store.DB().QueryRow("SELECT COUNT(*) FROM categories").Scan(&count); err != nil {
		t.Fatalf("Failed to count categories: %v", err)
	}
	return count
}

func countAccounts(t *testing.T, store *database.Store) int64 {
	t.Helper()
	var count int64
	if err := store.DB().QueryRow("SELECT COUNT(*) FROM accounts").Scan(&count); err != nil {
		t.Fatalf("Failed to count accounts: %v", err)
	}
	return count
}

func countUsers(t *testing.T, store *database.Store) int64 {
	t.Helper()
	var count int64
	if err := store.DB().QueryRow("SELECT COUNT(*) FROM users").Scan(&count); err != nil {
		t.Fatalf("Failed to count users: %v", err)
	}
	return count
}
