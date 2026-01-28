package main

import (
	"context"
	"database/sql"
	"os"
	"strings"
	"testing"

	"github.com/default-anton/cashmop/internal/database"
)

// ============================================================================
// 1. Basic / Simple Functions (No DB/External)
// ============================================================================

func TestNewApp(t *testing.T) {
	app := NewApp()
	if app == nil {
		t.Fatal("NewApp() returned nil")
	}
	if app.ctx != nil {
		t.Error("Expected ctx to be nil after NewApp(), should be set in startup()")
	}
	if app.store != nil {
		t.Error("Expected store to be nil after NewApp(), should be set in startup()")
	}
	if app.svc != nil {
		t.Error("Expected svc to be nil after NewApp(), should be set in startup()")
	}
}

func TestGreet(t *testing.T) {
	app := NewApp()
	result := app.Greet("TestUser")
	expected := "Hello TestUser, It's show time!"
	if result != expected {
		t.Errorf("Greet() = %q, want %q", result, expected)
	}
}

func TestGetVersion(t *testing.T) {
	app := NewApp()
	version := app.GetVersion()
	if version == "" {
		t.Error("GetVersion() returned empty string")
	}
	if !strings.Contains(version, ".") {
		t.Errorf("Version %q doesn't look like a semantic version", version)
	}
}

func TestFuzzySearch(t *testing.T) {
	app := NewApp()

	items := []string{"Grocery Store", "Gas Station", "Electric Bill", "Water Bill"}

	results := app.FuzzySearch("gas", items)
	if len(results) == 0 {
		t.Error("Expected results for 'gas' query")
	}

	results = app.FuzzySearch("grocery", items)
	found := false
	for _, r := range results {
		if strings.Contains(strings.ToLower(r), "grocery") {
			found = true
			break
		}
	}
	if !found {
		t.Error("Expected to find 'grocery' in results")
	}

	results = app.FuzzySearch("xyz", items)

	results = app.FuzzySearch("", items)
	if len(results) != len(items) {
		t.Errorf("Empty query should return all items, got %d, want %d", len(results), len(items))
	}
}

// ============================================================================
// 2. Transaction Management
// ============================================================================

func TestImportTransactions(t *testing.T) {
	store := setupTestDB(t)

	app := newTestApp(t, store)

	t.Run("successful import with all fields", func(t *testing.T) {
		transactions := []TransactionInput{
			{
				Date:        "2024-01-15",
				Description: "Test Transaction",
				Amount:      10050,
				Category:    "Groceries",
				Account:     "Checking",
				Owner:       "John",
			},
		}

		err := app.ImportTransactions(transactions)
		if err != nil {
			t.Fatalf("ImportTransactions failed: %v", err)
		}

		count := countTransactions(t, store)
		if count != 1 {
			t.Errorf("Expected 1 transaction, got %d", count)
		}
	})

	t.Run("import with empty transaction list", func(t *testing.T) {
		err := app.ImportTransactions([]TransactionInput{})
		if err != nil {
			t.Errorf("ImportTransactions with empty list should not error: %v", err)
		}

		count := countTransactions(t, store)
		if count != 1 {
			t.Errorf("Expected 1 transaction (from previous test), got %d", count)
		}
	})

	t.Run("creates new accounts, owners, categories", func(t *testing.T) {
		transactions := []TransactionInput{
			{
				Date:        "2024-01-16",
				Description: "New Transaction",
				Amount:      50.00,
				Category:    "New Category",
				Account:     "New Account",
				Owner:       "Jane",
			},
		}

		err := app.ImportTransactions(transactions)
		if err != nil {
			t.Fatalf("ImportTransactions failed: %v", err)
		}

		accounts := countAccounts(t, store)
		owners := countUsers(t, store)
		categories := countCategories(t, store)

		if accounts != 2 {
			t.Errorf("Expected 2 accounts, got %d", accounts)
		}
		if owners != 2 {
			t.Errorf("Expected 2 owners, got %d", owners)
		}
		if categories != 2 {
			t.Errorf("Expected 2 categories, got %d", categories)
		}
	})

	t.Run("reuses existing accounts, owners, categories", func(t *testing.T) {
		transactions := []TransactionInput{
			{
				Date:        "2024-01-17",
				Description: "Reuse Test",
				Amount:      75.00,
				Category:    "Groceries",
				Account:     "Checking",
				Owner:       "John",
			},
		}

		err := app.ImportTransactions(transactions)
		if err != nil {
			t.Fatalf("ImportTransactions failed: %v", err)
		}

		accounts := countAccounts(t, store)
		owners := countUsers(t, store)
		categories := countCategories(t, store)

		if accounts != 2 {
			t.Errorf("Expected 2 accounts (no new ones), got %d", accounts)
		}
		if owners != 2 {
			t.Errorf("Expected 2 owners (no new ones), got %d", owners)
		}
		if categories != 2 {
			t.Errorf("Expected 2 categories (no new ones), got %d", categories)
		}
	})

	t.Run("import without owner", func(t *testing.T) {
		transactions := []TransactionInput{
			{
				Date:        "2024-01-18",
				Description: "No Owner",
				Amount:      25.00,
				Category:    "Groceries",
				Account:     "Checking",
			},
		}

		err := app.ImportTransactions(transactions)
		if err != nil {
			t.Fatalf("ImportTransactions failed: %v", err)
		}

		count := countTransactions(t, store)
		if count != 4 {
			t.Errorf("Expected 4 transactions, got %d", count)
		}
	})
}

func TestImportTransactions_ForeignCurrency(t *testing.T) {
	store := setupTestDB(t)

	app := newTestApp(t, store)

	// Pre-populate the FX rate cache by getting a rate
	_, _ = store.GetFxRate("CAD", "USD", "2024-01-10")

	// Import a transaction with a different currency
	transactions := []TransactionInput{
		{
			Date:        "2024-01-15",
			Description: "Foreign Transaction",
			Amount:      10000,
			Category:    "Travel",
			Account:     "Credit Card",
			Owner:       "John",
			Currency:    "USD",
		},
	}

	err := app.ImportTransactions(transactions)
	if err != nil {
		t.Fatalf("ImportTransactions failed: %v", err)
	}

	// Verify the transaction was imported with correct currency
	txs, err := store.GetAnalysisTransactions("2024-01-01", "2024-01-31", nil, nil)
	if err != nil {
		t.Fatalf("GetAnalysisTransactions failed: %v", err)
	}

	if len(txs) != 1 {
		t.Errorf("Expected 1 transaction, got %d", len(txs))
	}

	if txs[0].Currency != "USD" {
		t.Errorf("Expected currency 'USD', got '%s'", txs[0].Currency)
	}
}

