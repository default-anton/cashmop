package cli

import (
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"testing"

	"github.com/default-anton/cashmop/internal/cashmop"
	"github.com/default-anton/cashmop/internal/database"
	"github.com/default-anton/cashmop/internal/mapping"
)

func TestNormalizeTransactionsBatching(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "cashmop-test-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmpDir)
	dbPath := filepath.Join(tmpDir, "test.db")

	store, err := database.Open(dbPath, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()

	svc := cashmop.New(store)

	accID, err := store.GetOrCreateAccount("TestAccount")
	if err != nil {
		t.Fatal(err)
	}
	pUserID, err := store.GetOrCreateUser("TestUser")
	if err != nil {
		t.Fatal(err)
	}
	if pUserID == nil {
		t.Fatal("expected user ID, got nil")
	}
	userID := *pUserID

	m := mapping.ImportMapping{}
	m.CSV.Date = "Date"
	m.CSV.Description = []string{"Desc"}
	m.CSV.AmountMapping.Type = "single"
	m.CSV.AmountMapping.Column = "Amount"
	m.Account = "TestAccount"
	m.DefaultOwner = "TestUser"
	m.CurrencyDefault = "CAD"

	parsed := &parsedFile{
		headers: []string{"Date", "Desc", "Amount"},
		rows: [][]string{
			{"2025-01-01", "Tx 1", "100.00"},
			{"2025-01-02", "Tx 2", "200.00"},
		},
	}

	txs, err := normalizeTransactions(svc, parsed, m, []string{"2025-01"})
	if err != nil {
		t.Fatalf("normalizeTransactions failed: %v", err)
	}

	if len(txs) != 2 {
		t.Fatalf("expected 2 transactions, got %d", len(txs))
	}

	for i, tx := range txs {
		if tx.AccountID != accID {
			t.Errorf("tx[%d]: expected AccountID %d, got %d", i, accID, tx.AccountID)
		}
		if tx.OwnerID == nil {
			t.Errorf("tx[%d]: expected non-nil OwnerID", i)
		} else if *tx.OwnerID != userID {
			t.Errorf("tx[%d]: expected OwnerID %d, got %d", i, userID, *tx.OwnerID)
		}
	}

	parsed2 := &parsedFile{
		headers: []string{"Date", "Desc", "Amount", "Account", "Owner"},
		rows: [][]string{
			{"2025-01-03", "Tx 3", "300.00", "NewAccount", "NewUser"},
			{"2025-01-04", "Tx 4", "400.00", "NewAccount", "NewUser"},
		},
	}
	m2 := m
	m2.CSV.Account = "Account"
	m2.CSV.Owner = "Owner"

	txs2, err := normalizeTransactions(svc, parsed2, m2, []string{"2025-01"})
	if err != nil {
		t.Fatalf("normalizeTransactions failed: %v", err)
	}

	if len(txs2) != 2 {
		t.Fatalf("expected 2 transactions, got %d", len(txs2))
	}

	newAccID := txs2[0].AccountID
	if txs2[0].OwnerID == nil {
		t.Fatal("expected non-nil OwnerID for NewUser")
	}
	newUserID := *txs2[0].OwnerID

	if newAccID == accID {
		t.Errorf("expected new AccountID, got same as old")
	}
	if newUserID == userID {
		t.Errorf("expected new OwnerID, got same as old")
	}

	if txs2[1].AccountID != newAccID {
		t.Errorf("tx[1]: expected AccountID %d, got %d", newAccID, txs2[1].AccountID)
	}
	if txs2[1].OwnerID == nil {
		t.Errorf("tx[1]: expected non-nil OwnerID")
	} else if *txs2[1].OwnerID != newUserID {
		t.Errorf("tx[1]: expected OwnerID %d, got %d", newUserID, *txs2[1].OwnerID)
	}
}
