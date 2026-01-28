package database

import (
	"strings"

	"github.com/default-anton/cashmop/internal/fuzzy"
)

type Category struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

type CategorizationRule struct {
	ID           int64  `json:"id"`
	MatchType    string `json:"match_type"`
	MatchValue   string `json:"match_value"`
	CategoryID   int64  `json:"category_id"`
	CategoryName string `json:"category_name"`
	AmountMin    *int64 `json:"amount_min"`
	AmountMax    *int64 `json:"amount_max"`
	CreatedAt    string `json:"created_at"`
}

func (s *Store) invalidateCategoryCache() {
	s.categoryCacheMu.Lock()
	s.categoryCache = nil
	s.categoryCacheMu.Unlock()
}

func (s *Store) loadCategories() ([]Category, error) {
	s.categoryCacheMu.RLock()
	cached := s.categoryCache
	s.categoryCacheMu.RUnlock()
	if cached != nil {
		return cloneCategories(cached), nil
	}

	s.categoryCacheMu.Lock()
	defer s.categoryCacheMu.Unlock()
	if s.categoryCache != nil {
		return s.categoryCache, nil
	}

	rows, err := s.db.Query("SELECT id, name FROM categories ORDER BY name ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	categories := []Category{}
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

	s.categoryCache = categories
	return cloneCategories(categories), nil
}

func cloneCategories(items []Category) []Category {
	res := make([]Category, len(items))
	copy(res, items)
	return res
}

func (s *Store) GetOrCreateCategory(name string) (int64, error) {
	var id int64
	err := s.db.QueryRow("SELECT id FROM categories WHERE name = ?", name).Scan(&id)
	if err == nil {
		return id, nil
	}
	res, err := s.db.Exec("INSERT INTO categories (name) VALUES (?)", name)
	if err != nil {
		return 0, err
	}
	insertedID, err := res.LastInsertId()
	if err != nil {
		return 0, err
	}
	s.invalidateCategoryCache()
	return insertedID, nil
}

func (s *Store) RenameCategory(id int64, newName string) error {
	var oldName string
	err := s.db.QueryRow("SELECT name FROM categories WHERE id = ?", id).Scan(&oldName)
	if err != nil {
		return err
	}

	tx, err := s.db.Begin()
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

	s.invalidateCategoryCache()
	return nil
}

func (s *Store) SaveRule(rule CategorizationRule) (int64, error) {
	res, err := s.db.Exec(`
        INSERT INTO categorization_rules (match_type, match_value, category_id, amount_min, amount_max)
        VALUES (?, ?, ?, ?, ?)
    `, rule.MatchType, rule.MatchValue, rule.CategoryID, rule.AmountMin, rule.AmountMax)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (s *Store) GetRules() ([]CategorizationRule, error) {
	rows, err := s.db.Query(`
        SELECT r.id, r.match_type, r.match_value, r.category_id, COALESCE(c.name, ''), r.amount_min, r.amount_max, r.created_at
        FROM categorization_rules r
        LEFT JOIN categories c ON r.category_id = c.id
        ORDER BY 
            -- Priority by amount specificity
            CASE 
                WHEN r.amount_min IS NOT NULL AND r.amount_max IS NOT NULL THEN 1
                WHEN r.amount_min IS NOT NULL AND r.amount_max IS NULL THEN 2
                WHEN r.amount_min IS NULL AND r.amount_max IS NOT NULL THEN 3
                ELSE 4
            END ASC,
            -- Priority by match type specificity
            CASE 
                WHEN r.match_type = 'exact' THEN 1
                WHEN r.match_type = 'starts_with' THEN 2
                WHEN r.match_type = 'ends_with' THEN 2
                WHEN r.match_type = 'contains' THEN 3
                ELSE 4
            END ASC,
            r.id ASC -- Fallback to oldest rules first
    `)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	rules := []CategorizationRule{}
	for rows.Next() {
		var r CategorizationRule
		if err := rows.Scan(&r.ID, &r.MatchType, &r.MatchValue, &r.CategoryID, &r.CategoryName, &r.AmountMin, &r.AmountMax, &r.CreatedAt); err != nil {
			return nil, err
		}
		rules = append(rules, r)
	}
	return rules, nil
}

func (s *Store) GetRuleByID(id int64) (CategorizationRule, error) {
	var r CategorizationRule
	err := s.db.QueryRow(`
        SELECT r.id, r.match_type, r.match_value, r.category_id, COALESCE(c.name, ''), r.amount_min, r.amount_max, r.created_at
        FROM categorization_rules r
        LEFT JOIN categories c ON r.category_id = c.id
        WHERE r.id = ?
    `, id).Scan(&r.ID, &r.MatchType, &r.MatchValue, &r.CategoryID, &r.CategoryName, &r.AmountMin, &r.AmountMax, &r.CreatedAt)
	if err != nil {
		return CategorizationRule{}, err
	}
	return r, nil
}

func (s *Store) UpdateRule(rule CategorizationRule) error {
	_, err := s.db.Exec(`
        UPDATE categorization_rules
        SET match_type = ?, match_value = ?, category_id = ?, amount_min = ?, amount_max = ?
        WHERE id = ?
    `, rule.MatchType, rule.MatchValue, rule.CategoryID, rule.AmountMin, rule.AmountMax, rule.ID)
	return err
}

func (s *Store) DeleteRule(id int64) error {
	_, err := s.db.Exec("DELETE FROM categorization_rules WHERE id = ?", id)
	return err
}

func (s *Store) GetRulesCount() (int, error) {
	var count int
	err := s.db.QueryRow("SELECT COUNT(*) FROM categorization_rules").Scan(&count)
	return count, err
}

func (s *Store) ApplyRule(ruleID int64) (int64, error) {
	_, affectedIds, err := s.ApplyRuleWithIds(ruleID)
	if err != nil {
		return 0, err
	}
	return int64(len(affectedIds)), nil
}

func (s *Store) ApplyRuleWithIds(ruleID int64) (int64, []int64, error) {
	var r CategorizationRule
	err := s.db.QueryRow("SELECT match_type, match_value, category_id, amount_min, amount_max FROM categorization_rules WHERE id = ?", ruleID).
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

	var baseCurrency string
	needsAmountFilter := r.AmountMin != nil || r.AmountMax != nil
	if needsAmountFilter {
		settings, err := s.GetCurrencySettings()
		if err != nil {
			return 0, nil, err
		}
		baseCurrency = strings.TrimSpace(settings.MainCurrency)
		if baseCurrency == "" {
			baseCurrency = defaultMainCurrency
		}
	}

	rows, err := s.db.Query(selectQuery, selectArgs...)
	if err != nil {
		return 0, nil, err
	}
	defer rows.Close()

	var affectedIds []int64
	for rows.Next() {
		var id int64
		var amount int64
		var currency string
		var date string
		if err := rows.Scan(&id, &amount, &currency, &date); err != nil {
			return 0, nil, err
		}
		if needsAmountFilter {
			converted, err := s.ConvertAmount(amount, baseCurrency, currency, date)
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
	res, err := s.db.Exec(updateQuery, updateArgs...)
	if err != nil {
		return 0, nil, err
	}

	affectedCount, _ := res.RowsAffected()

	return affectedCount, affectedIds, nil
}

func (s *Store) UndoRule(ruleID int64, affectedTxIds []int64) error {
	_, err := s.db.Exec("DELETE FROM categorization_rules WHERE id = ?", ruleID)
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
	_, err = s.db.Exec(query, args...)
	return err
}

func (s *Store) SearchCategories(query string) ([]Category, error) {
	all, err := s.loadCategories()
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

func (s *Store) GetAllCategories() ([]Category, error) {
	categories, err := s.loadCategories()
	if err != nil {
		return nil, err
	}
	return cloneCategories(categories), nil
}

func (s *Store) ApplyAllRules() (int, error) {
	rules, err := s.GetRules()
	if err != nil {
		return 0, err
	}
	totalAffected := 0
	for _, r := range rules {
		affected, err := s.ApplyRule(r.ID)
		if err != nil {
			return totalAffected, err
		}
		totalAffected += int(affected)
	}
	return totalAffected, nil
}
