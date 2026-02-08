package cashmop

import (
	"fmt"
	"strings"

	"github.com/default-anton/cashmop/internal/database"
)

func (s *Service) SearchCategories(query string) ([]database.Category, error) {
	return s.store.SearchCategories(query)
}

func (s *Service) GetCategories() ([]database.Category, error) {
	return s.store.GetAllCategories()
}

func (s *Service) CreateCategory(name string) (int64, error) {
	return s.store.GetOrCreateCategory(name)
}

func (s *Service) GetCategorySummaries() ([]database.CategorySummary, error) {
	return s.store.GetCategorySummaries()
}

func (s *Service) DeleteCategory(id int64) (database.CategoryDeleteStats, error) {
	if id == 0 {
		return database.CategoryDeleteStats{}, fmt.Errorf("category id is required")
	}
	return s.store.DeleteCategory(id)
}

func (s *Service) GetCategorizationRules() ([]database.CategorizationRule, error) {
	return s.store.GetRules()
}

func (s *Service) GetRuleByID(id int64) (database.CategorizationRule, error) {
	return s.store.GetRuleByID(id)
}

func (s *Service) GetCategorizationRulesCount() (int, error) {
	return s.store.GetRulesCount()
}

func (s *Service) SaveCategorizationRule(rule database.CategorizationRule) (int64, []int64, error) {
	if rule.CategoryID == 0 && rule.CategoryName != "" {
		id, err := s.store.GetOrCreateCategory(rule.CategoryName)
		if err != nil {
			return 0, nil, err
		}
		rule.CategoryID = id
	}
	id, err := s.store.SaveRule(rule)
	if err != nil {
		return 0, nil, err
	}
	_, affectedIds, err := s.store.ApplyRuleWithIds(id)
	if err != nil {
		return 0, nil, err
	}
	return id, affectedIds, nil
}

func (s *Service) PreviewRuleMatches(matchValue string, matchType string, amountMin *int64, amountMax *int64) (database.RuleMatchPreview, error) {
	return s.store.PreviewRuleMatches(matchValue, matchType, amountMin, amountMax, true, 10)
}

func (s *Service) PreviewRuleMatchesWithLimit(matchValue string, matchType string, amountMin *int64, amountMax *int64, limit int) (database.RuleMatchPreview, error) {
	return s.store.PreviewRuleMatches(matchValue, matchType, amountMin, amountMax, true, limit)
}

func (s *Service) GetRuleAmountRange(matchValue string, matchType string) (database.AmountRange, error) {
	return s.store.GetRuleAmountRange(matchValue, matchType)
}

func (s *Service) GetRuleMatchCount(ruleID int64) (int, error) {
	rule, err := s.store.GetRuleByID(ruleID)
	if err != nil {
		return 0, err
	}
	matches, err := s.store.SearchTransactionsByRule(rule.MatchValue, rule.MatchType, rule.AmountMin, rule.AmountMax, true)
	if err != nil {
		return 0, err
	}
	return len(matches), nil
}

func (s *Service) UpdateCategorizationRule(rule database.CategorizationRule, recategorize bool) (uncategorizeCount int, appliedCount int, err error) {
	if rule.ID == 0 {
		return 0, 0, fmt.Errorf("rule id is required")
	}
	if strings.TrimSpace(rule.MatchValue) == "" {
		return 0, 0, fmt.Errorf("match value cannot be empty")
	}
	if rule.CategoryID == 0 && rule.CategoryName != "" {
		id, err := s.store.GetOrCreateCategory(rule.CategoryName)
		if err != nil {
			return 0, 0, err
		}
		rule.CategoryID = id
	}

	if recategorize {
		oldRule, err := s.store.GetRuleByID(rule.ID)
		if err != nil {
			return 0, 0, err
		}
		matches, err := s.store.SearchTransactionsByRule(oldRule.MatchValue, oldRule.MatchType, oldRule.AmountMin, oldRule.AmountMax, true)
		if err != nil {
			return 0, 0, err
		}
		ids := make([]int64, 0, len(matches))
		for _, tx := range matches {
			ids = append(ids, tx.ID)
		}
		if err := s.store.ClearTransactionCategories(ids); err != nil {
			return 0, 0, err
		}
		uncategorizeCount = len(ids)
	}

	if err := s.store.UpdateRule(rule); err != nil {
		return 0, 0, err
	}

	if recategorize {
		_, affectedIds, err := s.store.ApplyRuleWithIds(rule.ID)
		if err != nil {
			return uncategorizeCount, 0, err
		}
		appliedCount = len(affectedIds)
	}

	return uncategorizeCount, appliedCount, nil
}

func (s *Service) DeleteCategorizationRule(ruleID int64, uncategorize bool) (uncategorizeCount int, err error) {
	if ruleID == 0 {
		return 0, fmt.Errorf("rule id is required")
	}

	if !uncategorize {
		return 0, s.store.DeleteRule(ruleID)
	}

	rule, err := s.store.GetRuleByID(ruleID)
	if err != nil {
		return 0, err
	}
	matches, err := s.store.SearchTransactionsByRule(rule.MatchValue, rule.MatchType, rule.AmountMin, rule.AmountMax, true)
	if err != nil {
		return 0, err
	}
	ids := make([]int64, 0, len(matches))
	for _, tx := range matches {
		ids = append(ids, tx.ID)
	}
	if err := s.store.ClearTransactionCategories(ids); err != nil {
		return 0, err
	}
	if err := s.store.DeleteRule(ruleID); err != nil {
		return 0, err
	}
	return len(ids), nil
}

func (s *Service) UndoCategorizationRule(ruleID int64, transactionIDs []int64) error {
	return s.store.UndoRule(ruleID, transactionIDs)
}

func (s *Service) ApplyAllRules() (int, error) {
	return s.store.ApplyAllRules()
}
