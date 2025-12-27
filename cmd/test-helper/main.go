package main

import (
	"cashflow/internal/database"
	"fmt"
	"log"
	"os"
	"path/filepath"

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
	// Don't remove the file, just re-init it to avoid inode issues with running app
	os.Setenv("APP_ENV", "test")
	database.InitDB()

	// Wipe all tables
	tables := []string{
		"transactions",
		"categorization_rules",
		"column_mappings",
		"accounts",
		"categories",
		"users",
		"categories_fts",
	}
	for _, table := range tables {
		_, _ = database.DB.Exec(fmt.Sprintf("DROP TABLE IF EXISTS %s", table))
	}
	// Re-run schema
	if _, err := database.DB.Exec(database.SchemaSQL); err != nil {
		return fmt.Errorf("failed to re-run schema: %w", err)
	}

	return loadFixtures()
}

func loadFixtures() error {
	fixtureDir := "frontend/tests/fixtures"

	// Order matters for foreign keys
	tables := []string{
		"users",
		"categories",
		"accounts",
		"column_mappings",
		"categorization_rules",
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
			if err := insertFixture(table, attrs); err != nil {
				return fmt.Errorf("failed to insert fixture into %s: %w", table, err)
			}
		}
	}

	return nil
}

func insertFixture(table string, attrs map[string]interface{}) error {
	switch table {
	case "users":
		_, err := database.GetOrCreateUser(attrs["name"].(string))
		return err
	case "categories":
		_, err := database.GetOrCreateCategory(attrs["name"].(string))
		return err
	case "accounts":
		// Accounts might have type and currency in the future, for now just name
		_, err := database.GetOrCreateAccount(attrs["name"].(string))
		// If we had more fields:
		if err == nil && attrs["type"] != nil {
			_, err = database.DB.Exec("UPDATE accounts SET type = ? WHERE name = ?", attrs["type"], attrs["name"])
		}
		return err
	case "column_mappings":
		_, err := database.SaveColumnMapping(attrs["name"].(string), attrs["mapping_json"].(string))
		return err
	case "categorization_rules":
		catID, err := database.GetOrCreateCategory(attrs["category"].(string))
		if err != nil {
			return err
		}
		rule := database.CategorizationRule{
			MatchType:  attrs["match_type"].(string),
			MatchValue: attrs["match_value"].(string),
			CategoryID: catID,
		}
		if v, ok := attrs["amount_min"].(float64); ok {
			rule.AmountMin = &v
		}
		if v, ok := attrs["amount_max"].(float64); ok {
			rule.AmountMax = &v
		}
		_, err = database.SaveRule(rule)
		return err
	case "transactions":
		accID, err := database.GetOrCreateAccount(attrs["account"].(string))
		if err != nil {
			return err
		}
		var ownerID *int64
		if attrs["owner"] != nil {
			ownerID, err = database.GetOrCreateUser(attrs["owner"].(string))
			if err != nil {
				return err
			}
		}
		var catID *int64
		if attrs["category"] != nil {
			id, err := database.GetOrCreateCategory(attrs["category"].(string))
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
			Amount:      getFloat(attrs["amount"]),
			CategoryID:  catID,
			Currency:    "CAD",
		}
		return database.BatchInsertTransactions([]database.TransactionModel{tx})
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
