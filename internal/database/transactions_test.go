package database

import "testing"

func TestDeleteTransactions(t *testing.T) {
	store := newTestStore(t)
	defer store.Close()

	accID, err := store.GetOrCreateAccount("TestAccount")
	if err != nil {
		t.Fatalf("Failed to create test account: %v", err)
	}

	catID, err := store.GetOrCreateCategory("TestCategory")
	if err != nil {
		t.Fatalf("Failed to create test category: %v", err)
	}

	txs := []TransactionModel{
		{AccountID: accID, Date: "2024-01-01", Description: "Test 1", Amount: 100, CategoryID: &catID, Currency: defaultMainCurrency},
		{AccountID: accID, Date: "2024-01-02", Description: "Test 2", Amount: 200, CategoryID: &catID, Currency: defaultMainCurrency},
		{AccountID: accID, Date: "2024-01-03", Description: "Test 3", Amount: 300, CategoryID: &catID, Currency: defaultMainCurrency},
	}

	if err := store.BatchInsertTransactions(txs); err != nil {
		t.Fatalf("Failed to insert test transactions: %v", err)
	}

	fetched, err := store.GetAnalysisTransactions("2024-01-01", "2024-01-31", nil, nil)
	if err != nil {
		t.Fatalf("Failed to fetch transactions: %v", err)
	}
	if len(fetched) != 3 {
		t.Fatalf("Expected 3 transactions, got %d", len(fetched))
	}

	var ids []int64
	for _, tx := range fetched {
		ids = append(ids, tx.ID)
	}

	count, err := store.DeleteTransactions([]int64{ids[0]})
	if err != nil {
		t.Fatalf("DeleteTransactions failed: %v", err)
	}
	if count != 1 {
		t.Fatalf("Expected 1 row affected, got %d", count)
	}

	fetched, err = store.GetAnalysisTransactions("2024-01-01", "2024-01-31", nil, nil)
	if err != nil {
		t.Fatalf("Failed to fetch transactions after delete: %v", err)
	}
	if len(fetched) != 2 {
		t.Fatalf("Expected 2 transactions after delete, got %d", len(fetched))
	}

	count, err = store.DeleteTransactions([]int64{ids[1], ids[2]})
	if err != nil {
		t.Fatalf("DeleteTransactions multiple failed: %v", err)
	}
	if count != 2 {
		t.Fatalf("Expected 2 rows affected, got %d", count)
	}

	fetched, err = store.GetAnalysisTransactions("2024-01-01", "2024-01-31", nil, nil)
	if err != nil {
		t.Fatalf("Failed to fetch transactions after multi delete: %v", err)
	}
	if len(fetched) != 0 {
		t.Fatalf("Expected 0 transactions after multi delete, got %d", len(fetched))
	}
}

func TestDeleteTransactionsEmptySlice(t *testing.T) {
	store := newTestStore(t)
	defer store.Close()

	count, err := store.DeleteTransactions([]int64{})
	if err != nil {
		t.Fatalf("DeleteTransactions with empty slice failed: %v", err)
	}
	if count != 0 {
		t.Fatalf("Expected 0 rows affected for empty slice, got %d", count)
	}
}

func TestDeleteTransactionsNonExistent(t *testing.T) {
	store := newTestStore(t)
	defer store.Close()

	count, err := store.DeleteTransactions([]int64{99999, 100000})
	if err != nil {
		t.Fatalf("DeleteTransactions with non-existent IDs failed: %v", err)
	}
	if count != 0 {
		t.Fatalf("Expected 0 rows affected for non-existent IDs, got %d", count)
	}
}
