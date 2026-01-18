package cli

import (
	"cashmop/internal/database"
	"cashmop/internal/version"
	"fmt"
	"os"
)

type commandResult struct {
	Response any
	Err      *cliError
	Help     bool
}

func Run(args []string) int {
	global, rest, err := parseGlobalFlags(args)
	if err != nil {
		writeJSON(os.Stdout, errorResponse{Ok: false, Errors: []ErrorDetail{{Message: err.Error()}}})
		return 2
	}

	if global.Version {
		fmt.Fprintln(os.Stdout, version.Version)
		return 0
	}

	if len(rest) == 0 {
		if global.Help {
			printHelp("")
			return 0
		}
		writeJSON(os.Stdout, errorResponse{Ok: false, Errors: []ErrorDetail{{Message: "Missing subcommand."}}})
		return 2
	}

	if rest[0] == "help" {
		if len(rest) > 1 {
			printHelp(rest[1])
			return 0
		}
		printHelp("")
		return 0
	}

	if global.Help {
		printHelp(rest[0])
		return 0
	}

	if requiresDB(rest[0]) {
		database.SuppressLogs = true
		if err := database.InitDBWithPath(global.DBPath); err != nil {
			writeJSON(os.Stdout, errorResponse{Ok: false, Errors: []ErrorDetail{{Message: fmt.Sprintf("Unable to open database: %s", err.Error())}}})
			return 1
		}
		defer database.Close()
	}

	var result commandResult
	switch rest[0] {
	case "import":
		result = handleImport(rest[1:])
	case "mappings":
		result = handleMappings(rest[1:])
	case "tx":
		result = handleTransactions(rest[1:])
	case "categories":
		result = handleCategories(rest[1:])
	case "rules":
		result = handleRules(rest[1:])
	case "export":
		result = handleExport(rest[1:])
	case "backup":
		result = handleBackup(rest[1:])
	case "settings":
		result = handleSettings(rest[1:])
	case "fx":
		result = handleFx(rest[1:])
	case "install-cli":
		result = handleInstallCli(rest[1:])
	case "uninstall-cli":
		result = handleUninstallCli(rest[1:])
	default:
		writeJSON(os.Stdout, errorResponse{Ok: false, Errors: []ErrorDetail{{Message: fmt.Sprintf("Unknown command: %s", rest[0])}}})
		return 2
	}

	if result.Help {
		return 0
	}
	if result.Err != nil {
		writeJSON(os.Stdout, errorResponse{Ok: false, Errors: result.Err.Errors})
		return result.Err.Code
	}
	if result.Response != nil {
		if err := writeJSON(os.Stdout, result.Response); err != nil {
			return 1
		}
	}
	return 0
}

func requiresDB(command string) bool {
	switch command {
	case "install-cli", "uninstall-cli":
		return false
	default:
		return true
	}
}
