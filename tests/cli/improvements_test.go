package cli_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestTableOutput(t *testing.T) {
	db := setupDB(t)

	// Seed some data
	run(db, "categories", "create", "--name", "Food")
	run(db, "categories", "create", "--name", "Rent")

	t.Run("Categories Table", func(t *testing.T) {
		res, err := run(db, "--format", "table", "categories", "list")
		if err != nil {
			t.Fatal(err)
		}
		if res.ExitCode != 0 {
			t.Errorf("expected exit code 0, got %d", res.ExitCode)
		}

		// Check for headers and data
		if !strings.Contains(res.Stdout, "ID") || !strings.Contains(res.Stdout, "Name") {
			t.Errorf("expected headers 'ID' and 'Name' in table output, got:\n%s", res.Stdout)
		}
		if !strings.Contains(res.Stdout, "Food") || !strings.Contains(res.Stdout, "Rent") {
			t.Errorf("expected 'Food' and 'Rent' in table output, got:\n%s", res.Stdout)
		}
	})

	t.Run("Transactions Table", func(t *testing.T) {
		mappingJSON := `{"csv":{"date":"Date","description":["Description"],"amountMapping":{"type":"single","column":"Amount"},"account":"Account","owner":"Owner"},"account":"BMO","currencyDefault":"CAD"}`
		mappingPath := filepath.Join(t.TempDir(), "mapping.json")
		os.WriteFile(mappingPath, []byte(mappingJSON), 0644)
		
		csvData := `Date,Description,Amount,Account,Owner
2025-01-10,Grocery Store,-10.00,BMO,Alex
`
		csvPath := filepath.Join(t.TempDir(), "data.csv")
		os.WriteFile(csvPath, []byte(csvData), 0644)
		run(db, "import", "--file", csvPath, "--mapping", mappingPath)

		res, err := run(db, "--format", "table", "tx", "list", "--start", "2025-01-01", "--end", "2025-01-31")
		if err != nil {
			t.Fatal(err)
		}
		
		expectedHeaders := []string{"ID", "Date", "Amount", "Curr", "Category", "Account", "Description"}
		for _, h := range expectedHeaders {
			if !strings.Contains(res.Stdout, h) {
				t.Errorf("missing header %q in table output", h)
			}
		}
		if !strings.Contains(res.Stdout, "Grocery Store") {
			t.Errorf("expected 'Grocery Store' in table output, got:\n%s", res.Stdout)
		}
	})
}

func TestRobustFlagValidation(t *testing.T) {
	db := setupDB(t)

	t.Run("Invalid category ID in tx list", func(t *testing.T) {
		res, err := run(db, "tx", "list", "--category-ids", "1,abc,3")
		if err != nil {
			t.Fatal(err)
		}
		if res.ExitCode != 2 {
			t.Errorf("expected exit code 2 for invalid category ID, got %d", res.ExitCode)
		}
		
		found := false
		if errors, ok := res.JSON["errors"].([]interface{}); ok {
			for _, e := range errors {
				ed := e.(map[string]interface{})
				if ed["field"] == "category-ids" && strings.Contains(ed["message"].(string), "Invalid category ID") {
					found = true
					break
				}
			}
		}
		if !found {
			t.Errorf("expected validation error for 'category-ids', got: %+v", res.JSON)
		}
	})

	t.Run("Invalid category ID in export", func(t *testing.T) {
		// First seed some data so we don't hit the "No transactions found" error first
		mappingJSON := `{"csv":{"date":"Date","description":["Description"],"amountMapping":{"type":"single","column":"Amount"},"account":"Account","owner":"Owner"},"account":"BMO","currencyDefault":"CAD"}`
		mappingPath := filepath.Join(t.TempDir(), "mapping_export.json")
		os.WriteFile(mappingPath, []byte(mappingJSON), 0644)
		csvData := "Date,Description,Amount,Account,Owner\n2025-01-10,Test,-10.00,BMO,Alex\n"
		csvPath := filepath.Join(t.TempDir(), "data_export.csv")
		os.WriteFile(csvPath, []byte(csvData), 0644)
		run(db, "import", "--file", csvPath, "--mapping", mappingPath)

		res, err := run(db, "export", "--start", "2025-01-01", "--end", "2025-01-31", "--format", "csv", "--out", "test.csv", "--category-ids", "invalid")
		if err != nil {
			t.Fatal(err)
		}
		if res.ExitCode != 2 {
			t.Errorf("expected exit code 2 for invalid category-ids in export, got %d. Stdout: %s", res.ExitCode, res.Stdout)
		}
	})
}

func TestSortOptimization(t *testing.T) {
	db := setupDB(t)
	
	// Seed data with different amounts
	mappingJSON := `{"csv":{"date":"Date","description":["Description"],"amountMapping":{"type":"single","column":"Amount"},"account":"Account","owner":"Owner"},"account":"BMO","currencyDefault":"CAD"}`
	mappingPath := filepath.Join(t.TempDir(), "mapping.json")
	os.WriteFile(mappingPath, []byte(mappingJSON), 0644)
	
	csvData := `Date,Description,Amount,Account,Owner
2025-01-10,Cheap,-1.00,BMO,Alex
2025-01-12,Expensive,-100.00,BMO,Alex
2025-01-15,Medium,-50.00,BMO,Alex
`
	csvPath := filepath.Join(t.TempDir(), "data.csv")
	os.WriteFile(csvPath, []byte(csvData), 0644)
	run(db, "import", "--file", csvPath, "--mapping", mappingPath)

	t.Run("Sort amount asc", func(t *testing.T) {
		res, _ := run(db, "tx", "list", "--sort", "amount", "--order", "asc", "--start", "2025-01-01", "--end", "2025-01-31")
		txs := res.JSON["transactions"].([]interface{})
		// -100, -50, -1
		if txs[0].(map[string]interface{})["description"] != "Expensive" {
			t.Errorf("expected Expensive first, got %v", txs[0].(map[string]interface{})["description"])
		}
	})

	t.Run("Sort amount desc", func(t *testing.T) {
		res, _ := run(db, "tx", "list", "--sort", "amount", "--order", "desc", "--start", "2025-01-01", "--end", "2025-01-31")
		txs := res.JSON["transactions"].([]interface{})
		// -1, -50, -100
		if txs[0].(map[string]interface{})["description"] != "Cheap" {
			t.Errorf("expected Cheap first, got %v", txs[0].(map[string]interface{})["description"])
		}
	})
}
