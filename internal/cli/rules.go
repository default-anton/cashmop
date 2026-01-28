package cli

import (
	"fmt"

	"github.com/default-anton/cashmop/internal/cashmop"
	"github.com/default-anton/cashmop/internal/database"
)

type ruleListResponse struct {
	Ok    bool           `json:"ok"`
	Items []ruleListRule `json:"items"`
}

func (r ruleListResponse) TableHeaders() []string {
	return []string{"ID", "Type", "Value", "Min", "Max", "Category"}
}

func (r ruleListResponse) ToTable() [][]string {
	rows := make([][]string, len(r.Items))
	for i, item := range r.Items {
		min := "-"
		if item.AmountMin != nil {
			min = *item.AmountMin
		}
		max := "-"
		if item.AmountMax != nil {
			max = *item.AmountMax
		}
		rows[i] = []string{
			fmt.Sprint(item.ID),
			item.MatchType,
			item.MatchValue,
			min,
			max,
			item.CategoryName,
		}
	}
	return rows
}

type ruleListRule struct {
	ID           int64   `json:"id"`
	MatchType    string  `json:"match_type"`
	MatchValue   string  `json:"match_value"`
	AmountMin    *string `json:"amount_min"`
	AmountMax    *string `json:"amount_max"`
	CategoryID   int64   `json:"category_id"`
	CategoryName string  `json:"category_name"`
}

type rulePreviewResponse struct {
	Ok           bool                     `json:"ok"`
	Count        int                      `json:"count"`
	MinAmount    *string                  `json:"min_amount"`
	MaxAmount    *string                  `json:"max_amount"`
	Transactions []rulePreviewTransaction `json:"transactions"`
}

type rulePreviewTransaction struct {
	ID          int64  `json:"id"`
	Description string `json:"description"`
	Amount      string `json:"amount"`
	Currency    string `json:"currency"`
	Date        string `json:"date"`
}

type ruleCreateResponse struct {
	Ok          bool    `json:"ok"`
	RuleID      int64   `json:"rule_id"`
	AffectedIDs []int64 `json:"affected_ids"`
}

type ruleUpdateResponse struct {
	Ok                bool  `json:"ok"`
	RuleID            int64 `json:"rule_id"`
	UncategorizeCount int   `json:"uncategorize_count"`
	AppliedCount      int   `json:"applied_count"`
}

type ruleDeleteResponse struct {
	Ok                 bool  `json:"ok"`
	RuleID             int64 `json:"rule_id"`
	UncategorizedCount int   `json:"uncategorized_count"`
}

func handleRules(svc *cashmop.Service, args []string) commandResult {
	if len(args) == 0 {
		return commandResult{Err: validationError(ErrorDetail{
			Field:   "subcommand",
			Message: "Missing rules subcommand (list, preview, create, update, delete).",
			Hint:    "Use \"cashmop rules list\", \"cashmop rules preview\", \"cashmop rules create\", \"cashmop rules update\", or \"cashmop rules delete\".",
		})}
	}

	switch args[0] {
	case "list":
		return handleRulesList(svc, args[1:])
	case "preview":
		return handleRulesPreview(svc, args[1:])
	case "create":
		return handleRulesCreate(svc, args[1:])
	case "update":
		return handleRulesUpdate(svc, args[1:])
	case "delete":
		return handleRulesDelete(svc, args[1:])
	default:
		return commandResult{Err: validationError(ErrorDetail{
			Field:   "subcommand",
			Message: "Unknown rules subcommand.",
			Hint:    "Use \"cashmop rules list\", \"cashmop rules preview\", \"cashmop rules create\", \"cashmop rules update\", or \"cashmop rules delete\".",
		})}
	}
}

func handleRulesList(svc *cashmop.Service, args []string) commandResult {
	fs := newSubcommandFlagSet("rules list")
	if ok, res := fs.parse(args, "rules"); !ok {
		return res
	}

	rules, err := svc.GetCategorizationRules()
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	out := make([]ruleListRule, 0, len(rules))
	for _, r := range rules {
		var min *string
		if r.AmountMin != nil {
			s := formatCentsDecimal(*r.AmountMin)
			min = &s
		}
		var max *string
		if r.AmountMax != nil {
			s := formatCentsDecimal(*r.AmountMax)
			max = &s
		}
		out = append(out, ruleListRule{
			ID:           r.ID,
			MatchType:    r.MatchType,
			MatchValue:   r.MatchValue,
			AmountMin:    min,
			AmountMax:    max,
			CategoryID:   r.CategoryID,
			CategoryName: r.CategoryName,
		})
	}

	return commandResult{Response: ruleListResponse{Ok: true, Items: out}}
}

