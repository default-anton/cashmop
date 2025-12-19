package database

type CategorizationRule struct {
	ID         int64    `json:"id"`
	MatchType  string   `json:"match_type"`
	MatchValue string   `json:"match_value"`
	Category   string   `json:"category"`
	AmountMin  *float64 `json:"amount_min"`
	AmountMax  *float64 `json:"amount_max"`
}

func SaveRule(rule CategorizationRule) (int64, error) {
	res, err := DB.Exec(`
		INSERT INTO categorization_rules (match_type, match_value, category, amount_min, amount_max)
		VALUES (?, ?, ?, ?, ?)
	`, rule.MatchType, rule.MatchValue, rule.Category, rule.AmountMin, rule.AmountMax)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func GetRules() ([]CategorizationRule, error) {
	rows, err := DB.Query("SELECT id, match_type, match_value, category, amount_min, amount_max FROM categorization_rules")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []CategorizationRule
	for rows.Next() {
		var r CategorizationRule
		if err := rows.Scan(&r.ID, &r.MatchType, &r.MatchValue, &r.Category, &r.AmountMin, &r.AmountMax); err != nil {
			return nil, err
		}
		rules = append(rules, r)
	}
	return rules, nil
}

func ApplyRule(ruleID int64) (int64, error) {
	var r CategorizationRule
	err := DB.QueryRow("SELECT match_type, match_value, category, amount_min, amount_max FROM categorization_rules WHERE id = ?", ruleID).
		Scan(&r.MatchType, &r.MatchValue, &r.Category, &r.AmountMin, &r.AmountMax)
	if err != nil {
		return 0, err
	}

	query := "UPDATE transactions SET category = ? WHERE (category IS NULL OR category = '')"
	args := []interface{}{r.Category}

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

func SearchCategories(query string) ([]string, error) {
	// Simple BM25-ish search using FTS5 breadcrumbs if available,
	// but here we just use LIKE or FTS5 match for simplicity.
	rows, err := DB.Query(`
		SELECT DISTINCT category
		FROM transactions_fts
		WHERE category MATCH ?
		ORDER BY rank
		LIMIT 10`, query+"*")
	if err != nil {
		// Fallback to simple LIKE if FTS fails or no matches
		rows, err = DB.Query("SELECT DISTINCT category FROM transactions WHERE category LIKE ? LIMIT 10", "%"+query+"%")
		if err != nil {
			return nil, err
		}
	}
	defer rows.Close()

	var categories []string
	for rows.Next() {
		var c string
		if err := rows.Scan(&c); err != nil {
			return nil, err
		}
		if c != "" {
			categories = append(categories, c)
		}
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
