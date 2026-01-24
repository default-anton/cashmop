package database

import (
	"database/sql"
	"fmt"
	"math"
	"strconv"
	"strings"
	"sync"
)

var (
	fxRateCache   = make(map[string]*FxRateLookup)
	fxRateCacheMu sync.RWMutex
)

func ClearFxRateCache() {
	fxRateCacheMu.Lock()
	defer fxRateCacheMu.Unlock()
	fxRateCache = make(map[string]*FxRateLookup)
}

const (
	AppSettingMainCurrency = "main_currency"
	AppSettingFxLastSync   = "fx_last_sync"
)

const (
	defaultMainCurrency = "CAD"
)

func DefaultCurrency() string {
	return defaultMainCurrency
}

type CurrencySettings struct {
	MainCurrency string `json:"main_currency"`
	FxLastSync   string `json:"fx_last_sync"`
}

type FxRate struct {
	BaseCurrency  string
	QuoteCurrency string
	RateDate      string
	Rate          float64
	Source        string
}

type FxRateLookup struct {
	RateDate string  `json:"rate_date"`
	Rate     float64 `json:"rate"`
	Source   string  `json:"source"`
}

type FxDateRange struct {
	StartDate string `json:"start_date"`
	EndDate   string `json:"end_date"`
}

type FxRatePairStatus struct {
	QuoteCurrency  string `json:"quote_currency"`
	LatestRateDate string `json:"latest_rate_date"`
	MaxTxDate      string `json:"max_tx_date,omitempty"`
}

type FxRateStatus struct {
	BaseCurrency string             `json:"base_currency"`
	LastSync     string             `json:"last_sync"`
	Pairs        []FxRatePairStatus `json:"pairs"`
	MaxTxDate    string             `json:"max_tx_date,omitempty"`
}

