package cli

import (
	"github.com/default-anton/cashmop/internal/cashmop"
	"github.com/default-anton/cashmop/internal/database"
)

type settingsResponse struct {
	Ok       bool                      `json:"ok"`
	Settings database.CurrencySettings `json:"settings"`
}

func handleSettings(svc *cashmop.Service, args []string) commandResult {
	if len(args) == 0 {
		return commandResult{Err: validationError(ErrorDetail{
			Field:   "subcommand",
			Message: "Missing settings subcommand (get, set).",
			Hint:    "Use \"cashmop settings get\" or \"cashmop settings set\".",
		})}
	}

	switch args[0] {
	case "get":
		return handleSettingsGet(svc, args[1:])
	case "set":
		return handleSettingsSet(svc, args[1:])
	default:
		return commandResult{Err: validationError(ErrorDetail{
			Field:   "subcommand",
			Message: "Unknown settings subcommand.",
			Hint:    "Use \"cashmop settings get\" or \"cashmop settings set\".",
		})}
	}
}

func handleSettingsGet(svc *cashmop.Service, args []string) commandResult {
	fs := newSubcommandFlagSet("settings get")
	if ok, res := fs.parse(args, "settings"); !ok {
		return res
	}

	settings, err := svc.GetCurrencySettings()
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	return commandResult{Response: settingsResponse{Ok: true, Settings: settings}}
}

func handleSettingsSet(svc *cashmop.Service, args []string) commandResult {
	fs := newSubcommandFlagSet("settings set")
	var mainCurrency string
	fs.StringVar(&mainCurrency, "main-currency", "", "")
	if ok, res := fs.parse(args, "settings"); !ok {
		return res
	}

	settings, err := svc.GetCurrencySettings()
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	if mainCurrency != "" {
		settings.MainCurrency = mainCurrency
	}

	updated, err := svc.UpdateCurrencySettings(settings)
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	return commandResult{Response: settingsResponse{Ok: true, Settings: updated}}
}