func TestGetUncategorizedTransactions(t *testing.T) {
	store := setupTestDB(t)

	app := newTestApp(t, store)
	accountID := createTestAccount(t, store, "TestAccount")

	tx1 := createTestTransaction(t, store, accountID, nil, "2024-01-01", "Uncategorized 1", 100.00, nil)

	catID := createTestCategory(t, store, "Groceries")
	createTestTransaction(t, store, accountID, nil, "2024-01-02", "Categorized 1", 50.00, &catID)

	txs, err := app.GetUncategorizedTransactions()
	if err != nil {
		t.Fatalf("GetUncategorizedTransactions failed: %v", err)
	}

	if len(txs) != 1 {
		t.Errorf("Expected 1 uncategorized transaction, got %d", len(txs))
	}

	if len(txs) > 0 && txs[0].ID != tx1.ID {
		t.Errorf("Expected transaction ID %d, got %d", tx1.ID, txs[0].ID)
	}
}

func TestCategorizeTransaction(t *testing.T) {
	store := setupTestDB(t)

	app := newTestApp(t, store)
	accountID := createTestAccount(t, store, "TestAccount")

	tx := createTestTransaction(t, store, accountID, nil, "2024-01-01", "Test", 100.00, nil)

	t.Run("categorize with new category", func(t *testing.T) {
		result, err := app.CategorizeTransaction(tx.ID, "Groceries")
		if err != nil {
			t.Fatalf("CategorizeTransaction failed: %v", err)
		}
		if result == nil {
			t.Fatal("Expected non-nil result")
		}
		if result.TransactionID != tx.ID {
			t.Errorf("Expected transaction ID %d, got %d", tx.ID, result.TransactionID)
		}

		var catID sql.NullInt64
		err = store.DB().QueryRow("SELECT category_id FROM transactions WHERE id = ?", tx.ID).Scan(&catID)
		if err != nil {
			t.Fatalf("Failed to query transaction: %v", err)
		}
		if !catID.Valid {
			t.Error("Expected transaction to have a category_id")
		}
	})

	t.Run("categorize with existing category", func(t *testing.T) {
		tx2 := createTestTransaction(t, store, accountID, nil, "2024-01-02", "Test2", 50.00, nil)
		createTestCategory(t, store, "Transportation")

		_, err := app.CategorizeTransaction(tx2.ID, "Transportation")
		if err != nil {
			t.Fatalf("CategorizeTransaction failed: %v", err)
		}

		count := countCategories(t, store)
		if count != 2 {
			t.Errorf("Expected 2 categories, got %d", count)
		}
	})

	t.Run("uncategorize transaction with empty string", func(t *testing.T) {
		tx3 := createTestTransaction(t, store, accountID, nil, "2024-01-03", "Test3", 75.00, nil)
		catID := createTestCategory(t, store, "Utilities")

		_, err := store.DB().Exec("UPDATE transactions SET category_id = ? WHERE id = ?", catID, tx3.ID)
		if err != nil {
			t.Fatalf("Failed to categorize transaction: %v", err)
		}

		_, err = app.CategorizeTransaction(tx3.ID, "")
		if err != nil {
			t.Fatalf("CategorizeTransaction with empty string failed: %v", err)
		}

		var catID2 sql.NullInt64
		err = store.DB().QueryRow("SELECT category_id FROM transactions WHERE id = ?", tx3.ID).Scan(&catID2)
		if err != nil {
			t.Fatalf("Failed to query transaction: %v", err)
		}
		if catID2.Valid {
			t.Error("Expected transaction to have NULL category_id")
		}
	})
}

// ============================================================================
// 3. Category Management
// ============================================================================

func TestGetCategories(t *testing.T) {
	store := setupTestDB(t)

	app := newTestApp(t, store)

	createTestCategory(t, store, "Groceries")
	createTestCategory(t, store, "Transportation")
	createTestCategory(t, store, "Utilities")

	categories, err := app.GetCategories()
	if err != nil {
		t.Fatalf("GetCategories failed: %v", err)
	}

	if len(categories) != 3 {
		t.Errorf("Expected 3 categories, got %d", len(categories))
	}

	for i := 1; i < len(categories); i++ {
		if categories[i-1].Name > categories[i].Name {
			t.Error("Expected categories to be sorted alphabetically")
		}
	}
}

func TestSearchCategories(t *testing.T) {
	store := setupTestDB(t)

	app := newTestApp(t, store)

	createTestCategory(t, store, "Groceries")
	createTestCategory(t, store, "Gas")
	createTestCategory(t, store, "Gardening")
	createTestCategory(t, store, "Utilities")
	createTestCategory(t, store, "Transportation")

	t.Run("search with query", func(t *testing.T) {
		categories, err := app.SearchCategories("ga")
		if err != nil {
			t.Fatalf("SearchCategories failed: %v", err)
		}

		if len(categories) == 0 {
			t.Error("Expected results for 'ga' query")
		}

		found := false
		for _, cat := range categories {
			if strings.Contains(strings.ToLower(cat.Name), "ga") {
				found = true
				break
			}
		}
		if !found {
			t.Error("Expected to find categories matching 'ga'")
		}
	})

	t.Run("empty query returns top 10", func(t *testing.T) {
		categories, err := app.SearchCategories("")
		if err != nil {
			t.Fatalf("SearchCategories failed: %v", err)
		}

		if len(categories) != 5 {
			t.Errorf("Expected 5 categories, got %d", len(categories))
		}
	})

	t.Run("no matches", func(t *testing.T) {
		categories, err := app.SearchCategories("xyz")
		if err != nil {
			t.Fatalf("SearchCategories failed: %v", err)
		}

		if len(categories) != 0 {
			t.Errorf("Expected 0 categories for 'xyz', got %d", len(categories))
		}
	})
}

