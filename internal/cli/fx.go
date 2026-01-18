package cli

import (
	"cashmop/internal/database"
	"cashmop/internal/fx"
	"context"
)

type fxStatusResponse struct {
	Ok bool `json:"ok"`
	database.FxRateStatus
}

type fxRateResponse struct {
	Ok       bool    `json:"ok"`
	RateDate string  `json:"rate_date"`
	Rate     float64 `json:"rate"`
	Source   string  `json:"source"`
}

func handleFx(args []string) commandResult {
	if len(args) == 0 {
		return commandResult{Err: validationError(ErrorDetail{Message: "Missing fx subcommand (status, sync, rate)."})}
	}

	switch args[0] {
	case "status":
		return handleFxStatus(args[1:])
	case "sync":
		return handleFxSync(args[1:])
	case "rate":
		return handleFxRate(args[1:])
	default:
		return commandResult{Err: validationError(ErrorDetail{Message: "Unknown fx subcommand."})}
	}
}

func handleFxStatus(args []string) commandResult {
	fs := newSubcommandFlagSet("fx status")
	if ok, res := fs.parse(args, "fx"); !ok {
		return res
	}

	settings, err := database.GetCurrencySettings()
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	status, err := database.GetFxRateStatus(settings.MainCurrency)
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	return commandResult{Response: fxStatusResponse{Ok: true, FxRateStatus: status}}
}

func handleFxSync(args []string) commandResult {
	fs := newSubcommandFlagSet("fx sync")
	if ok, res := fs.parse(args, "fx"); !ok {
		return res
	}

	settings, err := database.GetCurrencySettings()
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	_, err = fx.SyncRates(context.Background(), settings.MainCurrency)
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	return commandResult{Response: map[string]bool{"ok": true}}
}

func handleFxRate(args []string) commandResult {
	fs := newSubcommandFlagSet("fx rate")
	var base string
	var quote string
	var date string
	fs.StringVar(&base, "base", "", "")
	fs.StringVar(&quote, "quote", "", "")
	fs.StringVar(&date, "date", "", "")
	if ok, res := fs.parse(args, "fx"); !ok {
		return res
	}

	if base == "" || quote == "" || date == "" {
		return commandResult{Err: validationError(ErrorDetail{Message: "--base, --quote, and --date are required."})}
	}

	rate, err := database.GetFxRate(base, quote, date)
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}
	if rate == nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: "No rate found for the given criteria."})}
	}

	return commandResult{Response: fxRateResponse{
		Ok:       true,
		RateDate: rate.RateDate,
		Rate:     rate.Rate,
		Source:   rate.Source,
	}}
}
