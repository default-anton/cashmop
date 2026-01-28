package main

import (
	"fmt"
	"log"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/default-anton/cashmop/internal/database"

	"gopkg.in/yaml.v3"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: test-helper <command>")
		os.Exit(1)
	}

	command := os.Args[1]
	switch command {
	case "reset":
		if err := resetDB(); err != nil {
			log.Fatal(err)
		}
		fmt.Println("Database reset and seeded successfully.")
	default:
		fmt.Printf("Unknown command: %s\n", command)
		os.Exit(1)
	}
}

func resetDB() error {
	workerID := os.Getenv("CASHMOP_WORKER_ID")
	if workerID == "" {
		workerID = "0"
	}
	os.Setenv("APP_ENV", "test")
	os.Setenv("CASHMOP_WORKER_ID", workerID)

	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))

	return withBusyRetry(func() error {
		store, err := database.Open("", logger)
		if err != nil {
			return err
		}

		// Dynamically find all tables to drop.
		db := store.DB()
		rows, err := db.Query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
		if err != nil {
			_ = store.Close()
			return fmt.Errorf("failed to fetch tables: %w", err)
		}
		defer rows.Close()

		var tables []string
		for rows.Next() {
			var name string
			if err := rows.Scan(&name); err != nil {
				_ = store.Close()
				return err
			}
			tables = append(tables, name)
		}

		// Disable foreign keys temporarily to drop everything without order issues.
		if _, err := db.Exec("PRAGMA foreign_keys = OFF"); err != nil {
			_ = store.Close()
			return err
		}

		for _, table := range tables {
			if _, err := db.Exec(fmt.Sprintf("DROP TABLE IF EXISTS %s", table)); err != nil {
				_ = store.Close()
				return fmt.Errorf("failed to drop table %s: %w", table, err)
			}
		}

		_ = store.Close()

		store, err = database.Open("", logger)
		if err != nil {
			return err
		}
		defer store.Close()

		return loadFixtures(store)
	})
}

func loadFixtures(store *database.Store) error {
	fixtureDir := "frontend/tests/fixtures"

	// Order matters for foreign keys.
	tables := []string{
		"users",
		"categories",
		"accounts",
		"column_mappings",
		"categorization_rules",
		"app_settings",
		"fx_rates",
		"transactions",
	}

	for _, table := range tables {
		path := filepath.Join(fixtureDir, table+".yml")
		if _, err := os.Stat(path); os.IsNotExist(err) {
			continue
		}

		data, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("failed to read fixture %s: %w", path, err)
		}

		var fixtures map[string]map[string]interface{}
		if err := yaml.Unmarshal(data, &fixtures); err != nil {
			return fmt.Errorf("failed to unmarshal fixture %s: %w", path, err)
		}

		for _, attrs := range fixtures {
			if err := withBusyRetry(func() error {
				return insertFixture(store, table, attrs)
			}); err != nil {
				return fmt.Errorf("failed to insert fixture into %s: %w", table, err)
			}
		}
	}

	return nil
}

func withBusyRetry(fn func() error) error {
	backoff := 100 * time.Millisecond
	var lastErr error
	for i := 0; i < 8; i++ {
		if err := fn(); err != nil {
			lastErr = err
			if !isBusyError(err) {
				return err
			}
			time.Sleep(backoff)
			if backoff < 2*time.Second {
				backoff *= 2
			}
			continue
		}
		return nil
	}
	return lastErr
}

func isBusyError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "database is locked") || strings.Contains(msg, "sqlite_busy")
}

func insertFixture(store *database.Store, table string, attrs map[string]interface{}) error {
	switch table {
	case "users":
		_, err := store.GetOrCreateUser(attrs["name"].(string))
		return err
	case "categories":
		_, err := store.GetOrCreateCategory(attrs["name"].(string))
		return err
	case "accounts":
		_, err := store.GetOrCreateAccount(attrs["name"].(string))
		return err
	case "column_mappings":
		_, err := store.SaveColumnMapping(attrs["name"].(string), attrs["mapping_json"].(string))
		return err
	case "categorization_rules":
		catID, err := store.GetOrCreateCategory(attrs["category"].(string))
		if err != nil {
			return err
		}
		rule := database.CategorizationRule{
			MatchType:  attrs["match_type"].(string),
			MatchValue: attrs["match_value"].(string),
			CategoryID: catID,
		}
		if v, ok := attrs["amount_min"].(float64); ok {
			centVal := int64(v * 100)
			rule.AmountMin = &centVal
		}
		if v, ok := attrs["amount_max"].(float64); ok {
			centVal := int64(v * 100)
			rule.AmountMax = &centVal
		}
		_, err = store.SaveRule(rule)
		return err
	case "transactions":
		accID, err := store.GetOrCreateAccount(attrs["account"].(string))
		if err != nil {
			return err
		}
		var ownerID *int64
		if attrs["owner"] != nil {
			ownerID, err = store.GetOrCreateUser(attrs["owner"].(string))
			if err != nil {
				return err
			}
		}
		var catID *int64
		if attrs["category"] != nil {
			id, err := store.GetOrCreateCategory(attrs["category"].(string))
			if err != nil {
				return err
			}
			catID = &id
		}

		tx := database.TransactionModel{
			AccountID:   accID,
			OwnerID:     ownerID,
			Date:        attrs["date"].(string),
			Description: attrs["description"].(string),
			Amount:      int64(getFloat(attrs["amount"]) * 100),
			CategoryID:  catID,
			Currency:    getStringWithDefault(attrs["currency"], "CAD"),
		}
		return store.BatchInsertTransactions([]database.TransactionModel{tx})
	case "app_settings":
		key := attrs["key"].(string)
		value := attrs["value"].(string)
		return store.SetAppSetting(key, value)
	case "fx_rates":
		rate := database.FxRate{
			BaseCurrency:  attrs["base_currency"].(string),
			QuoteCurrency: attrs["quote_currency"].(string),
			RateDate:      attrs["rate_date"].(string),
			Rate:          getFloat(attrs["rate"]),
			Source:        attrs["source"].(string),
		}
		return store.UpsertFxRates([]database.FxRate{rate})
	}
	return nil
}

func getFloat(v interface{}) float64 {
	switch i := v.(type) {
	case float64:
		return i
	case int:
		return float64(i)
	default:
		return 0
	}
}

func getStringWithDefault(v interface{}, fallback string) string {
	if v == nil {
		return fallback
	}
	if s, ok := v.(string); ok && s != "" {
		return s
	}
	return fallback
}