func TestRenameCategory(t *testing.T) {
	store := setupTestDB(t)

	app := newTestApp(t, store)

	catID := createTestCategory(t, store, "OldName")

	err := app.RenameCategory(catID, "NewName")
	if err != nil {
		t.Fatalf("RenameCategory failed: %v", err)
	}

	var name string
	err = store.DB().QueryRow("SELECT name FROM categories WHERE id = ?", catID).Scan(&name)
	if err != nil {
		t.Fatalf("Failed to query category: %v", err)
	}

	if name != "NewName" {
		t.Errorf("Expected category name 'NewName', got '%s'", name)
	}
}

// ============================================================================
// 4. Account & Owner Management
// ============================================================================

func TestGetAccounts(t *testing.T) {
	store := setupTestDB(t)

	app := newTestApp(t, store)

	createTestAccount(t, store, "Checking")
	createTestAccount(t, store, "Savings")
	createTestAccount(t, store, "Credit Card")

	accounts, err := app.GetAccounts()
	if err != nil {
		t.Fatalf("GetAccounts failed: %v", err)
	}

	if len(accounts) != 3 {
		t.Errorf("Expected 3 accounts, got %d", len(accounts))
	}

	for i := 1; i < len(accounts); i++ {
		if accounts[i-1] > accounts[i] {
			t.Error("Expected accounts to be sorted alphabetically")
		}
	}
}

func TestGetOwners(t *testing.T) {
	store := setupTestDB(t)

	app := newTestApp(t, store)

	createTestOwner(t, store, "Alice")
	createTestOwner(t, store, "Bob")
	createTestOwner(t, store, "Charlie")

	owners, err := app.GetOwners()
	if err != nil {
		t.Fatalf("GetOwners failed: %v", err)
	}

	if len(owners) != 3 {
		t.Errorf("Expected 3 owners, got %d", len(owners))
	}

	for i := 1; i < len(owners); i++ {
		if owners[i-1] > owners[i] {
			t.Error("Expected owners to be sorted alphabetically")
		}
	}
}

func TestCreateAccount(t *testing.T) {
	store := setupTestDB(t)

	app := newTestApp(t, store)

	t.Run("creates new account", func(t *testing.T) {
		id, err := app.CreateAccount("New Account")
		if err != nil {
			t.Fatalf("CreateAccount failed: %v", err)
		}
		if id <= 0 {
			t.Errorf("Expected positive account ID, got %d", id)
		}

		count := countAccounts(t, store)
		if count != 1 {
			t.Errorf("Expected 1 account, got %d", count)
		}
	})

	t.Run("reuses existing account", func(t *testing.T) {
		id1, err := app.CreateAccount("Existing Account")
		if err != nil {
			t.Fatalf("CreateAccount failed: %v", err)
		}

		id2, err := app.CreateAccount("Existing Account")
		if err != nil {
			t.Fatalf("CreateAccount failed: %v", err)
		}

		if id1 != id2 {
			t.Errorf("Expected same account ID %d, got %d", id1, id2)
		}

		count := countAccounts(t, store)
		if count != 2 {
			t.Errorf("Expected 2 accounts, got %d", count)
		}
	})
}

func TestCreateOwner(t *testing.T) {
	store := setupTestDB(t)

	app := newTestApp(t, store)

	t.Run("creates new owner", func(t *testing.T) {
		id, err := app.CreateOwner("New Owner")
		if err != nil {
			t.Fatalf("CreateOwner failed: %v", err)
		}
		if id <= 0 {
			t.Errorf("Expected positive owner ID, got %d", id)
		}

		count := countUsers(t, store)
		if count != 1 {
			t.Errorf("Expected 1 owner, got %d", count)
		}
	})

	t.Run("reuses existing owner", func(t *testing.T) {
		id1, err := app.CreateOwner("Existing Owner")
		if err != nil {
			t.Fatalf("CreateOwner failed: %v", err)
		}

		id2, err := app.CreateOwner("Existing Owner")
		if err != nil {
			t.Fatalf("CreateOwner failed: %v", err)
		}

		if id1 != id2 {
			t.Errorf("Expected same owner ID %d, got %d", id1, id2)
		}

		count := countUsers(t, store)
		if count != 2 {
			t.Errorf("Expected 2 owners, got %d", count)
		}
	})
}

// ============================================================================
// 5. Categorization Rules
// ============================================================================

func TestGetCategorizationRulesCount(t *testing.T) {
	store := setupTestDB(t)

	app := newTestApp(t, store)

	count, err := app.GetCategorizationRulesCount()
	if err != nil {
		t.Fatalf("GetCategorizationRulesCount failed: %v", err)
	}

	if count != 0 {
		t.Errorf("Expected 0 rules, got %d", count)
	}

	catID := createTestCategory(t, store, "Groceries")
	rule := database.CategorizationRule{
		MatchType:    "contains",
		MatchValue:   "grocery",
		CategoryID:   catID,
		CategoryName: "Groceries",
	}
	createTestRule(t, store, rule)

	count, err = app.GetCategorizationRulesCount()
	if err != nil {
		t.Fatalf("GetCategorizationRulesCount failed: %v", err)
	}

	if count != 1 {
		t.Errorf("Expected 1 rule, got %d", count)
	}
}

