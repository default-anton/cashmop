package cli

import (
	"fmt"
	"sort"
	"strings"

	"github.com/default-anton/cashmop/internal/cashmop"
	"github.com/default-anton/cashmop/internal/database"
	"github.com/default-anton/cashmop/internal/fuzzy"
)

type txListResponse struct {
	Ok           bool                `json:"ok"`
	Count        int                 `json:"count"`
	Transactions []txListTransaction `json:"transactions"`
}

func (r txListResponse) TableHeaders() []string {
	return []string{"ID", "Date", "Amount", "Curr", "Category", "Account", "Description"}
}

func (r txListResponse) ToTable() [][]string {
	rows := make([][]string, len(r.Transactions))
	for i, tx := range r.Transactions {
		rows[i] = []string{
			fmt.Sprint(tx.ID),
			tx.Date,
			tx.Amount,
			tx.Currency,
			tx.Category,
			tx.Account,
			tx.Description,
		}
	}
	return rows
}

type txListTransaction struct {
	ID          int64  `json:"id"`
	Date        string `json:"date"`
	Description string `json:"description"`
	Amount      string `json:"amount"`
	Currency    string `json:"currency"`
	Category    string `json:"category"`
	Account     string `json:"account"`
	Owner       string `json:"owner"`
}

type txCategorizeResponse struct {
	Ok            bool    `json:"ok"`
	TransactionID int64   `json:"transaction_id"`
	AffectedIDs   []int64 `json:"affected_ids"`
}

func handleTransactions(svc *cashmop.Service, args []string) commandResult {
	if len(args) == 0 {
		return commandResult{Err: validationError(ErrorDetail{
			Field:   "subcommand",
			Message: "Missing tx subcommand (list, categorize).",
			Hint:    "Use \"cashmop tx list\" or \"cashmop tx categorize\".",
		})}
	}

	switch args[0] {
	case "list":
		return handleTxList(svc, args[1:])
	case "categorize":
		return handleTxCategorize(svc, args[1:])
	default:
		return commandResult{Err: validationError(ErrorDetail{
			Field:   "subcommand",
			Message: "Unknown tx subcommand.",
			Hint:    "Use \"cashmop tx list\" or \"cashmop tx categorize\".",
		})}
	}
}

