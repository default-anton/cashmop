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

	// Cache lookups to minimize DB hits if many rows share the same account/owner
	accountCache := make(map[string]int64)
	userCache := make(map[string]*int64)

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

		txModels = append(txModels, database.TransactionModel{
			AccountID:   accID,
			OwnerID:     ownerID,
			Date:        t.Date,
			Description: t.Description,
			Amount:      t.Amount,
			Category:    t.Category,
			Currency:    "CAD", // Default or passed in? For now default as per plan/schema
		})
	}

	return database.BatchInsertTransactions(txModels)
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
