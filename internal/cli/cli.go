package cli

import (
	"fmt"
	"io"
	"log/slog"
	"os"

	"github.com/default-anton/cashmop/internal/cashmop"
	"github.com/default-anton/cashmop/internal/database"
	"github.com/default-anton/cashmop/internal/version"
)

type commandResult struct {
	Response any
	Err      *cliError
	Help     bool
}

func Run(args []string) int {
	global, rest, err := parseGlobalFlags(args)
	if err != nil {
		return writeCLIError(os.Stdout, err, "json")
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
		return writeCLIError(os.Stdout, validationError(ErrorDetail{
			Field:   "subcommand",
			Message: "Missing subcommand.",
			Hint:    "Run \"cashmop help\" to list available commands.",
		}), global.Format)
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

	var store *database.Store
	var svc *cashmop.Service
	if requiresDB(rest[0]) {
		logger := slog.New(slog.NewTextHandler(io.Discard, nil))
		opened, err := database.Open(global.DBPath, logger)
		if err != nil {
			return writeCLIError(os.Stdout, runtimeError(ErrorDetail{
				Field:   "db",
				Message: fmt.Sprintf("Unable to open database: %s", err.Error()),
				Hint:    "Provide a valid --db path or omit it to use the default database.",
			}), global.Format)
		}
		store = opened
		svc = cashmop.New(store)
		defer store.Close()
	}

	var result commandResult
	switch rest[0] {
	case "import":
		result = handleImport(svc, rest[1:])
	case "mappings":
		result = handleMappings(svc, rest[1:])
	case "tx":
		result = handleTransactions(svc, rest[1:])
	case "categories":
		result = handleCategories(svc, rest[1:])
	case "rules":
		result = handleRules(svc, rest[1:])
	case "export":
		result = handleExport(svc, rest[1:])
	case "backup":
		result = handleBackup(svc, rest[1:])
	case "settings":
		result = handleSettings(svc, rest[1:])
	case "fx":
		result = handleFx(svc, rest[1:])
	case "install-cli":
		result = handleInstallCli(rest[1:])
	case "uninstall-cli":
		result = handleUninstallCli(rest[1:])
	default:
		result = commandResult{Err: validationError(ErrorDetail{
			Field:   "subcommand",
			Message: fmt.Sprintf("Unknown command: %s.", rest[0]),
			Hint:    "Run \"cashmop help\" to list available commands.",
		})}
	}

	if result.Help {
		return 0
	}
	if result.Err != nil {
		return writeCLIError(os.Stdout, result.Err, global.Format)
	}
	if result.Response != nil {
		if err := writeResponse(os.Stdout, result.Response, global.Format); err != nil {
			return 1
		}
	}
	return 0
}

func writeCLIError(out io.Writer, err *cliError, format string) int {
	if err == nil {
		return 0
	}
	if wErr := writeResponse(out, errorResponse{Ok: false, Errors: err.Errors}, format); wErr != nil {
		return 1
	}
	return err.Code
}

func requiresDB(command string) bool {
	switch command {
	case "install-cli", "uninstall-cli":
		return false
	default:
		return true
	}
}
