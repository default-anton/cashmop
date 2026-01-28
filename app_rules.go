package main

import "github.com/default-anton/cashmop/internal/database"

func (a *App) SaveCategorizationRule(rule database.CategorizationRule) (*RuleResult, error) {
	id, affectedIds, err := a.svc.SaveCategorizationRule(rule)
	if err != nil {
		return nil, err
	}
	return &RuleResult{RuleID: id, AffectedIds: affectedIds}, nil
}

func (a *App) GetCategorizationRules() ([]database.CategorizationRule, error) {
	return a.svc.GetCategorizationRules()
}

func (a *App) PreviewRuleMatches(matchValue string, matchType string, amountMin *int64, amountMax *int64) (database.RuleMatchPreview, error) {
	return a.svc.PreviewRuleMatches(matchValue, matchType, amountMin, amountMax)
}

func (a *App) GetRuleAmountRange(matchValue string, matchType string) (database.AmountRange, error) {
	return a.svc.GetRuleAmountRange(matchValue, matchType)
}

func (a *App) GetRuleMatchCount(ruleID int64) (int, error) {
	return a.svc.GetRuleMatchCount(ruleID)
}

func (a *App) UpdateCategorizationRule(rule database.CategorizationRule, recategorize bool) (*RuleUpdateResult, error) {
	uncategorizeCount, appliedCount, err := a.svc.UpdateCategorizationRule(rule, recategorize)
	if err != nil {
		return nil, err
	}
	return &RuleUpdateResult{RuleID: rule.ID, UncategorizeCount: uncategorizeCount, AppliedCount: appliedCount}, nil
}

func (a *App) DeleteCategorizationRule(ruleID int64, uncategorize bool) (*RuleDeleteResult, error) {
	uncategorizedCount, err := a.svc.DeleteCategorizationRule(ruleID, uncategorize)
	if err != nil {
		return nil, err
	}
	return &RuleDeleteResult{RuleID: ruleID, UncategorizedCount: uncategorizedCount}, nil
}

func (a *App) UndoCategorizationRule(ruleId int64, transactionIds []int64) error {
	return a.svc.UndoCategorizationRule(ruleId, transactionIds)
}

func (a *App) GetCategorizationRulesCount() (int, error) {
	return a.svc.GetCategorizationRulesCount()
}