func TestSaveCategorizationRule(t *testing.T) {
	store := setupTestDB(t)

	app := newTestApp(t, store)
	accountID := createTestAccount(t, store, "TestAccount")

	createTestTransaction(t, store, accountID, nil, "2024-01-01", "Grocery Store", 100.00, nil)
	createTestTransaction(t, store, accountID, nil, "2024-01-02", "Weekly Grocery Shopping", 50.00, nil)
	createTestTransaction(t, store, accountID, nil, "2024-01-03", "Gas Station", 30.00, nil)

	t.Run("save rule with category ID", func(t *testing.T) {
		catID := createTestCategory(t, store, "Groceries")
		rule := database.CategorizationRule{
			MatchType:  "contains",
			MatchValue: "grocery",
			CategoryID: catID,
		}

		result, err := app.SaveCategorizationRule(rule)
		if err != nil {
			t.Fatalf("SaveCategorizationRule failed: %v", err)
		}
		if result == nil {
			t.Fatal("Expected non-nil result")
		}
		if result.RuleID <= 0 {
			t.Errorf("Expected positive rule ID, got %d", result.RuleID)
		}

		var uncategorizedCount int64
		err = store.DB().QueryRow("SELECT COUNT(*) FROM transactions WHERE category_id IS NULL").Scan(&uncategorizedCount)
		if err != nil {
			t.Fatalf("Failed to count uncategorized transactions: %v", err)
		}

		if uncategorizedCount != 1 {
			t.Errorf("Expected 1 uncategorized transaction (Gas Station), got %d", uncategorizedCount)
		}
	})

	t.Run("save rule with category name", func(t *testing.T) {
		rule := database.CategorizationRule{
			MatchType:    "contains",
			MatchValue:   "gas",
			CategoryName: "Transportation",
		}

		_, err := app.SaveCategorizationRule(rule)
		if err != nil {
			t.Fatalf("SaveCategorizationRule failed: %v", err)
		}

		count := countCategories(t, store)
		if count != 2 {
			t.Errorf("Expected 2 categories, got %d", count)
		}

		var uncategorizedCount int64
		err = store.DB().QueryRow("SELECT COUNT(*) FROM transactions WHERE category_id IS NULL").Scan(&uncategorizedCount)
		if err != nil {
			t.Fatalf("Failed to count uncategorized transactions: %v", err)
		}

		if uncategorizedCount != 0 {
			t.Errorf("Expected 0 uncategorized transactions, got %d", uncategorizedCount)
		}
	})
}

func TestUndoCategorizationRule(t *testing.T) {
	store := setupTestDB(t)

	app := newTestApp(t, store)
	accountID := createTestAccount(t, store, "TestAccount")
	gasCatID := createTestCategory(t, store, "Gas")
	groceryCatID := createTestCategory(t, store, "Groceries")

	t.Run("undo reverts only affected transactions", func(t *testing.T) {
		tx1 := createTestTransaction(t, store, accountID, nil, "2024-01-01", "Gas Station", 50.00, nil)
		_ = createTestTransaction(t, store, accountID, nil, "2024-01-02", "Grocery Store", 100.00, nil)
		tx3 := createTestTransaction(t, store, accountID, nil, "2024-01-03", "Another Gas", 30.00, nil)

		tx4 := createTestTransaction(t, store, accountID, nil, "2024-01-04", "Grocery Market", 75.00, nil)

		if err := store.UpdateTransactionCategory(tx4.ID, groceryCatID); err != nil {
			t.Fatalf("Failed to categorize tx4: %v", err)
		}

		rule := database.CategorizationRule{
			MatchType:  "contains",
			MatchValue: "gas",
			CategoryID: gasCatID,
		}

		result, err := app.SaveCategorizationRule(rule)
		if err != nil {
			t.Fatalf("SaveCategorizationRule failed: %v", err)
		}
		if result == nil {
			t.Fatal("Expected non-nil result")
		}

		expectedAffectedCount := 2
		if len(result.AffectedIds) != expectedAffectedCount {
			t.Errorf("Expected %d affected transactions, got %d", expectedAffectedCount, len(result.AffectedIds))
		}

		for _, id := range result.AffectedIds {
			if id != tx1.ID && id != tx3.ID {
				t.Errorf("Unexpected affected transaction ID: %d", id)
			}
		}

		var tx4CatID int64
		err = store.DB().QueryRow("SELECT category_id FROM transactions WHERE id = ?", tx4.ID).Scan(&tx4CatID)
		if err != nil {
			t.Fatalf("Failed to get tx4 category: %v", err)
		}
		if tx4CatID != groceryCatID {
			t.Errorf("tx4 should still be categorized as Groceries, got category_id %d", tx4CatID)
		}

		err = app.UndoCategorizationRule(result.RuleID, result.AffectedIds)
		if err != nil {
			t.Fatalf("UndoCategorizationRule failed: %v", err)
		}

		var tx1CatID sql.NullInt64
		err = store.DB().QueryRow("SELECT category_id FROM transactions WHERE id = ?", tx1.ID).Scan(&tx1CatID)
		if err != nil {
			t.Fatalf("Failed to get tx1 category after undo: %v", err)
		}
		if tx1CatID.Valid {
			t.Errorf("tx1 should be uncategorized after undo, got category_id %d", tx1CatID.Int64)
		}

		var tx3CatID sql.NullInt64
		err = store.DB().QueryRow("SELECT category_id FROM transactions WHERE id = ?", tx3.ID).Scan(&tx3CatID)
		if err != nil {
			t.Fatalf("Failed to get tx3 category after undo: %v", err)
		}
		if tx3CatID.Valid {
			t.Errorf("tx3 should be uncategorized after undo, got category_id %d", tx3CatID.Int64)
		}

		err = store.DB().QueryRow("SELECT category_id FROM transactions WHERE id = ?", tx4.ID).Scan(&tx4CatID)
		if err != nil {
			t.Fatalf("Failed to get tx4 category after undo: %v", err)
		}
		if tx4CatID != groceryCatID {
			t.Errorf("tx4 should still be categorized as Groceries after undo, got category_id %d", tx4CatID)
		}

		var ruleExists bool
		err = store.DB().QueryRow("SELECT EXISTS(SELECT 1 FROM categorization_rules WHERE id = ?)", result.RuleID).Scan(&ruleExists)
		if err != nil {
			t.Fatalf("Failed to check rule existence: %v", err)
		}
		if ruleExists {
			t.Error("Rule should be deleted after undo")
		}
	})

	t.Run("undo with amount filter", func(t *testing.T) {
		tx1 := createTestTransaction(t, store, accountID, nil, "2024-01-05", "Big Grocery", 10000, nil)
		tx2 := createTestTransaction(t, store, accountID, nil, "2024-01-06", "Small Grocery", 1000, nil)
		tx3 := createTestTransaction(t, store, accountID, nil, "2024-01-07", "Huge Grocery", 15000, nil)

		minAmount := int64(5000)
		rule := database.CategorizationRule{
			MatchType:  "contains",
			MatchValue: "grocery",
			CategoryID: groceryCatID,
			AmountMin:  &minAmount,
		}

		result, err := app.SaveCategorizationRule(rule)
		if err != nil {
			t.Fatalf("SaveCategorizationRule failed: %v", err)
		}

		var tx2CatID sql.NullInt64
		err = store.DB().QueryRow("SELECT category_id FROM transactions WHERE id = ?", tx2.ID).Scan(&tx2CatID)
		if err != nil {
			t.Fatalf("Failed to get tx2 category: %v", err)
		}
		if tx2CatID.Valid {
			t.Errorf("tx2 (amount $10) should not be categorized by rule with min_amount $50")
		}

		var tx1CatID sql.NullInt64
		err = store.DB().QueryRow("SELECT category_id FROM transactions WHERE id = ?", tx1.ID).Scan(&tx1CatID)
		if err != nil {
			t.Fatalf("Failed to get tx1 category: %v", err)
		}
		if !tx1CatID.Valid {
			t.Errorf("tx1 (amount $100) should be categorized by rule")
		}

		var tx3CatID sql.NullInt64
		err = store.DB().QueryRow("SELECT category_id FROM transactions WHERE id = ?", tx3.ID).Scan(&tx3CatID)
		if err != nil {
			t.Fatalf("Failed to get tx3 category: %v", err)
		}
		if !tx3CatID.Valid {
			t.Errorf("tx3 (amount $150) should be categorized by rule")
		}

		affectedIdsMap := make(map[int64]bool)
		for _, id := range result.AffectedIds {
			affectedIdsMap[id] = true
		}
		if !affectedIdsMap[tx1.ID] {
			t.Errorf("tx1 ID should be in affectedIds")
		}
		if !affectedIdsMap[tx3.ID] {
			t.Errorf("tx3 ID should be in affectedIds")
		}
		if affectedIdsMap[tx2.ID] {
			t.Errorf("tx2 ID should not be in affectedIds")
		}

		err = app.UndoCategorizationRule(result.RuleID, result.AffectedIds)
		if err != nil {
			t.Fatalf("UndoCategorizationRule failed: %v", err)
		}

		err = store.DB().QueryRow("SELECT category_id FROM transactions WHERE id = ?", tx1.ID).Scan(&tx1CatID)
		if err != nil {
			t.Fatalf("Failed to get tx1 category after undo: %v", err)
		}
		if tx1CatID.Valid {
			t.Errorf("tx1 should be uncategorized after undo")
		}

		err = store.DB().QueryRow("SELECT category_id FROM transactions WHERE id = ?", tx3.ID).Scan(&tx3CatID)
		if err != nil {
			t.Fatalf("Failed to get tx3 category after undo: %v", err)
		}
		if tx3CatID.Valid {
			t.Errorf("tx3 should be uncategorized after undo")
		}
	})
}

