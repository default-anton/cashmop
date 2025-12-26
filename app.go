package main

import (
	"cashflow/internal/database"
	"cashflow/internal/fuzzy"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/xuri/excelize/v2"
)

// App struct
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	database.InitDB() // Initialize SQLite
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

type TransactionInput struct {
	Date        string  `json:"date"`
	Description string  `json:"description"`
	Amount      float64 `json:"amount"`
	Category    string  `json:"category"`
	Account     string  `json:"account"` // Name of the account
	Owner       string  `json:"owner"`   // Name of the owner
}

func (a *App) ImportTransactions(transactions []TransactionInput) error {
	var txModels []database.TransactionModel

	// Cache lookups to minimize DB hits if many rows share the same account/owner/category
	accountCache := make(map[string]int64)
	userCache := make(map[string]*int64)
	categoryCache := make(map[string]int64)

	for _, t := range transactions {
		// 1. Account
		accID, ok := accountCache[t.Account]
		if !ok {
			id, err := database.GetOrCreateAccount(t.Account)
			if err != nil {
				return fmt.Errorf("failed to get/create account '%s': %w", t.Account, err)
			}
			accID = id
			accountCache[t.Account] = accID
		}

		// 2. User/Owner
		var ownerID *int64
		if t.Owner != "" {
			cached, ok := userCache[t.Owner]
			if !ok {
				id, err := database.GetOrCreateUser(t.Owner)
				if err != nil {
					return fmt.Errorf("failed to get/create user '%s': %w", t.Owner, err)
				}
				ownerID = id
				userCache[t.Owner] = ownerID
			} else {
				ownerID = cached
			}
		}

		// 3. Category
		var catID *int64
		if t.Category != "" {
			id, ok := categoryCache[t.Category]
			if !ok {
				var err error
				id, err = database.GetOrCreateCategory(t.Category)
				if err != nil {
					return fmt.Errorf("failed to get/create category '%s': %w", t.Category, err)
				}
				categoryCache[t.Category] = id
			}
			catID = &id
		}

		txModels = append(txModels, database.TransactionModel{
			AccountID:   accID,
			OwnerID:     ownerID,
			Date:        t.Date,
			Description: t.Description,
			Amount:      t.Amount,
			CategoryID:  catID,
			Currency:    "CAD", // Default or passed in? For now default as per plan/schema
		})
	}

	if err := database.BatchInsertTransactions(txModels); err != nil {
		return err
	}
	return database.ApplyAllRules()
}

// GetColumnMappings returns all saved column mappings
func (a *App) GetColumnMappings() ([]database.ColumnMappingModel, error) {
	return database.GetColumnMappings()
}

// SaveColumnMapping saves a column mapping to the database
func (a *App) SaveColumnMapping(name string, mapping interface{}) (int64, error) {
	bytes, err := json.Marshal(mapping)
	if err != nil {
		return 0, fmt.Errorf("failed to marshal mapping: %w", err)
	}
	return database.SaveColumnMapping(name, string(bytes))
}

// DeleteColumnMapping deletes a column mapping by ID
func (a *App) DeleteColumnMapping(id int64) error {
	return database.DeleteColumnMapping(id)
}

// GetUncategorizedTransactions returns transactions that need categorization
func (a *App) GetUncategorizedTransactions() ([]database.TransactionModel, error) {
	return database.GetUncategorizedTransactions()
}

// CategorizeTransaction updates a single transaction's category
func (a *App) CategorizeTransaction(id int64, categoryName string) error {
	if strings.TrimSpace(categoryName) == "" {
		return database.UpdateTransactionCategory(id, 0)
	}
	catID, err := database.GetOrCreateCategory(categoryName)
	if err != nil {
		return err
	}
	return database.UpdateTransactionCategory(id, catID)
}

// RenameCategory renames an existing category
func (a *App) RenameCategory(id int64, newName string) error {
	return database.RenameCategory(id, newName)
}

