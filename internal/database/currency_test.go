package database

import (
	"testing"
)

func TestGetFxRateExactAndPrevious(t *testing.T) {
	setupTestDB(t)
	defer teardownTestDB(t)

	err := UpsertFxRates([]FxRate{
		{BaseCurrency: "CAD", QuoteCurrency: "USD", RateDate: "2024-01-02", Rate: 1.2, Source: "boc"},
		{BaseCurrency: "CAD", QuoteCurrency: "USD", RateDate: "2024-01-05", Rate: 1.25, Source: "boc"},
	})
	if err != nil {
		t.Fatalf("UpsertFxRates failed: %v", err)
	}

	exact, err := GetFxRate("CAD", "USD", "2024-01-05")
	if err != nil {
		t.Fatalf("GetFxRate exact failed: %v", err)
	}
	if exact == nil || exact.Rate != 1.25 || exact.RateDate != "2024-01-05" {
		t.Fatalf("Expected exact rate 1.25 on 2024-01-05, got %+v", exact)
	}

	previous, err := GetFxRate("CAD", "USD", "2024-01-06")
	if err != nil {
		t.Fatalf("GetFxRate previous failed: %v", err)
	}
	if previous == nil || previous.Rate != 1.25 || previous.RateDate != "2024-01-05" {
		t.Fatalf("Expected previous rate 1.25 on 2024-01-05, got %+v", previous)
	}

	missing, err := GetFxRate("CAD", "USD", "2024-01-01")
	if err != nil {
		t.Fatalf("GetFxRate missing failed: %v", err)
	}
	if missing != nil {
		t.Fatalf("Expected nil for missing rate, got %+v", missing)
	}
}

func TestGetFxRateSameCurrency(t *testing.T) {
	setupTestDB(t)
	defer teardownTestDB(t)

	got, err := GetFxRate("CAD", "CAD", "2024-02-01")
	if err != nil {
		t.Fatalf("GetFxRate same currency failed: %v", err)
	}
	if got == nil || got.Rate != 1 || got.RateDate != "2024-02-01" {
		t.Fatalf("Expected rate 1 on 2024-02-01, got %+v", got)
	}
}

func TestCurrencySettingsDefaultsAndUpdate(t *testing.T) {
	setupTestDB(t)
	defer teardownTestDB(t)

	settings, err := GetCurrencySettings()
	if err != nil {
		t.Fatalf("GetCurrencySettings failed: %v", err)
	}
	if settings.MainCurrency != DefaultCurrency() {
		t.Fatalf("Expected default main currency %s, got %q", DefaultCurrency(), settings.MainCurrency)
	}

	updated, err := UpdateCurrencySettings(CurrencySettings{
		MainCurrency: "USD",
		FxLastSync:   "2024-01-10",
	})
	if err != nil {
		t.Fatalf("UpdateCurrencySettings failed: %v", err)
	}
	if updated.MainCurrency != "USD" || updated.FxLastSync != "2024-01-10" {
		t.Fatalf("Unexpected updated settings: %+v", updated)
	}

	reset, err := UpdateCurrencySettings(CurrencySettings{
		MainCurrency: "",
		FxLastSync:   "2024-02-01",
	})
	if err != nil {
		t.Fatalf("UpdateCurrencySettings reset failed: %v", err)
	}
	if reset.MainCurrency != DefaultCurrency() || reset.FxLastSync != "2024-02-01" {
		t.Fatalf("Unexpected reset settings: %+v", reset)
	}
}

func TestGetFxRateStatusWithTransactionRanges(t *testing.T) {
	setupTestDB(t)
	defer teardownTestDB(t)

	// Insert some FX rates
	err := UpsertFxRates([]FxRate{
		{BaseCurrency: "CAD", QuoteCurrency: "USD", RateDate: "2024-11-30", Rate: 1.25, Source: "boc"},
		{BaseCurrency: "CAD", QuoteCurrency: "EUR", RateDate: "2024-11-30", Rate: 0.68, Source: "boc"},
	})
	if err != nil {
		t.Fatalf("UpsertFxRates failed: %v", err)
	}

	// Insert transactions with different currencies
	_, err = DB.Exec(`
		INSERT INTO transactions (date, amount, description, currency, account_id)
		VALUES
			('2024-11-15', 10000, 'Transaction 1', 'USD', 1),
			('2024-11-25', 20000, 'Transaction 2', 'USD', 1),
			('2024-11-20', 5000, 'Transaction 3', 'EUR', 1)
	`)
	if err != nil {
		t.Fatalf("Insert transactions failed: %v", err)
	}

	status, err := GetFxRateStatus("CAD")
	if err != nil {
		t.Fatalf("GetFxRateStatus failed: %v", err)
	}

	if status.BaseCurrency != "CAD" {
		t.Fatalf("Expected base currency CAD, got %q", status.BaseCurrency)
	}

	// Check that MaxTxDate is populated correctly
	if status.MaxTxDate != "2024-11-25" {
		t.Fatalf("Expected MaxTxDate 2024-11-25, got %q", status.MaxTxDate)
	}

	// Check individual pairs
	pairMap := make(map[string]FxRatePairStatus)
	for _, pair := range status.Pairs {
		pairMap[pair.QuoteCurrency] = pair
	}

	usdPair, ok := pairMap["USD"]
	if !ok {
		t.Fatal("USD pair not found in status")
	}
	if usdPair.LatestRateDate != "2024-11-30" {
		t.Fatalf("Expected USD latest rate date 2024-11-30, got %q", usdPair.LatestRateDate)
	}
	if usdPair.MaxTxDate != "2024-11-25" {
		t.Fatalf("Expected USD max tx date 2024-11-25, got %q", usdPair.MaxTxDate)
	}

	eurPair, ok := pairMap["EUR"]
	if !ok {
		t.Fatal("EUR pair not found in status")
	}
	if eurPair.LatestRateDate != "2024-11-30" {
		t.Fatalf("Expected EUR latest rate date 2024-11-30, got %q", eurPair.LatestRateDate)
	}
	if eurPair.MaxTxDate != "2024-11-20" {
		t.Fatalf("Expected EUR max tx date 2024-11-20, got %q", eurPair.MaxTxDate)
	}
}