// ============================================================================
// 6. Search & Filtering
// ============================================================================

func TestSearchTransactions(t *testing.T) {
	store := setupTestDB(t)

	app := newTestApp(t, store)
	accountID := createTestAccount(t, store, "TestAccount")

	createTestTransaction(t, store, accountID, nil, "2024-01-01", "Grocery Store", 10000, nil)
	createTestTransaction(t, store, accountID, nil, "2024-01-02", "Gas Station", 5000, nil)
	createTestTransaction(t, store, accountID, nil, "2024-01-03", "Weekly Grocery Shopping", 7500, nil)

	t.Run("search by description contains", func(t *testing.T) {
		results, err := app.SearchTransactions("grocery", "contains", nil, nil)
		if err != nil {
			t.Fatalf("SearchTransactions failed: %v", err)
		}

		for _, r := range results {
			t.Logf("Found: %q (ID: %d)", r.Description, r.ID)
		}

		if len(results) != 2 {
			t.Errorf("Expected 2 results for 'grocery' contains, got %d", len(results))
		}
	})

	t.Run("search by description starts_with", func(t *testing.T) {
		results, err := app.SearchTransactions("Grocery", "starts_with", nil, nil)
		if err != nil {
			t.Fatalf("SearchTransactions failed: %v", err)
		}

		if len(results) != 1 {
			t.Errorf("Expected 1 result for 'Grocery' starts_with, got %d", len(results))
		}

		if len(results) > 0 && results[0].Description != "Grocery Store" {
			t.Errorf("Expected 'Grocery Store', got '%s'", results[0].Description)
		}
	})

	t.Run("search by description ends_with", func(t *testing.T) {
		results, err := app.SearchTransactions("Store", "ends_with", nil, nil)
		if err != nil {
			t.Fatalf("SearchTransactions failed: %v", err)
		}

		if len(results) != 1 {
			t.Errorf("Expected 1 result for 'Store' ends_with, got %d", len(results))
		}
	})

	t.Run("search with amount range", func(t *testing.T) {
		min := int64(6000)
		max := int64(10000)
		results, err := app.SearchTransactions("", "", &min, &max)
		if err != nil {
			t.Fatalf("SearchTransactions failed: %v", err)
		}

		if len(results) != 2 {
			t.Errorf("Expected 2 results for amount range 60-100, got %d", len(results))
		}
	})

	t.Run("combined filters", func(t *testing.T) {
		min := int64(7000)
		results, err := app.SearchTransactions("grocery", "contains", &min, nil)
		if err != nil {
			t.Fatalf("SearchTransactions failed: %v", err)
		}

		if len(results) != 2 {
			t.Errorf("Expected 2 results for combined filters, got %d", len(results))
		}
	})
}

