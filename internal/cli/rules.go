package cli

import (
	"cashmop/internal/database"
	"flag"
	"io"
)

type ruleListResponse struct {
	Ok    bool               `json:"ok"`
	Items []ruleListRule `json:"items"`
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
	Ok           bool                       `json:"ok"`
	Count        int                        `json:"count"`
	MinAmount    *string                    `json:"min_amount"`
	MaxAmount    *string                    `json:"max_amount"`
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

func handleRules(args []string) commandResult {
	if len(args) == 0 {
		return commandResult{Err: validationError(ErrorDetail{Message: "Missing rules subcommand (list, preview, create, update, delete)."}) }
	}

	switch args[0] {
	case "list":
		return handleRulesList(args[1:])
	case "preview":
		return handleRulesPreview(args[1:])
	case "create":
		return handleRulesCreate(args[1:])
	case "update":
		return handleRulesUpdate(args[1:])
	case "delete":
		return handleRulesDelete(args[1:])
	default:
		return commandResult{Err: validationError(ErrorDetail{Message: "Unknown rules subcommand."}) }
	}
}

func handleRulesList(args []string) commandResult {
	fs := flag.NewFlagSet("rules list", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	var help bool
	fs.BoolVar(&help, "help", false, "")
	fs.BoolVar(&help, "h", false, "")
	if err := fs.Parse(args); err != nil {
		return commandResult{Err: validationError(ErrorDetail{Message: err.Error()})}
	}
	if help {
		printHelp("rules")
		return commandResult{Help: true}
	}

	rules, err := database.GetRules()
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

func handleRulesPreview(args []string) commandResult {
	fs := flag.NewFlagSet("rules preview", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	var help bool
	var matchValue string
	var matchType string
	var amountMin string
	var amountMax string
	fs.BoolVar(&help, "help", false, "")
	fs.BoolVar(&help, "h", false, "")
	fs.StringVar(&matchValue, "match-value", "", "")
	fs.StringVar(&matchType, "match-type", "", "")
	fs.StringVar(&amountMin, "amount-min", "", "")
	fs.StringVar(&amountMax, "amount-max", "", "")
	if err := fs.Parse(args); err != nil {
		return commandResult{Err: validationError(ErrorDetail{Message: err.Error()})}
	}
	if help {
		printHelp("rules")
		return commandResult{Help: true}
	}

	if matchValue == "" || matchType == "" {
		return commandResult{Err: validationError(ErrorDetail{Message: "--match-value and --match-type are required."}) }
	}

	var minCents *int64
	if amountMin != "" {
		v, err := parseCentsString(amountMin)
		if err != nil {
			return commandResult{Err: validationError(ErrorDetail{Field: "amount-min", Message: "Invalid amount."})}
		}
		minCents = &v
	}
	var maxCents *int64
	if amountMax != "" {
		v, err := parseCentsString(amountMax)
		if err != nil {
			return commandResult{Err: validationError(ErrorDetail{Field: "amount-max", Message: "Invalid amount."})}
		}
		maxCents = &v
	}

	preview, err := database.PreviewRuleMatches(matchValue, matchType, minCents, maxCents, true, 100)
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

func handleRulesCreate(args []string) commandResult {
	fs := flag.NewFlagSet("rules create", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	var help bool
	var matchValue string
	var matchType string
	var amountMin string
	var amountMax string
	var category string
	fs.BoolVar(&help, "help", false, "")
	fs.BoolVar(&help, "h", false, "")
	fs.StringVar(&matchValue, "match-value", "", "")
	fs.StringVar(&matchType, "match-type", "", "")
	fs.StringVar(&amountMin, "amount-min", "", "")
	fs.StringVar(&amountMax, "amount-max", "", "")
	fs.StringVar(&category, "category", "", "")
	if err := fs.Parse(args); err != nil {
		return commandResult{Err: validationError(ErrorDetail{Message: err.Error()})}
	}
	if help {
		printHelp("rules")
		return commandResult{Help: true}
	}

	if matchValue == "" || matchType == "" || category == "" {
		return commandResult{Err: validationError(ErrorDetail{Message: "--match-value, --match-type, and --category are required."}) }
	}

	var minCents *int64
	if amountMin != "" {
		v, err := parseCentsString(amountMin)
		if err != nil {
			return commandResult{Err: validationError(ErrorDetail{Field: "amount-min", Message: "Invalid amount."})}
		}
		minCents = &v
	}
	var maxCents *int64
	if amountMax != "" {
		v, err := parseCentsString(amountMax)
		if err != nil {
			return commandResult{Err: validationError(ErrorDetail{Field: "amount-max", Message: "Invalid amount."})}
		}
		maxCents = &v
	}

	catID, err := database.GetOrCreateCategory(category)
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	ruleID, err := database.SaveRule(database.CategorizationRule{
		MatchType:  matchType,
		MatchValue: matchValue,
		CategoryID: catID,
		AmountMin:  minCents,
		AmountMax:  maxCents,
	})
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	_, affectedIDs, err := database.ApplyRuleWithIds(ruleID)
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	return commandResult{Response: ruleCreateResponse{Ok: true, RuleID: ruleID, AffectedIDs: affectedIDs}}
}

func handleRulesUpdate(args []string) commandResult {
	fs := flag.NewFlagSet("rules update", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	var help bool
	var id int64
	var matchValue optionalStringFlag
	var matchType optionalStringFlag
	var amountMin optionalStringFlag
	var amountMax optionalStringFlag
	var category optionalStringFlag
	var recategorize bool
	fs.BoolVar(&help, "help", false, "")
	fs.BoolVar(&help, "h", false, "")
	fs.Int64Var(&id, "id", 0, "")
	fs.Var(&matchValue, "match-value", "")
	fs.Var(&matchType, "match-type", "")
	fs.Var(&amountMin, "amount-min", "")
	fs.Var(&amountMax, "amount-max", "")
	fs.Var(&category, "category", "")
	fs.BoolVar(&recategorize, "recategorize", false, "")
	if err := fs.Parse(args); err != nil {
		return commandResult{Err: validationError(ErrorDetail{Message: err.Error()})}
	}
	if help {
		printHelp("rules")
		return commandResult{Help: true}
	}

	if id == 0 {
		return commandResult{Err: validationError(ErrorDetail{Field: "id", Message: "Rule ID is required."})}
	}

	rule, err := database.GetRuleByID(id)
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	uncategorizeCount := 0
	if recategorize {
		matches, err := database.SearchTransactionsByRule(rule.MatchValue, rule.MatchType, rule.AmountMin, rule.AmountMax, true)
		if err != nil {
			return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
		}
		ids := make([]int64, 0, len(matches))
		for _, tx := range matches {
			ids = append(ids, tx.ID)
		}
		if err := database.ClearTransactionCategories(ids); err != nil {
			return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
		}
		uncategorizeCount = len(ids)
	}

	if matchValue.set { rule.MatchValue = matchValue.value }
	if matchType.set { rule.MatchType = matchType.value }
	if category.set {
		catID, err := database.GetOrCreateCategory(category.value)
		if err != nil {
			return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
		}
		rule.CategoryID = catID
	}
	if amountMin.set {
		if amountMin.value == "" {
			rule.AmountMin = nil
		} else {
			v, err := parseCentsString(amountMin.value)
			if err != nil {
				return commandResult{Err: validationError(ErrorDetail{Field: "amount-min", Message: "Invalid amount."})}
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
				return commandResult{Err: validationError(ErrorDetail{Field: "amount-max", Message: "Invalid amount."})}
			}
			rule.AmountMax = &v
		}
	}

	if err := database.UpdateRule(rule); err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	appliedCount := 0
	if recategorize {
		_, affectedIDs, err := database.ApplyRuleWithIds(rule.ID)
		if err != nil {
			return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
		}
		appliedCount = len(affectedIDs)
	}

	return commandResult{Response: ruleUpdateResponse{
		Ok:                true,
		RuleID:            rule.ID,
		UncategorizeCount: uncategorizeCount,
		AppliedCount:      appliedCount,
	}}
}

func handleRulesDelete(args []string) commandResult {
	fs := flag.NewFlagSet("rules delete", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	var help bool
	var id int64
	var uncategorize bool
	fs.BoolVar(&help, "help", false, "")
	fs.BoolVar(&help, "h", false, "")
	fs.Int64Var(&id, "id", 0, "")
	fs.BoolVar(&uncategorize, "uncategorize", false, "")
	if err := fs.Parse(args); err != nil {
		return commandResult{Err: validationError(ErrorDetail{Message: err.Error()})}
	}
	if help {
		printHelp("rules")
		return commandResult{Help: true}
	}

	if id == 0 {
		return commandResult{Err: validationError(ErrorDetail{Field: "id", Message: "Rule ID is required."})}
	}

	rule, err := database.GetRuleByID(id)
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	uncategorizedCount := 0
	if uncategorize {
		matches, err := database.SearchTransactionsByRule(rule.MatchValue, rule.MatchType, rule.AmountMin, rule.AmountMax, true)
		if err != nil {
			return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
		}
		ids := make([]int64, 0, len(matches))
		for _, tx := range matches {
			ids = append(ids, tx.ID)
		}
		if err := database.ClearTransactionCategories(ids); err != nil {
			return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
		}
		uncategorizedCount = len(ids)
	}

	if err := database.DeleteRule(id); err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	return commandResult{Response: ruleDeleteResponse{
		Ok:                 true,
		RuleID:             id,
		UncategorizedCount: uncategorizedCount,
	}}
}
