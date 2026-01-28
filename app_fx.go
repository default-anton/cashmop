package main

import (
	"errors"
	"fmt"
	"log"

	"github.com/default-anton/cashmop/internal/fx"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

func (a *App) SyncFxRates() error {
	go a.syncFxRates()
	return nil
}

func (a *App) SyncFxRatesNow() error {
	_, err := a.syncFxRatesInternal(true)
	return err
}

func (a *App) syncFxRatesInternal(emit bool) (fx.SyncResult, error) {
	if a.ctx == nil {
		return fx.SyncResult{}, fmt.Errorf("app context not initialized")
	}
	result, err := a.svc.SyncFxRatesForMainCurrency(a.ctx)
	if err != nil {
		return fx.SyncResult{}, err
	}
	if emit {
		wailsRuntime.EventsEmit(a.ctx, "fx-rates-updated", result)
	}
	return result, nil
}

func (a *App) syncFxRates() {
	if _, err := a.syncFxRatesInternal(true); err != nil {
		if errors.Is(err, fx.ErrProviderUnsupported) {
			log.Printf("FX sync unsupported: %v", err)
			return
		}
		log.Printf("FX sync failed: %v", err)
	}
}