func handleRulesPreview(svc *cashmop.Service, args []string) commandResult {
	fs := newSubcommandFlagSet("rules preview")
	var matchValue string
	var matchType string
	var amountMin string
	var amountMax string
	fs.StringVar(&matchValue, "match-value", "", "")
	fs.StringVar(&matchType, "match-type", "", "")
	fs.StringVar(&amountMin, "amount-min", "", "")
	fs.StringVar(&amountMax, "amount-max", "", "")
	if ok, res := fs.parse(args, "rules"); !ok {
		return res
	}

	if matchValue == "" || matchType == "" {
		var details []ErrorDetail
		if matchValue == "" {
			details = append(details, requiredFlagError("match-value", "Provide --match-value <value>."))
		}
		if matchType == "" {
			details = append(details, requiredFlagError("match-type", "Provide --match-type <starts_with|ends_with|contains|exact>."))
		}
		return commandResult{Err: validationError(details...)}
	}

	var minCents *int64
	if amountMin != "" {
		v, err := parseCentsString(amountMin)
		if err != nil {
			return commandResult{Err: validationError(ErrorDetail{Field: "amount-min", Message: "Invalid amount.", Hint: "Use a decimal string like 12.34."})}
		}
		minCents = &v
	}
	var maxCents *int64
	if amountMax != "" {
		v, err := parseCentsString(amountMax)
		if err != nil {
			return commandResult{Err: validationError(ErrorDetail{Field: "amount-max", Message: "Invalid amount.", Hint: "Use a decimal string like 12.34."})}
		}
		maxCents = &v
	}

	preview, err := svc.PreviewRuleMatchesWithLimit(matchValue, matchType, minCents, maxCents, 100)
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	var minS, maxS *string
	if preview.MinAmount != nil {
		s := formatCentsDecimal(*preview.MinAmount)
		minS = &s
	}
	if preview.MaxAmount != nil {
		s := formatCentsDecimal(*preview.MaxAmount)
		maxS = &s
	}

	txs := make([]rulePreviewTransaction, 0, len(preview.Transactions))
	for _, t := range preview.Transactions {
		txs = append(txs, rulePreviewTransaction{
			ID:          t.ID,
			Description: t.Description,
			Amount:      formatCentsDecimal(t.Amount),
			Currency:    t.Currency,
			Date:        t.Date,
		})
	}

	return commandResult{Response: rulePreviewResponse{
		Ok:           true,
		Count:        preview.Count,
		MinAmount:    minS,
		MaxAmount:    maxS,
		Transactions: txs,
	}}
}

func handleRulesCreate(svc *cashmop.Service, args []string) commandResult {
	fs := newSubcommandFlagSet("rules create")
	var matchValue string
	var matchType string
	var amountMin string
	var amountMax string
	var category string
	fs.StringVar(&matchValue, "match-value", "", "")
	fs.StringVar(&matchType, "match-type", "", "")
	fs.StringVar(&amountMin, "amount-min", "", "")
	fs.StringVar(&amountMax, "amount-max", "", "")
	fs.StringVar(&category, "category", "", "")
	if ok, res := fs.parse(args, "rules"); !ok {
		return res
	}

	if matchValue == "" || matchType == "" || category == "" {
		var details []ErrorDetail
		if matchValue == "" {
			details = append(details, requiredFlagError("match-value", "Provide --match-value <value>."))
		}
		if matchType == "" {
			details = append(details, requiredFlagError("match-type", "Provide --match-type <starts_with|ends_with|contains|exact>."))
		}
		if category == "" {
			details = append(details, requiredFlagError("category", "Provide --category <name>."))
		}
		return commandResult{Err: validationError(details...)}
	}

	var minCents *int64
	if amountMin != "" {
		v, err := parseCentsString(amountMin)
		if err != nil {
			return commandResult{Err: validationError(ErrorDetail{Field: "amount-min", Message: "Invalid amount.", Hint: "Use a decimal string like 12.34."})}
		}
		minCents = &v
	}
	var maxCents *int64
	if amountMax != "" {
		v, err := parseCentsString(amountMax)
		if err != nil {
			return commandResult{Err: validationError(ErrorDetail{Field: "amount-max", Message: "Invalid amount.", Hint: "Use a decimal string like 12.34."})}
		}
		maxCents = &v
	}

	ruleID, affectedIDs, err := svc.SaveCategorizationRule(database.CategorizationRule{
		MatchType:    matchType,
		MatchValue:   matchValue,
		CategoryName: category,
		AmountMin:    minCents,
		AmountMax:    maxCents,
	})
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	return commandResult{Response: ruleCreateResponse{Ok: true, RuleID: ruleID, AffectedIDs: affectedIDs}}
}