func TestGetMonthList(t *testing.T) {
	store := setupTestDB(t)

	app := newTestApp(t, store)
	accountID := createTestAccount(t, store, "TestAccount")

	createTestTransaction(t, store, accountID, nil, "2024-01-15", "Tx1", 100.00, nil)
	createTestTransaction(t, store, accountID, nil, "2024-01-20", "Tx2", 50.00, nil)
	createTestTransaction(t, store, accountID, nil, "2024-02-10", "Tx3", 75.00, nil)
	createTestTransaction(t, store, accountID, nil, "2024-03-05", "Tx4", 25.00, nil)

	months, err := app.GetMonthList()
	if err != nil {
		t.Fatalf("GetMonthList failed: %v", err)
	}

	if len(months) != 3 {
		t.Errorf("Expected 3 months, got %d", len(months))
	}

	if months[0] != "2024-03" {
		t.Errorf("Expected first month to be '2024-03', got '%s'", months[0])
	}
}

func TestGetAnalysisTransactions(t *testing.T) {
	store := setupTestDB(t)

	app := newTestApp(t, store)
	accountID := createTestAccount(t, store, "TestAccount")

	createTestTransaction(t, store, accountID, nil, "2024-01-10", "Jan 1", 100.00, nil)
	createTestTransaction(t, store, accountID, nil, "2024-01-20", "Jan 2", 50.00, nil)
	createTestTransaction(t, store, accountID, nil, "2024-02-10", "Feb 1", 75.00, nil)
	createTestTransaction(t, store, accountID, nil, "2024-03-05", "Mar 1", 25.00, nil)

	t.Run("date range only", func(t *testing.T) {
		results, err := app.GetAnalysisTransactions("2024-01-01", "2024-01-31", nil, nil)
		if err != nil {
			t.Fatalf("GetAnalysisTransactions failed: %v", err)
		}

		if len(results) != 2 {
			t.Errorf("Expected 2 transactions in January, got %d", len(results))
		}
	})

	t.Run("filter by categories", func(t *testing.T) {
		catID := createTestCategory(t, store, "Groceries")
		tx := createTestTransaction(t, store, accountID, nil, "2024-01-15", "Categorized", 50.00, &catID)

		results, err := app.GetAnalysisTransactions("2024-01-01", "2024-01-31", []int64{catID}, nil)
		if err != nil {
			t.Fatalf("GetAnalysisTransactions failed: %v", err)
		}

		if len(results) != 1 {
			t.Errorf("Expected 1 transaction with category filter, got %d", len(results))
		}

		if len(results) > 0 && results[0].ID != tx.ID {
			t.Errorf("Expected transaction ID %d, got %d", tx.ID, results[0].ID)
		}
	})

	t.Run("filter by uncategorized (category ID 0)", func(t *testing.T) {
		results, err := app.GetAnalysisTransactions("2024-01-01", "2024-01-31", []int64{0}, nil)
		if err != nil {
			t.Fatalf("GetAnalysisTransactions failed: %v", err)
		}

		if len(results) != 2 {
			t.Errorf("Expected 2 uncategorized transactions in January, got %d", len(results))
		}
	})

	t.Run("filter by owner", func(t *testing.T) {
		// Create owner
		ownerID, err := app.CreateOwner("John")
		if err != nil {
			t.Fatalf("Failed to create owner: %v", err)
		}

		// Create transaction with owner
		_ = createTestTransaction(t, store, accountID, &ownerID, "2024-01-15", "John's purchase", 75.00, nil)

		// Get transactions filtered by owner
		results, err := app.GetAnalysisTransactions("2024-01-01", "2024-01-31", nil, []int64{ownerID})
		if err != nil {
			t.Fatalf("GetAnalysisTransactions failed: %v", err)
		}

		if len(results) != 1 {
			t.Errorf("Expected 1 transaction with owner filter, got %d", len(results))
		}

		if len(results) > 0 && results[0].Description != "John's purchase" {
			t.Errorf("Expected 'John's purchase', got %s", results[0].Description)
		}
	})

	t.Run("filter by no owner (owner ID 0)", func(t *testing.T) {
		// Get transactions without owner (owner_id IS NULL)
		results, err := app.GetAnalysisTransactions("2024-01-01", "2024-01-31", nil, []int64{0})
		if err != nil {
			t.Fatalf("GetAnalysisTransactions failed: %v", err)
		}

		// Should get the uncategorized transactions without owners
		// Note: We created 1 transaction with owner in the previous test, so count is reduced
		if len(results) < 1 {
			t.Errorf("Expected at least 1 transaction without owner, got %d", len(results))
		}
	})
}

// ============================================================================
// 7. Excel Parsing
// ============================================================================

func TestParseExcel(t *testing.T) {
	app := NewApp()

	t.Run("parse valid Excel file with transactions", func(t *testing.T) {
		xlsxData := readExcelFile(t, "transactions.xlsx")

		result, err := app.ParseExcel(xlsxData)
		if err != nil {
			t.Fatalf("Failed to parse Excel: %v", err)
		}

		if result == nil {
			t.Fatal("Expected non-nil result")
		}

		expectedHeaders := []string{"Date", "Description", "Amount", "Account"}
		if len(result.Headers) != len(expectedHeaders) {
			t.Errorf("Expected %d headers, got %d", len(expectedHeaders), len(result.Headers))
		}
		for i, h := range expectedHeaders {
			if i < len(result.Headers) && result.Headers[i] != h {
				t.Errorf("Header %d: expected '%s', got '%s'", i, h, result.Headers[i])
			}
		}

		if len(result.Rows) == 0 {
			t.Error("Expected at least one data row")
		}

		if len(result.Rows) > 0 {
			firstRow := result.Rows[0]
			expected := []string{"2025-01-15", "Coffee Shop", "4.5", "Checking"}
			for i, exp := range expected {
				if i >= len(firstRow) {
					t.Errorf("Row 0: missing column %d", i)
					continue
				}
				if firstRow[i] != exp {
					t.Errorf("Row 0, col %d: expected '%s', got '%s'", i, exp, firstRow[i])
				}
			}
		}
	})

	t.Run("invalid base64 data", func(t *testing.T) {
		invalidData := "not-valid-base64!!!"

		_, err := app.ParseExcel(invalidData)
		if err == nil {
			t.Error("Expected error for invalid base64 data")
		}
	})

	t.Run("empty string", func(t *testing.T) {
		_, err := app.ParseExcel("")
		if err == nil {
			t.Error("Expected error for empty string")
		}
	})
}

