package main

import (
	"errors"
	"log"

	"github.com/default-anton/cashmop/internal/cashmop"
	"github.com/default-anton/cashmop/internal/fx"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

func (a *App) ImportTransactions(transactions []TransactionInput) error {
	inputs := make([]cashmop.TransactionImportInput, 0, len(transactions))
	for _, t := range transactions {
		inputs = append(inputs, cashmop.TransactionImportInput{
			Date:        t.Date,
			Description: t.Description,
			Amount:      t.Amount,
			Category:    t.Category,
			Account:     t.Account,
			Owner:       t.Owner,
			Currency:    t.Currency,
		})
	}

	if err := a.svc.ImportTransactions(inputs, cashmop.ImportOptions{ApplyRules: true}); err != nil {
		return err
	}

	if !isTestEnv() {
		if _, err := a.syncFxRatesInternal(false); err != nil {
			if errors.Is(err, fx.ErrProviderUnsupported) {
				log.Printf("FX sync skipped after import: %v", err)
			} else {
				log.Printf("FX sync failed after import: %v", err)
				if a.ctx != nil {
					wailsRuntime.EventsEmit(a.ctx, "fx-rates-sync-failed", "Couldn't fetch exchange rates just now. Try syncing again in Settings.")
				}
			}
		}
	}

	return nil
}