func handleTxList(svc *cashmop.Service, args []string) commandResult {
	fs := newSubcommandFlagSet("tx list")
	var start string
	var end string
	var uncategorized bool
	var categoryIDs stringSliceFlag
	var query string
	var amountMin string
	var amountMax string
	var sortField string
	var order string

	fs.StringVar(&start, "start", "", "")
	fs.StringVar(&end, "end", "", "")
	fs.BoolVar(&uncategorized, "uncategorized", false, "")
	fs.Var(&categoryIDs, "category-ids", "")
	fs.StringVar(&query, "query", "", "")
	fs.StringVar(&amountMin, "amount-min", "", "")
	fs.StringVar(&amountMax, "amount-max", "", "")
	fs.StringVar(&sortField, "sort", "date", "")
	fs.StringVar(&order, "order", "desc", "")

	if ok, res := fs.parse(args, "tx"); !ok {
		return res
	}

	start, end, cErr := validateDateRange(start, end)
	if cErr != nil {
		return commandResult{Err: cErr}
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

	var catIDs []int64
	for _, s := range categoryIDs.values {
		parts := strings.Split(s, ",")
		for _, p := range parts {
			p = strings.TrimSpace(p)
			if p == "" {
				continue
			}
			var id int64
			if _, err := fmt.Sscanf(p, "%d", &id); err != nil {
				return commandResult{Err: validationError(ErrorDetail{Field: "category-ids", Message: fmt.Sprintf("Invalid category ID: %s", p), Hint: "Provide comma-separated numeric IDs."})}
			}
			catIDs = append(catIDs, id)
		}
	}
	if uncategorized {
		catIDs = append(catIDs, 0)
	}

	txs, err := svc.GetAnalysisTransactions(start, end, catIDs, nil)
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	settings, err := svc.GetCurrencySettings()
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}
	mainCurrency := settings.MainCurrency
	if mainCurrency == "" {
		mainCurrency = database.DefaultCurrency()
	}

	// Filter by query (fuzzy)
	if query != "" {
		labels := make([]string, 0, len(txs))
		txMap := make(map[string]database.TransactionModel)
		for _, tx := range txs {
			label := buildSearchLabel(tx)
			labels = append(labels, label)
			txMap[label] = tx
		}
		matchedLabels := fuzzy.Match(query, labels)
		txs = make([]database.TransactionModel, 0, len(matchedLabels))
		for _, label := range matchedLabels {
			txs = append(txs, txMap[label])
		}
	}

	// Pre-calculate converted amounts for filtering and sorting.
	type txExt struct {
		database.TransactionModel
		ConvertedAmount *int64
	}
	extended := make([]txExt, len(txs))
	for i, tx := range txs {
		converted, _ := svc.ConvertAmount(tx.Amount, mainCurrency, tx.Currency, tx.Date)
		extended[i] = txExt{TransactionModel: tx, ConvertedAmount: converted}
	}

	// Filter by amount
	if minCents != nil || maxCents != nil {
		filtered := make([]txExt, 0, len(extended))
		for _, e := range extended {
			if e.ConvertedAmount == nil {
				continue
			}
			if minCents != nil && *e.ConvertedAmount < *minCents {
				continue
			}
			if maxCents != nil && *e.ConvertedAmount > *maxCents {
				continue
			}
			filtered = append(filtered, e)
		}
		extended = filtered
	}

	// Sort
	sort.Slice(extended, func(i, j int) bool {
		var less bool
		switch sortField {
		case "amount":
			ci := extended[i].ConvertedAmount
			cj := extended[j].ConvertedAmount
			if ci == nil && cj == nil {
				less = extended[i].ID < extended[j].ID
			} else if ci == nil {
				less = false
			} else if cj == nil {
				less = true
			} else {
				less = *ci < *cj
			}
		default:
			if extended[i].Date != extended[j].Date {
				less = extended[i].Date < extended[j].Date
			} else {
				less = extended[i].ID < extended[j].ID
			}
		}
		if order == "desc" {
			return !less
		}
		return less
	})

	out := make([]txListTransaction, 0, len(extended))
	for _, e := range extended {
		tx := e.TransactionModel
		cat := tx.CategoryName
		if tx.CategoryID == nil {
			cat = "Uncategorized"
		}
		out = append(out, txListTransaction{
			ID:          tx.ID,
			Date:        tx.Date,
			Description: tx.Description,
			Amount:      formatCentsDecimal(tx.Amount),
			Currency:    tx.Currency,
			Category:    cat,
			Account:     tx.AccountName,
			Owner:       tx.OwnerName,
		})
	}

	return commandResult{Response: txListResponse{Ok: true, Count: len(out), Transactions: out}}
}

func handleTxCategorize(svc *cashmop.Service, args []string) commandResult {
	fs := newSubcommandFlagSet("tx categorize")
	var id int64
	var category string
	var uncategorize bool

	fs.Int64Var(&id, "id", 0, "")
	fs.StringVar(&category, "category", "", "")
	fs.BoolVar(&uncategorize, "uncategorize", false, "")
	if ok, res := fs.parse(args, "tx"); !ok {
		return res
	}

	if id == 0 {
		return commandResult{Err: validationError(ErrorDetail{Field: "id", Message: "Transaction ID is required.", Hint: "Provide --id <transaction id>."})}
	}

	if !uncategorize && category == "" {
		return commandResult{Err: validationError(ErrorDetail{
			Field:   "category",
			Message: "Either --category or --uncategorize must be provided.",
			Hint:    "Provide --category <name> or use --uncategorize.",
		})}
	}

	catName := category
	if uncategorize {
		catName = ""
	}

	if err := svc.CategorizeTransaction(id, catName); err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	return commandResult{Response: txCategorizeResponse{Ok: true, TransactionID: id, AffectedIDs: []int64{id}}}
}

func buildSearchLabel(tx database.TransactionModel) string {
	cat := tx.CategoryName
	if tx.CategoryID == nil {
		cat = "Uncategorized"
	}
	owner := tx.OwnerName
	if owner == "" {
		owner = "No Owner"
	}
	parts := []string{
		tx.Description,
		tx.AccountName,
		cat,
		owner,
		tx.Date,
		formatCentsDecimal(tx.Amount),
		tx.Currency,
	}
	return strings.Join(parts, " | ") + " ::" + fmt.Sprint(tx.ID)
}