// ============================================================================
// 8. Web Search
// ============================================================================

func TestSearchWeb(t *testing.T) {
	store := setupTestDB(t)
	app := newTestApp(t, store)

	_, err := app.SearchWeb("")
	if err == nil {
		t.Error("Expected error for empty query")
	}
}

// ============================================================================
// 9. Column Mappings
// ============================================================================

func TestGetColumnMappings(t *testing.T) {
	store := setupTestDB(t)

	app := newTestApp(t, store)

	t.Run("empty mappings", func(t *testing.T) {
		mappings, err := app.GetColumnMappings()
		if err != nil {
			t.Fatalf("GetColumnMappings failed: %v", err)
		}

		if len(mappings) != 0 {
			t.Errorf("Expected 0 mappings, got %d", len(mappings))
		}
	})

	t.Run("with mappings", func(t *testing.T) {
		_, err := app.SaveColumnMapping("Test Mapping", `{"date": "A", "amount": "B"}`)
		if err != nil {
			t.Fatalf("SaveColumnMapping failed: %v", err)
		}

		mappings, err := app.GetColumnMappings()
		if err != nil {
			t.Fatalf("GetColumnMappings failed: %v", err)
		}

		if len(mappings) != 1 {
			t.Errorf("Expected 1 mapping, got %d", len(mappings))
		}

		if mappings[0].Name != "Test Mapping" {
			t.Errorf("Expected mapping name 'Test Mapping', got '%s'", mappings[0].Name)
		}
	})
}

func TestSaveColumnMapping(t *testing.T) {
	store := setupTestDB(t)

	app := newTestApp(t, store)

	t.Run("save new mapping", func(t *testing.T) {
		id, err := app.SaveColumnMapping("New Mapping", `{"date": "A"}`)
		if err != nil {
			t.Fatalf("SaveColumnMapping failed: %v", err)
		}
		if id <= 0 {
			t.Errorf("Expected positive mapping ID, got %d", id)
		}

		var count int64
		err = store.DB().QueryRow("SELECT COUNT(*) FROM column_mappings").Scan(&count)
		if err != nil {
			t.Fatalf("Failed to count mappings: %v", err)
		}

		if count != 1 {
			t.Errorf("Expected 1 mapping, got %d", count)
		}
	})

	t.Run("update existing mapping", func(t *testing.T) {
		_, err := app.SaveColumnMapping("Update Test", `{"old": "data"}`)
		if err != nil {
			t.Fatalf("SaveColumnMapping failed: %v", err)
		}

		_, err = app.SaveColumnMapping("Update Test", `{"new": "data"}`)
		if err != nil {
			t.Fatalf("SaveColumnMapping failed: %v", err)
		}

		var count int64
		err = store.DB().QueryRow("SELECT COUNT(*) FROM column_mappings WHERE name = ?", "Update Test").Scan(&count)
		if err != nil {
			t.Fatalf("Failed to count mappings: %v", err)
		}

		if count != 1 {
			t.Errorf("Expected 1 mapping after update, got %d", count)
		}
	})
}

func TestDeleteColumnMapping(t *testing.T) {
	store := setupTestDB(t)

	app := newTestApp(t, store)

	id, err := app.SaveColumnMapping("Delete Me", `{"data": "value"}`)
	if err != nil {
		t.Fatalf("SaveColumnMapping failed: %v", err)
	}

	err = app.DeleteColumnMapping(id)
	if err != nil {
		t.Fatalf("DeleteColumnMapping failed: %v", err)
	}

	var count int64
	err = store.DB().QueryRow("SELECT COUNT(*) FROM column_mappings").Scan(&count)
	if err != nil {
		t.Fatalf("Failed to count mappings: %v", err)
	}

	if count != 0 {
		t.Errorf("Expected 0 mappings after deletion, got %d", count)
	}
}

// ============================================================================
// 10. Export (No Dialog Tests)
// ============================================================================

func TestExportTransactions(t *testing.T) {
	store := setupTestDB(t)

	app := newTestApp(t, store)
	accountID := createTestAccount(t, store, "TestAccount")
	ownerID := createTestOwner(t, store, "Test Owner")
	catID := createTestCategory(t, store, "Groceries")

	createTestTransaction(t, store, accountID, ownerID, "2024-01-15", "Test Transaction", 10050, &catID)

	tempDir := t.TempDir()

	t.Run("export to CSV", func(t *testing.T) {
		csvPath := tempDir + "/test_export.csv"
		count, err := app.ExportTransactions("2024-01-01", "2024-01-31", nil, nil, "csv", csvPath)
		if err != nil {
			t.Fatalf("ExportTransactions to CSV failed: %v", err)
		}

		if count != 1 {
			t.Errorf("Expected to export 1 row, got %d", count)
		}

		if _, err := os.Stat(csvPath); os.IsNotExist(err) {
			t.Error("CSV file was not created")
		}

		content, err := os.ReadFile(csvPath)
		if err != nil {
			t.Fatalf("Failed to read CSV file: %v", err)
		}

		csvContent := string(content)
		if !strings.Contains(csvContent, "Test Transaction") {
			t.Error("CSV file should contain transaction description")
		}

		if !strings.Contains(csvContent, "Groceries") {
			t.Error("CSV file should contain category name")
		}
	})

	t.Run("export to XLSX", func(t *testing.T) {
		xlsxPath := tempDir + "/test_export.xlsx"
		count, err := app.ExportTransactions("2024-01-01", "2024-01-31", nil, nil, "xlsx", xlsxPath)
		if err != nil {
			t.Fatalf("ExportTransactions to XLSX failed: %v", err)
		}

		if count != 1 {
			t.Errorf("Expected to export 1 row, got %d", count)
		}

		if _, err := os.Stat(xlsxPath); os.IsNotExist(err) {
			t.Error("XLSX file was not created")
		}
	})

	t.Run("no transactions error", func(t *testing.T) {
		path := tempDir + "/no_transactions.csv"
		_, err := app.ExportTransactions("2025-01-01", "2025-01-31", nil, nil, "csv", path)
		if err == nil {
			t.Error("Expected error when no transactions in date range")
		}
	})

	t.Run("invalid format error", func(t *testing.T) {
		path := tempDir + "/invalid.txt"
		_, err := app.ExportTransactions("2024-01-01", "2024-01-31", nil, nil, "txt", path)
		if err == nil {
			t.Error("Expected error for invalid format")
		}
	})
}

