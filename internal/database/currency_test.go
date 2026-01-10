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
	if settings.MainCurrency != "CAD" {
		t.Fatalf("Expected default main currency CAD, got %q", settings.MainCurrency)
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
}