func GetAppSetting(key string) (string, error) {
	var value string
	err := DB.QueryRow("SELECT value FROM app_settings WHERE key = ?", key).Scan(&value)
	if err == sql.ErrNoRows {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return value, nil
}

func SetAppSetting(key, value string) error {
	_, err := DB.Exec(`
		INSERT INTO app_settings (key, value)
		VALUES (?, ?)
		ON CONFLICT(key) DO UPDATE SET value=excluded.value
	`, key, value)
	return err
}

func GetCurrencySettings() (CurrencySettings, error) {
	mainCurrency, err := getOrCreateAppSetting(AppSettingMainCurrency, DefaultCurrency())
	if err != nil {
		return CurrencySettings{}, err
	}

	fxLastSync, err := getOrCreateAppSetting(AppSettingFxLastSync, "")
	if err != nil {
		return CurrencySettings{}, err
	}

	return CurrencySettings{
		MainCurrency: mainCurrency,
		FxLastSync:   fxLastSync,
	}, nil
}

func UpdateCurrencySettings(settings CurrencySettings) (CurrencySettings, error) {
	mainCurrency := strings.TrimSpace(settings.MainCurrency)
	if mainCurrency == "" {
		mainCurrency = DefaultCurrency()
	}

	if err := SetAppSetting(AppSettingMainCurrency, mainCurrency); err != nil {
		return CurrencySettings{}, err
	}
	if err := SetAppSetting(AppSettingFxLastSync, strings.TrimSpace(settings.FxLastSync)); err != nil {
		return CurrencySettings{}, err
	}

	return GetCurrencySettings()
}

func UpsertFxRates(rates []FxRate) error {
	if len(rates) == 0 {
		return nil
	}

	tx, err := DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(`
		INSERT INTO fx_rates (base_currency, quote_currency, rate_date, rate, source)
		VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(base_currency, quote_currency, rate_date, source)
		DO UPDATE SET rate=excluded.rate
	`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, rate := range rates {
		base := strings.ToUpper(strings.TrimSpace(rate.BaseCurrency))
		quote := strings.ToUpper(strings.TrimSpace(rate.QuoteCurrency))
		if base == "" || quote == "" {
			return fmt.Errorf("missing currency code for fx rate")
		}
		if rate.RateDate == "" {
			return fmt.Errorf("missing rate date for fx rate")
		}
		if rate.Source == "" {
			return fmt.Errorf("missing source for fx rate")
		}

		if _, err := stmt.Exec(base, quote, rate.RateDate, rate.Rate, rate.Source); err != nil {
			return err
		}
	}

	return tx.Commit()
}

func GetFxRate(baseCurrency, quoteCurrency, date string) (*FxRateLookup, error) {
	base := strings.ToUpper(strings.TrimSpace(baseCurrency))
	quote := strings.ToUpper(strings.TrimSpace(quoteCurrency))
	if base == "" || quote == "" {
		return nil, fmt.Errorf("missing currency code")
	}
	if date == "" {
		return nil, fmt.Errorf("missing date")
	}
	if base == quote {
		return &FxRateLookup{RateDate: date, Rate: 1, Source: ""}, nil
	}

	cacheKey := fmt.Sprintf("%s:%s:%s", base, quote, date)
	fxRateCacheMu.RLock()
	cached, ok := fxRateCache[cacheKey]
	fxRateCacheMu.RUnlock()
	if ok {
		return cached, nil
	}

	var rateDate string
	var rate float64
	var source string
	err := DB.QueryRow(`
		SELECT rate_date, rate, source
		FROM fx_rates
		WHERE base_currency = ? AND quote_currency = ? AND rate_date <= ?
		ORDER BY rate_date DESC
		LIMIT 1
	`, base, quote, date).Scan(&rateDate, &rate, &source)

	var result *FxRateLookup
	if err == sql.ErrNoRows {
		// No rate on/before transaction date. Check if date is in the future
		// by comparing with the latest available rate date.
		var latestDate string
		errLatest := DB.QueryRow(`
			SELECT rate_date
			FROM fx_rates
			WHERE base_currency = ? AND quote_currency = ?
			ORDER BY rate_date DESC
			LIMIT 1
		`, base, quote).Scan(&latestDate)
		if errLatest == sql.ErrNoRows {
			result = nil
		} else if errLatest != nil {
			return nil, errLatest
		} else if date > latestDate {
			// If transaction date is after the latest rate date (i.e., in the future),
			// use the latest available rate (for scheduled/recurring imports).
			var err error
			result, err = GetFxRate(base, quote, latestDate)
			if err != nil {
				return nil, err
			}
		} else {
			result = nil
		}
	} else if err != nil {
		return nil, err
	} else {
		result = &FxRateLookup{RateDate: rateDate, Rate: rate, Source: source}
	}

	fxRateCacheMu.Lock()
	fxRateCache[cacheKey] = result
	fxRateCacheMu.Unlock()

	return result, nil
}

func ConvertAmount(amount int64, baseCurrency, quoteCurrency, date string) (*int64, error) {
	rate, err := GetFxRate(baseCurrency, quoteCurrency, date)
	if err != nil {
		return nil, err
	}
	if rate == nil {
		return nil, nil
	}
	converted := int64(round(float64(amount) * rate.Rate))
	return &converted, nil
}

func round(value float64) float64 {
	return math.Floor(value + 0.5)
}

func GetTransactionCurrencyRanges(baseCurrency string) (map[string]FxDateRange, error) {
	base := strings.ToUpper(strings.TrimSpace(baseCurrency))
	rows, err := DB.Query(`
		SELECT currency, MIN(date), MAX(date)
		FROM transactions
		WHERE currency IS NOT NULL AND currency != ?
		GROUP BY currency
	`, base)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ranges := make(map[string]FxDateRange)
	for rows.Next() {
		var currency string
		var minDate string
		var maxDate string
		if err := rows.Scan(&currency, &minDate, &maxDate); err != nil {
			return nil, err
		}
		code := strings.ToUpper(strings.TrimSpace(currency))
		if code == "" {
			continue
		}
		ranges[code] = FxDateRange{StartDate: minDate, EndDate: maxDate}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return ranges, nil
}

func GetFxRateRanges(baseCurrency string, quoteCurrencies []string) (map[string]FxDateRange, error) {
	base := strings.ToUpper(strings.TrimSpace(baseCurrency))
	if len(quoteCurrencies) == 0 {
		return map[string]FxDateRange{}, nil
	}

	placeholders := make([]string, 0, len(quoteCurrencies))
	args := make([]any, 0, len(quoteCurrencies)+1)
	args = append(args, base)
	for _, quote := range quoteCurrencies {
		code := strings.ToUpper(strings.TrimSpace(quote))
		if code == "" {
			continue
		}
		placeholders = append(placeholders, "?")
		args = append(args, code)
	}
	if len(placeholders) == 0 {
		return map[string]FxDateRange{}, nil
	}

	query := fmt.Sprintf(`
		SELECT quote_currency, MIN(rate_date), MAX(rate_date)
		FROM fx_rates
		WHERE base_currency = ? AND quote_currency IN (%s)
		GROUP BY quote_currency
	`, strings.Join(placeholders, ","))
	rows, err := DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ranges := make(map[string]FxDateRange)
	for rows.Next() {
		var quote string
		var minDate string
		var maxDate string
		if err := rows.Scan(&quote, &minDate, &maxDate); err != nil {
			return nil, err
		}
		code := strings.ToUpper(strings.TrimSpace(quote))
		if code == "" {
			continue
		}
		ranges[code] = FxDateRange{StartDate: minDate, EndDate: maxDate}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return ranges, nil
}

func GetFxRateStatus(baseCurrency string) (FxRateStatus, error) {
	base := strings.ToUpper(strings.TrimSpace(baseCurrency))
	if base == "" {
		base = DefaultCurrency()
	}

	lastSync, err := GetAppSetting(AppSettingFxLastSync)
	if err != nil {
		return FxRateStatus{}, err
	}

	txRanges, err := GetTransactionCurrencyRanges(base)
	if err != nil {
		return FxRateStatus{}, err
	}

	rows, err := DB.Query(`
		SELECT quote_currency, MAX(rate_date)
		FROM fx_rates
		WHERE base_currency = ?
		GROUP BY quote_currency
		ORDER BY quote_currency ASC
	`, base)
	if err != nil {
		return FxRateStatus{}, err
	}
	defer rows.Close()

	var pairs []FxRatePairStatus
	var overallMaxTxDate string
	for rows.Next() {
		var quote string
		var latest string
		if err := rows.Scan(&quote, &latest); err != nil {
			return FxRateStatus{}, err
		}
		txRange := txRanges[quote]
		if txRange.EndDate > overallMaxTxDate {
			overallMaxTxDate = txRange.EndDate
		}
		pairs = append(pairs, FxRatePairStatus{
			QuoteCurrency:  strings.ToUpper(strings.TrimSpace(quote)),
			LatestRateDate: latest,
			MaxTxDate:      txRange.EndDate,
		})
	}
	if err := rows.Err(); err != nil {
		return FxRateStatus{}, err
	}

	return FxRateStatus{
		BaseCurrency: base,
		LastSync:     lastSync,
		Pairs:        pairs,
		MaxTxDate:    overallMaxTxDate,
	}, nil
}

func getOrCreateAppSetting(key, defaultValue string) (string, error) {
	var value string
	err := DB.QueryRow("SELECT value FROM app_settings WHERE key = ?", key).Scan(&value)
	if err == sql.ErrNoRows {
		if err := SetAppSetting(key, defaultValue); err != nil {
			return "", err
		}
		return defaultValue, nil
	}
	if err != nil {
		return "", err
	}
	return value, nil
}

func parseBoolSetting(value string, fallback bool) bool {
	parsed, err := strconv.ParseBool(strings.TrimSpace(value))
	if err != nil {
		return fallback
	}
	return parsed
}