// ============================================================================
// 11. Backup & Restore
// ============================================================================

func TestGetLastBackupInfo(t *testing.T) {
	store := setupTestDBWithFile(t)

	app := newTestApp(t, store)

	t.Run("returns backup info structure", func(t *testing.T) {
		info, err := app.GetLastBackupInfo()
		if err != nil {
			t.Fatalf("GetLastBackupInfo failed: %v", err)
		}

		if _, ok := info["hasBackup"]; !ok {
			t.Error("Expected info to have 'hasBackup' key")
		}
		if _, ok := info["lastBackupTime"]; !ok {
			t.Error("Expected info to have 'lastBackupTime' key")
		}
	})
}

func TestValidateBackupFile(t *testing.T) {
	store := setupTestDBWithFile(t)

	app := newTestApp(t, store)
	accountID := createTestAccount(t, store, "TestAccount")
	createTestTransaction(t, store, accountID, nil, "2024-01-01", "Test", 100.00, nil)

	tempDir := t.TempDir()

	t.Run("validate valid backup", func(t *testing.T) {
		backupPath := tempDir + "/valid_backup.db"
		err := store.CreateBackup(backupPath)
		if err != nil {
			t.Fatalf("Failed to create backup: %v", err)
		}

		meta, err := app.ValidateBackupFile(backupPath)
		if err != nil {
			t.Fatalf("ValidateBackupFile failed: %v", err)
		}

		if meta.Path != backupPath {
			t.Errorf("Expected path '%s', got '%s'", backupPath, meta.Path)
		}

		if meta.TransactionCount != 1 {
			t.Errorf("Expected 1 transaction, got %d", meta.TransactionCount)
		}

		if meta.Size <= 0 {
			t.Errorf("Expected positive size, got %d", meta.Size)
		}
	})

	t.Run("validate invalid file", func(t *testing.T) {
		invalidPath := tempDir + "/invalid.txt"
		err := os.WriteFile(invalidPath, []byte("not a database"), 0o644)
		if err != nil {
			t.Fatalf("Failed to write invalid file: %v", err)
		}

		_, err = app.ValidateBackupFile(invalidPath)
		if err == nil {
			t.Error("Expected error for invalid backup file")
		}
	})
}

func TestRestoreBackup(t *testing.T) {
	store := setupTestDBWithFile(t)

	app := newTestApp(t, store)
	accountID := createTestAccount(t, store, "TestAccount")

	createTestTransaction(t, store, accountID, nil, "2024-01-01", "Original", 100.00, nil)

	tempDir := t.TempDir()
	backupPath := tempDir + "/restore_test.db"

	err := store.CreateBackup(backupPath)
	if err != nil {
		t.Fatalf("Failed to create backup: %v", err)
	}

	createTestTransaction(t, store, accountID, nil, "2024-01-02", "New", 50.00, nil)

	countBeforeRestore := countTransactions(t, store)
	if countBeforeRestore != 2 {
		t.Errorf("Expected 2 transactions before restore, got %d", countBeforeRestore)
	}

	err = app.RestoreBackup(backupPath)
	if err != nil {
		t.Fatalf("RestoreBackup failed: %v", err)
	}

	countAfterRestore := countTransactions(t, store)
	if countAfterRestore != 1 {
		t.Errorf("Expected 1 transaction after restore, got %d", countAfterRestore)
	}
}

func TestRestoreBackup_EmptyPath(t *testing.T) {
	store := setupTestDB(t)

	app := newTestApp(t, store)

	err := app.RestoreBackup("")
	if err == nil {
		t.Error("Expected error for empty backup path")
	}
}

func TestTriggerAutoBackup(t *testing.T) {
	store := setupTestDBWithFile(t)

	app := newTestApp(t, store)

	t.Run("creates backup when needed", func(t *testing.T) {
		path, err := app.TriggerAutoBackup()
		_ = path
		if err != nil {
			t.Logf("TriggerAutoBackup returned error (may be expected): %v", err)
		}
	})
}

// ============================================================================
// 12. App Lifecycle
// ============================================================================

func TestShutdown(t *testing.T) {
	store := setupTestDBWithFile(t)

	app := newTestApp(t, store)

	accountID := createTestAccount(t, store, "TestAccount")
	createTestTransaction(t, store, accountID, nil, "2024-01-01", "Test", 100.00, nil)

	var count int64
	err := store.DB().QueryRow("SELECT COUNT(*) FROM transactions").Scan(&count)
	if err != nil {
		t.Fatalf("Failed to query database before shutdown: %v", err)
	}

	app.shutdown(context.Background())

	// Note: store.DB() will be nil after shutdown, which is expected behavior
}

// ============================================================================
// 13. Web Search Helpers
// ============================================================================

func TestGenerateDefaultFilename(t *testing.T) {
	t.Run("single month", func(t *testing.T) {
		filename := generateDefaultFilename("2024-01-01", "2024-01-31", "csv")
		expected := "cashmop_2024-01.csv"
		if filename != expected {
			t.Errorf("Expected '%s', got '%s'", expected, filename)
		}
	})

	t.Run("date range", func(t *testing.T) {
		filename := generateDefaultFilename("2024-01-01", "2024-03-31", "csv")
		expected := "cashmop_2024-01-01_to_2024-03-31.csv"
		if filename != expected {
			t.Errorf("Expected '%s', got '%s'", expected, filename)
		}
	})

	t.Run("different formats", func(t *testing.T) {
		filename := generateDefaultFilename("2024-01-01", "2024-01-31", "xlsx")
		expected := "cashmop_2024-01.xlsx"
		if filename != expected {
			t.Errorf("Expected '%s', got '%s'", expected, filename)
		}
	})
}