func handleRulesUpdate(svc *cashmop.Service, args []string) commandResult {
	fs := newSubcommandFlagSet("rules update")
	var id int64
	var matchValue optionalStringFlag
	var matchType optionalStringFlag
	var amountMin optionalStringFlag
	var amountMax optionalStringFlag
	var category optionalStringFlag
	var recategorize bool
	fs.Int64Var(&id, "id", 0, "")
	fs.Var(&matchValue, "match-value", "")
	fs.Var(&matchType, "match-type", "")
	fs.Var(&amountMin, "amount-min", "")
	fs.Var(&amountMax, "amount-max", "")
	fs.Var(&category, "category", "")
	fs.BoolVar(&recategorize, "recategorize", false, "")
	if ok, res := fs.parse(args, "rules"); !ok {
		return res
	}

	if id == 0 {
		return commandResult{Err: validationError(ErrorDetail{Field: "id", Message: "Rule ID is required.", Hint: "Provide --id <rule id>."})}
	}

	rule, err := svc.GetRuleByID(id)
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	if matchValue.set {
		rule.MatchValue = matchValue.value
	}
	if matchType.set {
		rule.MatchType = matchType.value
	}
	if category.set {
		rule.CategoryID = 0
		rule.CategoryName = category.value
	}
	if amountMin.set {
		if amountMin.value == "" {
			rule.AmountMin = nil
		} else {
			v, err := parseCentsString(amountMin.value)
			if err != nil {
				return commandResult{Err: validationError(ErrorDetail{Field: "amount-min", Message: "Invalid amount.", Hint: "Use a decimal string like 12.34."})}
			}
			rule.AmountMin = &v
		}
	}
	if amountMax.set {
		if amountMax.value == "" {
			rule.AmountMax = nil
		} else {
			v, err := parseCentsString(amountMax.value)
			if err != nil {
				return commandResult{Err: validationError(ErrorDetail{Field: "amount-max", Message: "Invalid amount.", Hint: "Use a decimal string like 12.34."})}
			}
			rule.AmountMax = &v
		}
	}

	uncategorizeCount, appliedCount, err := svc.UpdateCategorizationRule(rule, recategorize)
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	return commandResult{Response: ruleUpdateResponse{
		Ok:                true,
		RuleID:            rule.ID,
		UncategorizeCount: uncategorizeCount,
		AppliedCount:      appliedCount,
	}}
}

func handleRulesDelete(svc *cashmop.Service, args []string) commandResult {
	fs := newSubcommandFlagSet("rules delete")
	var id int64
	var uncategorize bool
	fs.Int64Var(&id, "id", 0, "")
	fs.BoolVar(&uncategorize, "uncategorize", false, "")
	if ok, res := fs.parse(args, "rules"); !ok {
		return res
	}

	if id == 0 {
		return commandResult{Err: validationError(ErrorDetail{Field: "id", Message: "Rule ID is required.", Hint: "Provide --id <rule id>."})}
	}

	uncategorizedCount, err := svc.DeleteCategorizationRule(id, uncategorize)
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	return commandResult{Response: ruleDeleteResponse{
		Ok:                 true,
		RuleID:             id,
		UncategorizedCount: uncategorizedCount,
	}}
}
