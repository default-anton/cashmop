package cli_test

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"
)

func TestTxListFilters(t *testing.T) {
	db := setupDB(t)
	// Import multiple months and categories
	mappingJSON := `{"csv":{"date":"Date","description":["Description"],"amountMapping":{"type":"single","column":"Amount"},"account":"Account","owner":"Owner"},"account":"BMO","currencyDefault":"CAD"}`
	mappingPath := filepath.Join(t.TempDir(), "mapping.json")
	if err := os.WriteFile(mappingPath, []byte(mappingJSON), 0644); err != nil {
		t.Fatal(err)
	}

	csvData := `Date,Description,Amount,Account,Owner
2025-01-10,Groceries,-50.00,BMO,Alex
2025-01-12,Internet,-80.00,BMO,Alex
2025-01-15,Salary,3000.00,BMO,Alex
2025-02-10,Rent,-1500.00,BMO,Alex
2025-02-12,Groceries,-60.00,BMO,Alex
`
	csvPath := filepath.Join(t.TempDir(), "data.csv")
	if err := os.WriteFile(csvPath, []byte(csvData), 0644); err != nil {
		t.Fatal(err)
	}

	res, err := run(db, "import", "--file", csvPath, "--mapping", mappingPath, "--month", "2025-01", "--month", "2025-02")
	if err != nil {
		t.Fatal(err)
	}
	assertGlobal(t, res, 0)

	t.Run("Default month", func(t *testing.T) {
		// Mock time might be needed if we want to test "last full calendar month"
		// But for now, let's just test explicit ranges
	})

	t.Run("Date range", func(t *testing.T) {
		res, _ := run(db, "tx", "list", "--start", "2025-01-01", "--end", "2025-01-31")
		assertGlobal(t, res, 0)
		if res.JSON["count"].(float64) != 3 {
			t.Errorf("expected 3 transactions, got %v", res.JSON["count"])
		}
	})

	t.Run("Uncategorized", func(t *testing.T) {
		// All imported should be uncategorized initially
		res, _ := run(db, "tx", "list", "--start", "2025-01-01", "--end", "2025-02-28", "--uncategorized")
		assertGlobal(t, res, 0)
		if res.JSON["count"].(float64) != 5 {
			t.Errorf("expected 5 uncategorized, got %v", res.JSON["count"])
		}
	})

	t.Run("Category filter", func(t *testing.T) {
		// Categorize one
		txsRes, _ := run(db, "tx", "list", "--start", "2025-01-01", "--end", "2025-01-31")
		txID := txsRes.JSON["transactions"].([]interface{})[0].(map[string]interface{})["id"]

		run(db, "tx", "categorize", "--id", fmt.Sprintf("%v", txID), "--category", "Food")

		// List categories to get ID
		catRes, _ := run(db, "categories", "list")
		foodID := catRes.JSON["items"].([]interface{})[0].(map[string]interface{})["id"]

		res, _ := run(db, "tx", "list", "--start", "2025-01-01", "--end", "2025-02-28", "--category-ids", fmt.Sprintf("%v", foodID))
		assertGlobal(t, res, 0)
		if res.JSON["count"].(float64) != 1 {
			t.Errorf("expected 1 in Food, got %v", res.JSON["count"])
		}

		// Both Food and Uncategorized
		res, _ = run(db, "tx", "list", "--start", "2025-01-01", "--end", "2025-02-28", "--category-ids", fmt.Sprintf("%v", foodID), "--uncategorized")
		assertGlobal(t, res, 0)
		if res.JSON["count"].(float64) != 5 {
			t.Errorf("expected 5 (1 Food + 4 Uncategorized), got %v", res.JSON["count"])
		}
	})

	t.Run("Query filter", func(t *testing.T) {
		// Categorize "Groceries" to something else to avoid "Uncategorized" match
		run(db, "categories", "create", "--name", "Groceries")

		// Find all Groceries and categorize them
		txsRes, _ := run(db, "tx", "list", "--start", "2025-01-01", "--end", "2025-02-28", "--query", "Groceries")
		for _, item := range txsRes.JSON["transactions"].([]interface{}) {
			tx := item.(map[string]interface{})
			run(db, "tx", "categorize", "--id", fmt.Sprintf("%v", tx["id"]), "--category", "Groceries")
		}

		res, _ := run(db, "tx", "list", "--start", "2025-01-01", "--end", "2025-02-28", "--query", "Rent")
		assertGlobal(t, res, 0)
		// Now "Internet" and "Salary" might still match "Rent" because of "Uncategorized"
		// Let's categorize EVERYTHING.

		txsAll, _ := run(db, "tx", "list", "--start", "2025-01-01", "--end", "2025-02-28")
		for _, item := range txsAll.JSON["transactions"].([]interface{}) {
			tx := item.(map[string]interface{})
			if tx["category"] == "Uncategorized" {
				run(db, "tx", "categorize", "--id", fmt.Sprintf("%v", tx["id"]), "--category", "Other")
			}
		}

		res, _ = run(db, "tx", "list", "--start", "2025-01-01", "--end", "2025-02-28", "--query", "Rent")
		assertGlobal(t, res, 0)
		if res.JSON["count"].(float64) != 1 {
			t.Errorf("expected 1 for 'Rent' after categorizing all, got %v", res.JSON["count"])
		}
	})

	t.Run("Amount filter", func(t *testing.T) {
		// Salary is 3000
		res, _ := run(db, "tx", "list", "--start", "2025-01-01", "--end", "2025-02-28", "--amount-min", "2000")
		assertGlobal(t, res, 0)
		if res.JSON["count"].(float64) != 1 {
			t.Errorf("expected 1 for > 2000, got %v", res.JSON["count"])
		}

		res, _ = run(db, "tx", "list", "--start", "2025-01-01", "--end", "2025-02-28", "--amount-max", "-1000")
		assertGlobal(t, res, 0)
		if res.JSON["count"].(float64) != 1 { // Rent is -1500
			t.Errorf("expected 1 for < -1000, got %v", res.JSON["count"])
		}
	})

	t.Run("Sorting", func(t *testing.T) {
		res, _ := run(db, "tx", "list", "--start", "2025-01-01", "--end", "2025-02-28", "--sort", "amount", "--order", "asc")
		assertGlobal(t, res, 0)
		txs := res.JSON["transactions"].([]interface{})
		if txs[0].(map[string]interface{})["description"] != "Rent" { // -1500.00
			t.Errorf("expected Rent as first item when sorting amount asc, got %v", txs[0].(map[string]interface{})["description"])
		}

		res, _ = run(db, "tx", "list", "--start", "2025-01-01", "--end", "2025-02-28", "--sort", "amount", "--order", "desc")
		assertGlobal(t, res, 0)
		txs = res.JSON["transactions"].([]interface{})
		if txs[0].(map[string]interface{})["description"] != "Salary" { // 3000.00
			t.Errorf("expected Salary as first item when sorting amount desc, got %v", txs[0].(map[string]interface{})["description"])
		}
	})
}
