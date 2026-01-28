package cashmop

import (
	"context"
	"strings"

	"github.com/default-anton/cashmop/internal/database"
	"github.com/default-anton/cashmop/internal/fx"
)

func (s *Service) GetFxRate(baseCurrency, quoteCurrency, date string) (*database.FxRateLookup, error) {
	return s.store.GetFxRate(baseCurrency, quoteCurrency, date)
}

func (s *Service) GetFxRateStatus(baseCurrency string) (database.FxRateStatus, error) {
	return s.store.GetFxRateStatus(baseCurrency)
}

func (s *Service) ConvertAmount(amount int64, baseCurrency, quoteCurrency, date string) (*int64, error) {
	return s.store.ConvertAmount(amount, baseCurrency, quoteCurrency, date)
}

func (s *Service) SyncFxRates(ctx context.Context, baseCurrency string) (fx.SyncResult, error) {
	if err := fx.EnsureProviderSupported(baseCurrency); err != nil {
		return fx.SyncResult{}, err
	}
	return fx.SyncRates(ctx, s.store, strings.TrimSpace(baseCurrency))
}

func (s *Service) SyncFxRatesForMainCurrency(ctx context.Context) (fx.SyncResult, error) {
	settings, err := s.store.GetCurrencySettings()
	if err != nil {
		return fx.SyncResult{}, err
	}
	base := strings.TrimSpace(settings.MainCurrency)
	if base == "" {
		base = database.DefaultCurrency()
	}
	return s.SyncFxRates(ctx, base)
}
