package cashmop

import "github.com/default-anton/cashmop/internal/database"

func (s *Service) GetCurrencySettings() (database.CurrencySettings, error) {
	return s.store.GetCurrencySettings()
}

func (s *Service) UpdateCurrencySettings(settings database.CurrencySettings) (database.CurrencySettings, error) {
	return s.store.UpdateCurrencySettings(settings)
}
