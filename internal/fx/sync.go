package fx

import (
	"cashflow/internal/database"
	"context"
	"fmt"
	"sort"
	"strings"
	"time"
)

type SyncResult struct {
	BaseCurrency string   `json:"base_currency"`
	Updated      int      `json:"updated"`
	Unsupported  []string `json:"unsupported"`
}

type dateRange struct {
	start string
	end   string
}

func SyncRates(ctx context.Context, baseCurrency string) (SyncResult, error) {
	base := strings.ToUpper(strings.TrimSpace(baseCurrency))
	provider, err := ProviderForBase(base)
	if err != nil {
		return SyncResult{}, err
	}

	txRanges, err := database.GetTransactionCurrencyRanges(base)
	if err != nil {
		return SyncResult{}, err
	}
	if len(txRanges) == 0 {
		return SyncResult{BaseCurrency: base}, nil
	}

	quotes := make([]string, 0, len(txRanges))
	for quote := range txRanges {
		quotes = append(quotes, quote)
	}

	// Add 7-day buffer before each transaction range
	for quote, txRange := range txRanges {
		if txRange.StartDate != "" {
			bufferedStart := subtractDays(txRange.StartDate, 7)
			txRanges[quote] = database.FxDateRange{
				StartDate: bufferedStart,
				EndDate:   txRange.EndDate,
			}
		}
	}

	existingRanges, err := database.GetFxRateRanges(base, quotes)
	if err != nil {
		return SyncResult{}, err
	}

	var allRates []database.FxRate
	unsupported := make([]string, 0)

	for quote, txRange := range txRanges {
		missing := missingRanges(txRange, existingRanges[quote])
		for _, r := range missing {
			result, err := provider.FetchRates(ctx, []string{quote}, r.start, r.end)
			if err != nil {
				return SyncResult{}, err
			}
			if len(result.Unsupported) > 0 {
				unsupported = append(unsupported, result.Unsupported...)
				continue
			}
			for date, byQuote := range result.Rates {
				for q, rate := range byQuote {
					allRates = append(allRates, database.FxRate{
						BaseCurrency:  base,
						QuoteCurrency: q,
						RateDate:      date,
						Rate:          rate,
						Source:        provider.Source(),
					})
				}
			}
		}
	}

	if len(allRates) > 0 {
		if err := database.UpsertFxRates(allRates); err != nil {
			return SyncResult{}, err
		}
	}

	lastSync := time.Now().Format("2006-01-02")
	if err := database.SetAppSetting(database.AppSettingFxLastSync, lastSync); err != nil {
		return SyncResult{}, err
	}

	unsupported = uniqueSorted(unsupported)

	return SyncResult{
		BaseCurrency: base,
		Updated:      len(allRates),
		Unsupported:  unsupported,
	}, nil
}

func missingRanges(txRange database.FxDateRange, existing database.FxDateRange) []dateRange {
	if txRange.StartDate == "" || txRange.EndDate == "" {
		return nil
	}

	if existing.StartDate == "" || existing.EndDate == "" {
		return []dateRange{{start: txRange.StartDate, end: txRange.EndDate}}
	}

	var ranges []dateRange
	if txRange.StartDate < existing.StartDate {
		ranges = append(ranges, dateRange{start: txRange.StartDate, end: existing.StartDate})
	}
	if txRange.EndDate > existing.EndDate {
		ranges = append(ranges, dateRange{start: existing.EndDate, end: txRange.EndDate})
	}

	return ranges
}

func uniqueSorted(values []string) []string {
	if len(values) == 0 {
		return nil
	}
	seen := make(map[string]struct{}, len(values))
	for _, v := range values {
		if v == "" {
			continue
		}
		seen[strings.ToUpper(v)] = struct{}{}
	}
	res := make([]string, 0, len(seen))
	for v := range seen {
		res = append(res, v)
	}
	sort.Strings(res)
	return res
}

func EnsureProviderSupported(baseCurrency string) error {
	_, err := ProviderForBase(baseCurrency)
	if err != nil {
		return fmt.Errorf("%w", err)
	}
	return nil
}

func subtractDays(dateStr string, days int) string {
	date, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return dateStr
	}
	return date.AddDate(0, 0, -days).Format("2006-01-02")
}
