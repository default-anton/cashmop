package main

import (
	"github.com/default-anton/cashmop/internal/database"
)

func (a *App) GetCurrencySettings() (database.CurrencySettings, error) {
	return a.svc.GetCurrencySettings()
}

func (a *App) UpdateCurrencySettings(settings database.CurrencySettings) (database.CurrencySettings, error) {
	return a.svc.UpdateCurrencySettings(settings)
}

func (a *App) GetFxRate(baseCurrency, quoteCurrency, date string) (*database.FxRateLookup, error) {
	return a.svc.GetFxRate(baseCurrency, quoteCurrency, date)
}

func (a *App) GetFxRateStatus() (database.FxRateStatus, error) {
	settings, err := a.svc.GetCurrencySettings()
	if err != nil {
		return database.FxRateStatus{}, err
	}
	return a.svc.GetFxRateStatus(settings.MainCurrency)
}
