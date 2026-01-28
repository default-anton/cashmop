package database

import "testing"

func TestConvertTransactionAmounts(t *testing.T) {
	store := newTestStore(t)
	defer store.Close()

	settings, err := store.GetCurrencySettings()
	if err != nil {
		t.Fatalf("Failed to get currency settings: %v", err)
	}
	settings.MainCurrency = "CAD"
	_, err = store.UpdateCurrencySettings(settings)
	if err != nil {
		t.Fatalf("Failed to update currency settings: %v", err)
	}

	err = store.UpsertFxRates([]FxRate{
		{
			BaseCurrency:  "CAD",
			QuoteCurrency: "USD",
			RateDate:      "2024-01-15",
			Rate:          1.333333333333,
			Source:        "test",
		},
	})
	if err != nil {
		t.Fatalf("Failed to upsert FX rates: %v", err)
	}

	t.Run("same currency - no conversion needed", func(t *testing.T) {
		txs := []TransactionModel{{Amount: 10000, Currency: "CAD", Date: "2024-01-15"}}

		converted, err := store.convertTransactionAmounts(txs)
		if err != nil {
			t.Fatalf("convertTransactionAmounts failed: %v", err)
		}
		if len(converted) != 1 {
			t.Fatalf("Expected 1 transaction, got %d", len(converted))
		}
		if converted[0].AmountInMainCurrency == nil {
			t.Fatal("Expected AmountInMainCurrency to be set")
		}
		if *converted[0].AmountInMainCurrency != 10000 {
			t.Errorf("Expected 10000, got %d", *converted[0].AmountInMainCurrency)
		}
		if converted[0].MainCurrency != "CAD" {
			t.Errorf("Expected MainCurrency CAD, got %s", converted[0].MainCurrency)
		}
	})

	t.Run("foreign currency - proper conversion", func(t *testing.T) {
		txs := []TransactionModel{
			{Amount: 10000, Currency: "CAD", Date: "2024-01-15"},
			{Amount: 7500, Currency: "USD", Date: "2024-01-15"},
		}

		converted, err := store.convertTransactionAmounts(txs)
		if err != nil {
			t.Fatalf("convertTransactionAmounts failed: %v", err)
		}
		if len(converted) != 2 {
			t.Fatalf("Expected 2 transactions, got %d", len(converted))
		}
		if *converted[0].AmountInMainCurrency != 10000 {
			t.Errorf("CAD tx: Expected 10000, got %d", *converted[0].AmountInMainCurrency)
		}

		expected := int64(round(float64(7500) * (1.0 / 0.75)))
		if converted[1].AmountInMainCurrency == nil {
			t.Fatal("Expected AmountInMainCurrency to be set for USD transaction")
		}
		if *converted[1].AmountInMainCurrency != expected {
			t.Errorf("USD tx: Expected %d, got %d", expected, *converted[1].AmountInMainCurrency)
		}
	})

	t.Run("empty slice", func(t *testing.T) {
		converted, err := store.convertTransactionAmounts([]TransactionModel{})
		if err != nil {
			t.Fatalf("convertTransactionAmounts failed: %v", err)
		}
		if len(converted) != 0 {
			t.Fatalf("Expected 0 transactions, got %d", len(converted))
		}
	})

	t.Run("missing FX rate - graceful degradation", func(t *testing.T) {
		txs := []TransactionModel{{Amount: 5000, Currency: "EUR", Date: "2024-01-15"}}

		converted, err := store.convertTransactionAmounts(txs)
		if err != nil {
			t.Fatalf("convertTransactionAmounts should not fail on missing rates: %v", err)
		}
		if len(converted) != 1 {
			t.Fatalf("Expected 1 transaction, got %d", len(converted))
		}
		if converted[0].AmountInMainCurrency != nil {
			t.Errorf("Expected nil for missing rate, got %d", *converted[0].AmountInMainCurrency)
		}
		if converted[0].MainCurrency != "CAD" {
			t.Errorf("Expected MainCurrency CAD, got %s", converted[0].MainCurrency)
		}
	})

	t.Run("mixed - some with rates, some without", func(t *testing.T) {
		txs := []TransactionModel{
			{Amount: 10000, Currency: "CAD", Date: "2024-01-15"},
			{Amount: 7500, Currency: "USD", Date: "2024-01-15"},
			{Amount: 5000, Currency: "EUR", Date: "2024-01-15"},
			{Amount: 20000, Currency: "CAD", Date: "2024-01-15"},
		}

		converted, err := store.convertTransactionAmounts(txs)
		if err != nil {
			t.Fatalf("convertTransactionAmounts failed: %v", err)
		}
		if len(converted) != 4 {
			t.Fatalf("Expected 4 transactions, got %d", len(converted))
		}
		if *converted[0].AmountInMainCurrency != 10000 {
			t.Errorf("tx[0] CAD: Expected 10000, got %d", *converted[0].AmountInMainCurrency)
		}
		if converted[1].AmountInMainCurrency == nil {
			t.Error("tx[1] USD: Expected conversion, got nil")
		}
		if converted[2].AmountInMainCurrency != nil {
			t.Error("tx[2] EUR: Expected nil for missing rate")
		}
		if *converted[3].AmountInMainCurrency != 20000 {
			t.Errorf("tx[3] CAD: Expected 20000, got %d", *converted[3].AmountInMainCurrency)
		}
	})

	t.Run("currency case insensitive", func(t *testing.T) {
		txs := []TransactionModel{
			{Amount: 10000, Currency: "cad", Date: "2024-01-15"},
			{Amount: 10000, Currency: "Cad", Date: "2024-01-15"},
		}

		converted, err := store.convertTransactionAmounts(txs)
		if err != nil {
			t.Fatalf("convertTransactionAmounts failed: %v", err)
		}

		if *converted[0].AmountInMainCurrency != 10000 {
			t.Errorf("lowercase 'cad': Expected 10000, got %d", *converted[0].AmountInMainCurrency)
		}
		if *converted[1].AmountInMainCurrency != 10000 {
			t.Errorf("mixed case 'Cad': Expected 10000, got %d", *converted[1].AmountInMainCurrency)
		}
	})
}
