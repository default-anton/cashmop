package main

import (
	"context"
	"errors"
	"fmt"
	"log"

	"github.com/default-anton/cashmop/internal/fx"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

func (a *App) SyncFxRates() error {
	ctx := a.bgCtx
	if ctx == nil {
		ctx = a.ctx
	}
	go a.syncFxRates(ctx)
	return nil
}

func (a *App) SyncFxRatesNow() error {
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	_, err := a.syncFxRatesInternal(ctx, true)
	return err
}

func (a *App) syncFxRatesInternal(ctx context.Context, emit bool) (fx.SyncResult, error) {
	if a.svc == nil {
		return fx.SyncResult{}, fmt.Errorf("service not initialized")
	}

	runCtx := ctx
	if runCtx == nil {
		runCtx = context.Background()
	}

	result, err := a.svc.SyncFxRatesForMainCurrency(runCtx)
	if err != nil {
		return fx.SyncResult{}, err
	}

	if emit && a.ctx != nil {
		wailsRuntime.EventsEmit(a.ctx, "fx-rates-updated", result)
	}

	return result, nil
}

func (a *App) syncFxRates(ctx context.Context) {
	if _, err := a.syncFxRatesInternal(ctx, true); err != nil {
		if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
			return
		}
		if errors.Is(err, fx.ErrProviderUnsupported) {
			log.Printf("FX sync unsupported: %v", err)
			return
		}
		log.Printf("FX sync failed: %v", err)
	}
}
