package cli

import (
	"cashmop/internal/database"
	"flag"
	"io"
)

type settingsResponse struct {
	Ok       bool                      `json:"ok"`
	Settings database.CurrencySettings `json:"settings"`
}

func handleSettings(args []string) commandResult {
	if len(args) == 0 {
		return commandResult{Err: validationError(ErrorDetail{Message: "Missing settings subcommand (get, set)."}) }
	}

	switch args[0] {
	case "get":
		return handleSettingsGet(args[1:])
	case "set":
		return handleSettingsSet(args[1:])
	default:
		return commandResult{Err: validationError(ErrorDetail{Message: "Unknown settings subcommand."}) }
	}
}

func handleSettingsGet(args []string) commandResult {
	fs := flag.NewFlagSet("settings get", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	var help bool
	fs.BoolVar(&help, "help", false, "")
	fs.BoolVar(&help, "h", false, "")
	if err := fs.Parse(args); err != nil {
		return commandResult{Err: validationError(ErrorDetail{Message: err.Error()})}
	}
	if help {
		printHelp("settings")
		return commandResult{Help: true}
	}

	settings, err := database.GetCurrencySettings()
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	return commandResult{Response: settingsResponse{Ok: true, Settings: settings}}
}

func handleSettingsSet(args []string) commandResult {
	fs := flag.NewFlagSet("settings set", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	var help bool
	var mainCurrency string
	fs.BoolVar(&help, "help", false, "")
	fs.BoolVar(&help, "h", false, "")
	fs.StringVar(&mainCurrency, "main-currency", "", "")
	if err := fs.Parse(args); err != nil {
		return commandResult{Err: validationError(ErrorDetail{Message: err.Error()})}
	}
	if help {
		printHelp("settings")
		return commandResult{Help: true}
	}

	settings, err := database.GetCurrencySettings()
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	if mainCurrency != "" {
		settings.MainCurrency = mainCurrency
	}

	updated, err := database.UpdateCurrencySettings(settings)
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	return commandResult{Response: settingsResponse{Ok: true, Settings: updated}}
}
