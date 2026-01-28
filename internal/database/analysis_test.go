package database

import "testing"

func TestGetAnalysisFacets(t *testing.T) {
	store := newTestStore(t)
	defer store.Close()

	accID, err := store.GetOrCreateAccount("TestAccount")
	if err != nil {
		t.Fatalf("Failed to create test account: %v", err)
	}

	ownerMe, err := store.GetOrCreateUser("Me")
	if err != nil {
		t.Fatalf("Failed to create test owner: %v", err)
	}

	catFood, err := store.GetOrCreateCategory("Food")
	if err != nil {
		t.Fatalf("Failed to create test category: %v", err)
	}

	catRent, err := store.GetOrCreateCategory("Rent")
	if err != nil {
		t.Fatalf("Failed to create test category: %v", err)
	}

	// Mix of categorized/uncategorized and with/without owner.
	txs := []TransactionModel{
		{AccountID: accID, OwnerID: ownerMe, Date: "2024-01-01", Description: "Food", Amount: -100, CategoryID: &catFood, Currency: defaultMainCurrency},
		{AccountID: accID, OwnerID: ownerMe, Date: "2024-01-02", Description: "Rent", Amount: -200, CategoryID: &catRent, Currency: defaultMainCurrency},
		{AccountID: accID, Date: "2024-01-03", Description: "Mystery", Amount: -300, CategoryID: nil, Currency: defaultMainCurrency},
	}
	if err := store.BatchInsertTransactions(txs); err != nil {
		t.Fatalf("Failed to insert test transactions: %v", err)
	}

	facets, err := store.GetAnalysisFacets("2024-01-01", "2024-01-31")
	if err != nil {
		t.Fatalf("GetAnalysisFacets failed: %v", err)
	}

	if !facets.HasUncategorized {
		t.Fatalf("Expected HasUncategorized=true")
	}
	if !facets.HasNoOwner {
		t.Fatalf("Expected HasNoOwner=true")
	}

	if len(facets.Categories) != 2 {
		t.Fatalf("Expected 2 categories, got %d", len(facets.Categories))
	}
	if len(facets.Owners) != 1 {
		t.Fatalf("Expected 1 owner, got %d", len(facets.Owners))
	}

	ids := map[int64]bool{}
	for _, c := range facets.Categories {
		ids[c.ID] = true
	}
	if !ids[catFood] || !ids[catRent] {
		t.Fatalf("Expected facets to include category IDs %d and %d", catFood, catRent)
	}
	if facets.Owners[0].ID != *ownerMe {
		t.Fatalf("Expected facets to include owner ID %d, got %d", *ownerMe, facets.Owners[0].ID)
	}
}
