package cli

import (
	"fmt"
	"os"
	"strings"
)

func printHelp(command string) {
	switch command {
	case "import":
		fmt.Fprintln(os.Stdout, importHelp())
	case "mappings":
		fmt.Fprintln(os.Stdout, mappingsHelp())
	case "tx":
		fmt.Fprintln(os.Stdout, txHelp())
	case "categories":
		fmt.Fprintln(os.Stdout, categoriesHelp())
	case "rules":
		fmt.Fprintln(os.Stdout, rulesHelp())
	case "export":
		fmt.Fprintln(os.Stdout, exportHelp())
	case "backup":
		fmt.Fprintln(os.Stdout, backupHelp())
	case "settings":
		fmt.Fprintln(os.Stdout, settingsHelp())
	case "fx":
		fmt.Fprintln(os.Stdout, fxHelp())
	case "install-cli":
		fmt.Fprintln(os.Stdout, installCliHelp())
	case "uninstall-cli":
		fmt.Fprintln(os.Stdout, uninstallCliHelp())
	case "":
		fmt.Fprintln(os.Stdout, rootHelp())
	default:
		fmt.Fprintln(os.Stdout, rootHelp())
	}
}

func rootHelp() string {
	var b strings.Builder
	b.WriteString("CashMop CLI\n\n")
	b.WriteString("Usage:\n")
	b.WriteString("  cashmop [global flags] <subcommand> [args]\n")
	b.WriteString("\n")
	b.WriteString("Notes:\n")
	b.WriteString("  - Global flags must appear before <subcommand> (Go flag parsing stops at the first non-flag).\n")
	b.WriteString("  - All non-help output goes to stdout (stderr is empty). Default output is JSON.\n")
	b.WriteString("  - Global --format is json|table. table works for: categories list, tx list, rules list.\n")
	b.WriteString("  - export has its own --format csv|xlsx (after the export subcommand).\n")
	b.WriteString("\n")
	b.WriteString("Global flags:\n")
	b.WriteString("  -h, --help           Show help\n")
	b.WriteString("  --version            Show version\n")
	b.WriteString("  --db <path>          Path to SQLite DB (omit for default app DB)\n")
	b.WriteString("  --format json|table  Output format (default: json)\n")
	b.WriteString("\n")
	b.WriteString("Help forms:\n")
	b.WriteString("  cashmop help\n")
	b.WriteString("  cashmop help <subcommand>\n")
	b.WriteString("  cashmop <subcommand> --help\n")
	b.WriteString("\n")
	b.WriteString("Commands (expanded):\n\n")
	b.WriteString("[import]\n")
	b.WriteString(importHelp())
	b.WriteString("\n\n[mappings]\n")
	b.WriteString(mappingsHelp())
	b.WriteString("\n\n[tx]\n")
	b.WriteString(txHelp())
	b.WriteString("\n\n[categories]\n")
	b.WriteString(categoriesHelp())
	b.WriteString("\n\n[rules]\n")
	b.WriteString(rulesHelp())
	b.WriteString("\n\n[export]\n")
	b.WriteString(exportHelp())
	b.WriteString("\n\n[backup]\n")
	b.WriteString(backupHelp())
	b.WriteString("\n\n[settings]\n")
	b.WriteString(settingsHelp())
	b.WriteString("\n\n[fx]\n")
	b.WriteString(fxHelp())
	b.WriteString("\n\n[install-cli]\n")
	b.WriteString(installCliHelp())
	b.WriteString("\n\n[uninstall-cli]\n")
	b.WriteString(uninstallCliHelp())
	return strings.TrimSpace(b.String())
}

func importHelp() string {
	return strings.TrimSpace(`Usage:
  cashmop import --file <path> --mapping <path|name|-> [--month YYYY-MM ...] [--dry-run] [--no-apply-rules]

Flags:
  --file <path>          Import CSV/XLSX file
  --mapping <path|name|->  Mapping file path, saved mapping name, or - for stdin
  --month YYYY-MM        Repeat to select months
  --dry-run              Parse/validate only
  --no-apply-rules       Skip rule application`)
}

func mappingsHelp() string {
	return strings.TrimSpace(`Usage:
  cashmop mappings list
  cashmop mappings get --name <name> | --id <id>
  cashmop mappings save --name <name> --mapping <path|->
  cashmop mappings delete --name <name> | --id <id>`)
}

func txHelp() string {
	return strings.TrimSpace(`Usage:
  cashmop tx list [--start YYYY-MM-DD --end YYYY-MM-DD] [--uncategorized] [--category-ids 1,2] [--query "..."] [--amount-min "12.34"] [--amount-max "99.99"] [--sort date|amount] [--order asc|desc]
  cashmop tx categorize --id <id> --category <name>
  cashmop tx categorize --id <id> --uncategorize`)
}

func categoriesHelp() string {
	return strings.TrimSpace(`Usage:
  cashmop categories list
  cashmop categories rename --id <id> --name <new>
  cashmop categories create --name <name>`)
}

func rulesHelp() string {
	return strings.TrimSpace(`Usage:
  cashmop rules list
  cashmop rules preview --match-value <v> --match-type <starts_with|ends_with|contains|exact> [--amount-min "..."] [--amount-max "..."]
  cashmop rules create --match-value <v> --match-type <...> [--amount-min "..."] [--amount-max "..."] --category <name>
  cashmop rules update --id <id> [--match-value <v>] [--match-type <...>] [--amount-min "..."] [--amount-max "..."] [--category <name>] [--recategorize]
  cashmop rules delete --id <id> [--uncategorize]`)
}

func exportHelp() string {
	return strings.TrimSpace(`Usage:
  cashmop export --start YYYY-MM-DD --end YYYY-MM-DD --format csv|xlsx --out <path> [--category-ids 1,2]`)
}

func backupHelp() string {
	return strings.TrimSpace(`Usage:
  cashmop backup create [--out <path>]
  cashmop backup info
  cashmop backup validate --file <path>
  cashmop backup restore --file <path>`)
}

func settingsHelp() string {
	return strings.TrimSpace(`Usage:
  cashmop settings get
  cashmop settings set --main-currency <ISO>`)
}

func fxHelp() string {
	return strings.TrimSpace(`Usage:
  cashmop fx status
  cashmop fx sync
  cashmop fx rate --base <ISO> --quote <ISO> --date YYYY-MM-DD`)
}

func installCliHelp() string {
	return strings.TrimSpace(`Usage:
  cashmop install-cli [--path <dir>]

Flags:
  --path <dir>   Install target directory (default: /usr/local/bin if writable, otherwise ~/.local/bin)`)
}

func uninstallCliHelp() string {
	return strings.TrimSpace(`Usage:
  cashmop uninstall-cli [--path <dir>]

Flags:
  --path <dir>   Directory containing the installed shim (default: /usr/local/bin or ~/.local/bin)`)
}
