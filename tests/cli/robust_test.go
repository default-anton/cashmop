package cli_test

import (
	"os"
	"path/filepath"
	"testing"
)

func TestRobustImport(t *testing.T) {
	db := setupDB(t)

	// Mapping with comma decimal and Date(...)
	mappingJSON := `{
		"csv": {
			"date": "Date",
			"description": ["Desc"],
			"amountMapping": {
				"type": "single",
				"column": "Amount"
			}
		},
		"account": "TestAccount",
		"currencyDefault": "EUR"
	}`
	mappingPath := filepath.Join(t.TempDir(), "robust_mapping.json")
	os.WriteFile(mappingPath, []byte(mappingJSON), 0644)

	// CSV with comma decimal and Date ticks
	csvData := `Date,Desc,Amount
Date(1736553600000),Item 1,"-12,34"
Date(1736640000000),Item 2,"45,67"
`
	// 1736553600000 is 2025-01-11
	// 1736640000000 is 2025-01-12

	csvPath := filepath.Join(t.TempDir(), "robust_data.csv")
	os.WriteFile(csvPath, []byte(csvData), 0644)

	res, err := run(db, "import", "--file", csvPath, "--mapping", mappingPath)
	if err != nil {
		t.Fatal(err)
	}
	assertGlobal(t, res, 0)

	if res.JSON["imported_count"].(float64) != 2 {
		t.Errorf("expected 2 imported, got %v", res.JSON["imported_count"])
	}

	// Verify dates and amounts
	res, err = run(db, "tx", "list", "--start", "2025-01-01", "--end", "2025-01-31")
	if err != nil {
		t.Fatal(err)
	}
	assertGlobal(t, res, 0)
	txs := res.JSON["transactions"].([]interface{})
	if len(txs) != 2 {
		t.Fatalf("expected 2 transactions, got %d", len(txs))
	}

	// Sort by date manually if needed, but they should be in order
	tx1 := txs[1].(map[string]interface{}) // 2025-01-11 (desc order by default)
	tx2 := txs[0].(map[string]interface{}) // 2025-01-12

	if tx1["date"] != "2025-01-11" {
		t.Errorf("expected 2025-01-11, got %v", tx1["date"])
	}
	if tx1["amount"] != "-12.34" {
		t.Errorf("expected -12.34, got %v", tx1["amount"])
	}

	if tx2["date"] != "2025-01-12" {
		t.Errorf("expected 2025-01-12, got %v", tx2["date"])
	}
	if tx2["amount"] != "45.67" {
		t.Errorf("expected 45.67, got %v", tx2["amount"])
	}
}

func TestRounding(t *testing.T) {
	db := setupDB(t)

	mappingJSON := `{
		"csv": {
			"date": "Date",
			"description": ["Desc"],
			"amountMapping": { "type": "single", "column": "Amount" }
		},
		"account": "Test",
		"currencyDefault": "CAD"
	}`
	mappingPath := filepath.Join(t.TempDir(), "round_mapping.json")
	os.WriteFile(mappingPath, []byte(mappingJSON), 0644)

	// Test half-up rounding (0.005 -> 0.01)
	// We use 0.0051 to avoid float precision issues with 0.005 (which is slightly less in binary)
	csvData := `Date,Desc,Amount
2025-01-01,HalfUp,1.0051
2025-01-01,HalfDown,-1.0051
`
	// math.Floor(1.0051 * 100 + 0.5) = Floor(100.51 + 0.5) = Floor(101.01) = 101 (1.01)
	// math.Floor(-1.0051 * 100 + 0.5) = Floor(-100.51 + 0.5) = Floor(-100.01) = -101 (-1.01)
	// wait, Floor(-100.01) is -101.
	
	csvPath := filepath.Join(t.TempDir(), "round_data.csv")
	os.WriteFile(csvPath, []byte(csvData), 0644)

	run(db, "import", "--file", csvPath, "--mapping", mappingPath)

	res, _ := run(db, "tx", "list", "--start", "2025-01-01", "--end", "2025-01-01", "--sort", "amount", "--order", "asc")
	txs := res.JSON["transactions"].([]interface{})
	
	if txs[0].(map[string]interface{})["amount"] != "-1.01" {
		t.Errorf("expected -1.01 for -1.0051, got %v", txs[0].(map[string]interface{})["amount"])
	}
	if txs[1].(map[string]interface{})["amount"] != "1.01" {
		t.Errorf("expected 1.01 for 1.0051, got %v", txs[1].(map[string]interface{})["amount"])
	}
}
