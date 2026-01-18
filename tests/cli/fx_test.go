package cli_test

import (
	"cashmop/internal/database"
	"testing"
)

func TestFxDetailed(t *testing.T) {
	db := setupDB(t)

	t.Run("Status", func(t *testing.T) {
		res, _ := run(db, "fx", "status")
		assertGlobal(t, res, 0)
		if res.JSON["base_currency"] != database.DefaultCurrency() {
			t.Errorf("expected default base currency %s, got %v", database.DefaultCurrency(), res.JSON["base_currency"])
		}
	})

	t.Run("Sync no transactions", func(t *testing.T) {
		res, _ := run(db, "fx", "sync")
		assertGlobal(t, res, 0)
	})

	t.Run("Rate for same currency", func(t *testing.T) {
		res, _ := run(db, "fx", "rate", "--base", "CAD", "--quote", "CAD", "--date", "2025-01-01")
		assertGlobal(t, res, 0)
		if res.JSON["rate"].(float64) != 1.0 {
			t.Errorf("expected rate 1.0 for same currency, got %v", res.JSON["rate"])
		}
	})
}
