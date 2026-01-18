package cli_test

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"
)

func TestRulesDetailed(t *testing.T) {
	db := setupDB(t)

	// Seed data
	mappingJSON := `{"csv":{"date":"Date","description":["Description"],"amountMapping":{"type":"single","column":"Amount"},"account":"Account","owner":"Owner"},"account":"BMO","currencyDefault":"CAD"}`
	mappingPath := filepath.Join(t.TempDir(), "mapping.json")
	os.WriteFile(mappingPath, []byte(mappingJSON), 0644)
	
	csvData := `Date,Description,Amount,Account,Owner
2025-01-10,Uber,-12.34,BMO,Alex
2025-01-12,Uber,-45.67,BMO,Alex
2025-01-15,Lyft,-20.00,BMO,Alex
`
	csvPath := filepath.Join(t.TempDir(), "data.csv")
	os.WriteFile(csvPath, []byte(csvData), 0644)
	run(db, "import", "--file", csvPath, "--mapping", mappingPath)

	t.Run("Create rule and apply", func(t *testing.T) {
		res, _ := run(db, "rules", "create", "--match-value", "Uber", "--match-type", "contains", "--category", "Transport")
		assertGlobal(t, res, 0)
		if res.JSON["rule_id"] == nil {
			t.Fatal("expected rule_id in response")
		}
		affected := res.JSON["affected_ids"].([]interface{})
		if len(affected) != 2 {
			t.Errorf("expected 2 affected transactions, got %d", len(affected))
		}

		// Verify categorization
		listRes, _ := run(db, "tx", "list", "--start", "2025-01-01", "--end", "2025-01-31", "--query", "Uber")
		for _, item := range listRes.JSON["transactions"].([]interface{}) {
			tx := item.(map[string]interface{})
			if tx["category"] != "Transport" {
				t.Errorf("expected category Transport for Uber, got %v", tx["category"])
			}
		}
	})

	t.Run("Preview rule", func(t *testing.T) {
		res, _ := run(db, "rules", "preview", "--match-value", "Lyft", "--match-type", "contains")
		assertGlobal(t, res, 0)
		if res.JSON["count"].(float64) != 1 {
			t.Errorf("expected 1 match for Lyft, got %v", res.JSON["count"])
		}
		
		// Preview with amount filter
		res, _ = run(db, "rules", "preview", "--match-value", "Uber", "--match-type", "contains", "--amount-min", "-20.00")
		assertGlobal(t, res, 0)
		if res.JSON["count"].(float64) != 1 { // Only -12.34 is > -20.00
			t.Errorf("expected 1 match for Uber > -20.00, got %v", res.JSON["count"])
		}
	})

	t.Run("Update rule with recategorize", func(t *testing.T) {
		rulesRes, _ := run(db, "rules", "list")
		ruleID := rulesRes.JSON["items"].([]interface{})[0].(map[string]interface{})["id"]

		// Change category to "Taxi" and recategorize
		res, _ := run(db, "rules", "update", "--id", fmt.Sprintf("%v", ruleID), "--category", "Taxi", "--recategorize")
		assertGlobal(t, res, 0)
		
		// Verify new category
		listRes, _ := run(db, "tx", "list", "--start", "2025-01-01", "--end", "2025-01-31", "--query", "Uber")
		for _, item := range listRes.JSON["transactions"].([]interface{}) {
			tx := item.(map[string]interface{})
			if tx["category"] != "Taxi" {
				t.Errorf("expected category Taxi for Uber, got %v", tx["category"])
			}
		}
	})

	t.Run("Delete rule with uncategorize", func(t *testing.T) {
		rulesRes, _ := run(db, "rules", "list")
		ruleID := rulesRes.JSON["items"].([]interface{})[0].(map[string]interface{})["id"]

		res, _ := run(db, "rules", "delete", "--id", fmt.Sprintf("%v", ruleID), "--uncategorize")
		assertGlobal(t, res, 0)
		
		// Verify uncategorized
		listRes, _ := run(db, "tx", "list", "--start", "2025-01-01", "--end", "2025-01-31", "--query", "Uber")
		for _, item := range listRes.JSON["transactions"].([]interface{}) {
			tx := item.(map[string]interface{})
			if tx["category"] != "Uncategorized" {
				t.Errorf("expected category Uncategorized for Uber after delete, got %v", tx["category"])
			}
		}
	})
}
