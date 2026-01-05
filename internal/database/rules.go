package database

import (
	"cashflow/internal/fuzzy"
	"strings"
	"sync"
)

type Category struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

type CategorizationRule struct {
	ID           int64    `json:"id"`
	MatchType    string   `json:"match_type"`
	MatchValue   string   `json:"match_value"`
	CategoryID   int64    `json:"category_id"`
	CategoryName string   `json:"category_name"`
	AmountMin    *float64 `json:"amount_min"`
	AmountMax    *float64 `json:"amount_max"`
}

var (
	categoryCacheMu sync.RWMutex
	categoryCache   []Category
)

func invalidateCategoryCache() {
	categoryCacheMu.Lock()
	categoryCache = nil
	categoryCacheMu.Unlock()
}

func loadCategories() ([]Category, error) {
	categoryCacheMu.RLock()
	cached := categoryCache
	categoryCacheMu.RUnlock()
	if cached != nil {
		return cached, nil
	}

	categoryCacheMu.Lock()
	defer categoryCacheMu.Unlock()
	if categoryCache != nil {
		return categoryCache, nil
	}

	rows, err := DB.Query("SELECT id, name FROM categories ORDER BY name ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var categories []Category
	for rows.Next() {
		var c Category
		if err := rows.Scan(&c.ID, &c.Name); err != nil {
			return nil, err
		}
		categories = append(categories, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	categoryCache = categories
	return categories, nil
}

func cloneCategories(items []Category) []Category {
	res := make([]Category, len(items))
	copy(res, items)
	return res
}

func GetOrCreateCategory(name string) (int64, error) {
	var id int64
	err := DB.QueryRow("SELECT id FROM categories WHERE name = ?", name).Scan(&id)
	if err == nil {
		return id, nil
	}
	res, err := DB.Exec("INSERT INTO categories (name) VALUES (?)", name)
	if err != nil {
		return 0, err
	}
	insertedID, err := res.LastInsertId()
	if err != nil {
		return 0, err
	}
	invalidateCategoryCache()
	return insertedID, nil
}

func RenameCategory(id int64, newName string) error {
	var oldName string
	err := DB.QueryRow("SELECT name FROM categories WHERE id = ?", id).Scan(&oldName)
	if err != nil {
		return err
	}

	tx, err := DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.Exec("UPDATE categories SET name = ? WHERE id = ?", newName, id)
	if err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	invalidateCategoryCache()
	return nil
}

func SaveRule(rule CategorizationRule) (int64, error) {
	res, err := DB.Exec(`
        INSERT INTO categorization_rules (match_type, match_value, category_id, amount_min, amount_max)
        VALUES (?, ?, ?, ?, ?)
    `, rule.MatchType, rule.MatchValue, rule.CategoryID, rule.AmountMin, rule.AmountMax)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func GetRules() ([]CategorizationRule, error) {
	rows, err := DB.Query(`
        SELECT id, match_type, match_value, category_id, amount_min, amount_max 
        FROM categorization_rules
        ORDER BY 
            -- Priority by amount specificity
            CASE 
                WHEN amount_min IS NOT NULL AND amount_max IS NOT NULL THEN 1
                WHEN amount_min IS NOT NULL AND amount_max IS NULL THEN 2
                WHEN amount_min IS NULL AND amount_max IS NOT NULL THEN 3
                ELSE 4
            END ASC,
            -- Priority by match type specificity
            CASE 
                WHEN match_type = 'exact' THEN 1
                WHEN match_type = 'starts_with' THEN 2
                WHEN match_type = 'ends_with' THEN 2
                WHEN match_type = 'contains' THEN 3
                ELSE 4
            END ASC,
            id ASC -- Fallback to oldest rules first
    `)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []CategorizationRule
	for rows.Next() {
		var r CategorizationRule
		if err := rows.Scan(&r.ID, &r.MatchType, &r.MatchValue, &r.CategoryID, &r.AmountMin, &r.AmountMax); err != nil {
			return nil, err
		}
		rules = append(rules, r)
	}
	return rules, nil
}

func GetRulesCount() (int, error) {
	var count int
	err := DB.QueryRow("SELECT COUNT(*) FROM categorization_rules").Scan(&count)
	return count, err
}

func ApplyRule(ruleID int64) (int64, error) {
	_, affectedIds, err := ApplyRuleWithIds(ruleID)
	if err != nil {
		return 0, err
	}
	return int64(len(affectedIds)), nil
}

func ApplyRuleWithIds(ruleID int64) (int64, []int64, error) {
	var r CategorizationRule
	err := DB.QueryRow("SELECT match_type, match_value, category_id, amount_min, amount_max FROM categorization_rules WHERE id = ?", ruleID).
		Scan(&r.MatchType, &r.MatchValue, &r.CategoryID, &r.AmountMin, &r.AmountMax)
	if err != nil {
		return 0, nil, err
	}

	selectQuery := "SELECT id, amount, currency, date FROM transactions WHERE category_id IS NULL"
	var matchClause string
	selectArgs := []interface{}{}

	switch r.MatchType {
	case "contains":
		matchClause = "description LIKE ?"
		selectArgs = append(selectArgs, "%"+r.MatchValue+"%")
	case "starts_with":
		matchClause = "description LIKE ?"
		selectArgs = append(selectArgs, r.MatchValue+"%")
	case "ends_with":
		matchClause = "description LIKE ?"
		selectArgs = append(selectArgs, "%"+r.MatchValue)
	case "exact":
		matchClause = "description = ?"
		selectArgs = append(selectArgs, r.MatchValue)
	}

	if matchClause != "" {
		selectQuery += " AND " + matchClause
	}

	rows, err := DB.Query(selectQuery, selectArgs...)
	if err != nil {
		return 0, nil, err
	}
	defer rows.Close()

	var baseCurrency string
	needsAmountFilter := r.AmountMin != nil || r.AmountMax != nil
	if needsAmountFilter {
		settings, err := GetCurrencySettings()
		if err != nil {
			return 0, nil, err
		}
		baseCurrency = strings.TrimSpace(settings.MainCurrency)
		if baseCurrency == "" {
			baseCurrency = defaultMainCurrency
		}
	}

	var affectedIds []int64
	for rows.Next() {
		var id int64
		var amount float64
		var currency string
		var date string
		if err := rows.Scan(&id, &amount, &currency, &date); err != nil {
			return 0, nil, err
		}
		if needsAmountFilter {
			converted, err := ConvertAmount(amount, baseCurrency, currency, date)
			if err != nil {
				return 0, nil, err
			}
			if converted == nil {
				continue
			}
			if r.AmountMin != nil && *converted < *r.AmountMin {
				continue
			}
			if r.AmountMax != nil && *converted > *r.AmountMax {
				continue
			}
		}
		affectedIds = append(affectedIds, id)
	}

	if len(affectedIds) == 0 {
		return 0, affectedIds, nil
	}

	placeholders := make([]string, len(affectedIds))
	updateArgs := make([]interface{}, 0, len(affectedIds)+1)
	updateArgs = append(updateArgs, r.CategoryID)
	for i, id := range affectedIds {
		placeholders[i] = "?"
		updateArgs = append(updateArgs, id)
	}

	updateQuery := "UPDATE transactions SET category_id = ? WHERE id IN (" + strings.Join(placeholders, ",") + ")"
	res, err := DB.Exec(updateQuery, updateArgs...)
	if err != nil {
		return 0, nil, err
	}

	affectedCount, _ := res.RowsAffected()

	return affectedCount, affectedIds, nil
}

func UndoRule(ruleID int64, affectedTxIds []int64) error {
	_, err := DB.Exec("DELETE FROM categorization_rules WHERE id = ?", ruleID)
	if err != nil {
		return err
	}

	if len(affectedTxIds) == 0 {
		return nil
	}

	placeholders := make([]string, len(affectedTxIds))
	args := make([]interface{}, len(affectedTxIds))
	for i, id := range affectedTxIds {
		placeholders[i] = "?"
		args[i] = id
	}

	query := "UPDATE transactions SET category_id = NULL WHERE id IN (" + strings.Join(placeholders, ",") + ")"
	_, err = DB.Exec(query, args...)
	return err
}

func SearchCategories(query string) ([]Category, error) {
	all, err := loadCategories()
	if err != nil {
		return nil, err
	}

	if query == "" {
		if len(all) > 10 {
			return cloneCategories(all[:10]), nil
		}
		return cloneCategories(all), nil
	}

	names := make([]string, len(all))
	nameToCat := make(map[string]Category)
	for i, c := range all {
		names[i] = c.Name
		nameToCat[c.Name] = c
	}

	rankedNames := fuzzy.Match(query, names)

	limit := 10
	if len(rankedNames) < limit {
		limit = len(rankedNames)
	}

	res := make([]Category, 0, limit)
	for i := 0; i < limit; i++ {
		res = append(res, nameToCat[rankedNames[i]])
	}
	return res, nil
}

func GetAllCategories() ([]Category, error) {
	categories, err := loadCategories()
	if err != nil {
		return nil, err
	}
	return cloneCategories(categories), nil
}

func ApplyAllRules() error {
	rules, err := GetRules()
	if err != nil {
		return err
	}
	for _, r := range rules {
		_, err = ApplyRule(r.ID)
		if err != nil {
			return err
		}
	}
	return nil
}
