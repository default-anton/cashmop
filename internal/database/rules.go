package database

import (
	"cashflow/internal/fuzzy"
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
	CategoryName string   `json:"category_name"` // For frontend convenience
	AmountMin    *float64 `json:"amount_min"`
	AmountMax    *float64 `json:"amount_max"`
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
	return res.LastInsertId()
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

	_, err = tx.Exec("UPDATE categories SET name = ? WHERE id = ?", newName, id)
	if err != nil {
		return err
	}

	return tx.Commit()
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
	var r CategorizationRule
	err := DB.QueryRow("SELECT match_type, match_value, category_id, amount_min, amount_max FROM categorization_rules WHERE id = ?", ruleID).
		Scan(&r.MatchType, &r.MatchValue, &r.CategoryID, &r.AmountMin, &r.AmountMax)
	if err != nil {
		return 0, err
	}

	query := "UPDATE transactions SET category_id = ? WHERE category_id IS NULL"
	args := []interface{}{r.CategoryID}

	var matchClause string
	switch r.MatchType {
	case "contains":
		matchClause = "description LIKE ?"
		args = append(args, "%"+r.MatchValue+"%")
	case "starts_with":
		matchClause = "description LIKE ?"
		args = append(args, r.MatchValue+"%")
	case "ends_with":
		matchClause = "description LIKE ?"
		args = append(args, "%"+r.MatchValue)
	case "exact":
		matchClause = "description = ?"
		args = append(args, r.MatchValue)
	}

	if matchClause != "" {
		query += " AND " + matchClause
	}

	if r.AmountMin != nil {
		query += " AND amount >= ?"
		args = append(args, *r.AmountMin)
	}
	if r.AmountMax != nil {
		query += " AND amount <= ?"
		args = append(args, *r.AmountMax)
	}

	res, err := DB.Exec(query, args...)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

func SearchCategories(query string) ([]Category, error) {
	all, err := GetAllCategories()
	if err != nil {
		return nil, err
	}

	if query == "" {
		if len(all) > 10 {
			return all[:10], nil
		}
		return all, nil
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
	return categories, nil
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
