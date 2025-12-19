package main

import (
	"cashflow/internal/database"
	"context"
	"encoding/json"
	"fmt"
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

// SearchCategories returns suggestions for categories
func (a *App) SearchCategories(query string) ([]database.Category, error) {
	return database.SearchCategories(query)
}

// GetCategories returns all categories
func (a *App) GetCategories() ([]database.Category, error) {
	return database.GetAllCategories()
}