// SaveCategorizationRule saves a new rule and applies it to existing uncategorized transactions
func (a *App) SaveCategorizationRule(rule database.CategorizationRule) (int64, error) {
	if rule.CategoryID == 0 && rule.CategoryName != "" {
		id, err := database.GetOrCreateCategory(rule.CategoryName)
		if err != nil {
			return 0, err
		}
		rule.CategoryID = id
	}
	id, err := database.SaveRule(rule)
	if err != nil {
		return 0, err
	}
	// Auto-apply rule immediately
	_, _ = database.ApplyRule(id)
	return id, nil
}

// GetCategorizationRulesCount returns the number of existing categorization rules
func (a *App) GetCategorizationRulesCount() (int, error) {
	return database.GetRulesCount()
}

// FuzzySearch ranks items based on the query using fzf algorithm
func (a *App) FuzzySearch(query string, items []string) []string {
	return fuzzy.Match(query, items)
}

// SearchCategories returns suggestions for categories
func (a *App) SearchCategories(query string) ([]database.Category, error) {
	return database.SearchCategories(query)
}

// GetCategories returns all categories
func (a *App) GetCategories() ([]database.Category, error) {
	return database.GetAllCategories()
}

// GetAccounts returns all accounts
func (a *App) GetAccounts() ([]string, error) {
	return database.GetAccounts()
}

// GetOwners returns all users/owners
func (a *App) GetOwners() ([]string, error) {
	return database.GetUsers()
}

// CreateAccount ensures an account exists
func (a *App) CreateAccount(name string) (int64, error) {
	return database.GetOrCreateAccount(name)
}

// CreateOwner ensures a user/owner exists
func (a *App) CreateOwner(name string) (int64, error) {
	res, err := database.GetOrCreateUser(name)
	if err != nil {
		return 0, err
	}
	if res == nil {
		return 0, fmt.Errorf("failed to create owner")
	}
	return *res, nil
}

// SearchTransactions returns transactions matching the criteria
func (a *App) SearchTransactions(descriptionMatch string, matchType string, amountMin *float64, amountMax *float64) ([]database.TransactionModel, error) {
	return database.SearchTransactions(descriptionMatch, matchType, amountMin, amountMax)
}

// GetMonthList returns unique year-month strings
func (a *App) GetMonthList() ([]string, error) {
	return database.GetMonthList()
}

// GetAnalysisTransactions returns transactions for a date range and optional category filter
func (a *App) GetAnalysisTransactions(startDate string, endDate string, categoryIDs []int64) ([]database.TransactionModel, error) {
	return database.GetAnalysisTransactions(startDate, endDate, categoryIDs)
}

type ExcelData struct {
	Headers []string   `json:"headers"`
	Rows    [][]string `json:"rows"`
}

// ParseExcel parses an Excel file from base64 string
func (a *App) ParseExcel(base64Data string) (*ExcelData, error) {
	// Remove data URL prefix if present
	if idx := strings.Index(base64Data, ";base64,"); idx != -1 {
		base64Data = base64Data[idx+8:]
	}

	data, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		return nil, fmt.Errorf("failed to decode base64: %w", err)
	}

	reader := strings.NewReader(string(data))
	f, err := excelize.OpenReader(reader)
	if err != nil {
		return nil, fmt.Errorf("failed to open excel: %w", err)
	}
	defer f.Close()

	// Get first sheet
	sheetName := f.GetSheetName(0)
	if sheetName == "" {
		return nil, fmt.Errorf("no sheets found in excel file")
	}

	rows, err := f.GetRows(sheetName)
	if err != nil {
		return nil, fmt.Errorf("failed to get rows from sheet %s: %w", sheetName, err)
	}

	if len(rows) == 0 {
		return nil, fmt.Errorf("excel file is empty")
	}

	headers := rows[0]
	var dataRows [][]string
	if len(rows) > 1 {
		dataRows = rows[1:]
	} else {
		dataRows = [][]string{}
	}

	// Clean headers (remove leading/trailing whitespace)
	for i, h := range headers {
		headers[i] = strings.TrimSpace(h)
	}

	// Ensure all rows have the same length as headers
	for i, row := range dataRows {
		if len(row) < len(headers) {
			newRow := make([]string, len(headers))
			copy(newRow, row)
			dataRows[i] = newRow
		} else if len(row) > len(headers) {
			dataRows[i] = row[:len(headers)]
		}
	}

	return &ExcelData{
		Headers: headers,
		Rows:    dataRows,
	}, nil
}
