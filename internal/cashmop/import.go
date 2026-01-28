package cashmop

import (
	"fmt"
	"strings"

	"github.com/default-anton/cashmop/internal/database"
)

type TransactionImportInput struct {
	Date        string
	Description string
	Amount      int64
	Category    string
	Account     string
	Owner       string
	Currency    string
}

type ImportOptions struct {
	ApplyRules bool
}

func (s *Service) ImportTransactions(transactions []TransactionImportInput, opts ImportOptions) error {
	if len(transactions) == 0 {
		return nil
	}

	var txModels []database.TransactionModel

	accountCache := make(map[string]int64)
	userCache := make(map[string]*int64)
	categoryCache := make(map[string]int64)
	settings, err := s.store.GetCurrencySettings()
	if err != nil {
		return err
	}
	defaultCurrency := strings.ToUpper(strings.TrimSpace(settings.MainCurrency))
	if defaultCurrency == "" {
		defaultCurrency = database.DefaultCurrency()
	}

	for _, t := range transactions {
		accKey := strings.TrimSpace(t.Account)
		accID, ok := accountCache[accKey]
		if !ok {
			id, err := s.store.GetOrCreateAccount(accKey)
			if err != nil {
				return fmt.Errorf("Unable to process account '%s'. Please check the file format.", t.Account)
			}
			accID = id
			accountCache[accKey] = accID
		}

		var ownerID *int64
		ownerKey := strings.TrimSpace(t.Owner)
		if ownerKey != "" {
			cached, ok := userCache[ownerKey]
			if !ok {
				id, err := s.store.GetOrCreateUser(ownerKey)
				if err != nil {
					return fmt.Errorf("Unable to process owner '%s'. Please check the file format.", t.Owner)
				}
				ownerID = id
				userCache[ownerKey] = ownerID
			} else {
				ownerID = cached
			}
		}

		var catID *int64
		catKey := strings.TrimSpace(t.Category)
		if catKey != "" {
			id, ok := categoryCache[catKey]
			if !ok {
				id2, err := s.store.GetOrCreateCategory(catKey)
				if err != nil {
					return fmt.Errorf("Unable to process category '%s'. Please check the file format.", t.Category)
				}
				id = id2
				categoryCache[catKey] = id
			}
			idCopy := id
			catID = &idCopy
		}

		currency := strings.ToUpper(strings.TrimSpace(t.Currency))
		if currency == "" {
			currency = defaultCurrency
		}

		txModels = append(txModels, database.TransactionModel{
			AccountID:   accID,
			OwnerID:     ownerID,
			Date:        t.Date,
			Description: t.Description,
			Amount:      t.Amount,
			CategoryID:  catID,
			Currency:    currency,
		})
	}

	if err := s.store.BatchInsertTransactions(txModels); err != nil {
		return err
	}

	if opts.ApplyRules {
		if _, err := s.store.ApplyAllRules(); err != nil {
			return err
		}
	}

	s.store.ClearFxRateCache()

	return nil
}
