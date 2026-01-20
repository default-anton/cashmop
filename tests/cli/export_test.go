package cli_test

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"
)

func TestExportDetailed(t *testing.T) {
	db := setupDB(t)

	// Seed data
	mappingJSON := `{"csv":{"date":"Date","description":["Description"],"amountMapping":{"type":"single","column":"Amount"},"account":"Account","owner":"Owner"},"account":"BMO","currencyDefault":"CAD"}`
	mappingPath := filepath.Join(t.TempDir(), "mapping.json")
	os.WriteFile(mappingPath, []byte(mappingJSON), 0644)

	csvData := `Date,Description,Amount,Account,Owner
2025-01-10,Food,-10.00,BMO,Alex
2025-01-12,Gas,-50.00,BMO,Alex
2025-01-15,Rent,-1000.00,BMO,Alex
`
	csvPath := filepath.Join(t.TempDir(), "data.csv")
	os.WriteFile(csvPath, []byte(csvData), 0644)
	run(db, "import", "--file", csvPath, "--mapping", mappingPath)

	// Categorize
	run(db, "tx", "categorize", "--id", "1", "--category", "Food")
	run(db, "tx", "categorize", "--id", "2", "--category", "Auto")

	t.Run("Export all", func(t *testing.T) {
		outPath := filepath.Join(t.TempDir(), "all.csv")
		res, _ := run(db, "export", "--start", "2025-01-01", "--end", "2025-01-31", "--format", "csv", "--out", outPath)
		assertGlobal(t, res, 0)
		if res.JSON["count"].(float64) != 3 {
			t.Errorf("expected 3 in export, got %v", res.JSON["count"])
		}
	})

	t.Run("Export by category", func(t *testing.T) {
		// Get Food ID
		catRes, _ := run(db, "categories", "list")
		foodID := ""
		for _, item := range catRes.JSON["items"].([]interface{}) {
			c := item.(map[string]interface{})
			if c["name"] == "Food" {
				foodID = fmt.Sprintf("%v", c["id"])
			}
		}

		outPath := filepath.Join(t.TempDir(), "food.csv")
		res, _ := run(db, "export", "--start", "2025-01-01", "--end", "2025-01-31", "--format", "csv", "--out", outPath, "--category-ids", foodID)
		assertGlobal(t, res, 0)
		if res.JSON["count"].(float64) != 1 {
			t.Errorf("expected 1 in food export, got %v", res.JSON["count"])
		}
	})

	t.Run("Duplicate import", func(t *testing.T) {
		res, _ := run(db, "import", "--file", csvPath, "--mapping", mappingPath, "--month", "2025-01")
		assertGlobal(t, res, 0)
		if res.JSON["imported_count"].(float64) != 0 {
			t.Errorf("expected 0 imported on second run, got %v", res.JSON["imported_count"])
		}
		if res.JSON["skipped_count"].(float64) != 3 {
			t.Errorf("expected 3 skipped on second run, got %v", res.JSON["skipped_count"])
		}
	})
}
