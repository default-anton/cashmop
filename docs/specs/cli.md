# CLI Spec

## Context
- AI coding agents + local automation need full app access.
- CLI ships with desktop app, targets headless workflows.
- Core use case: import → categorize → analyze/export without UI.

## Goals
- Non-interactive, JSON-only responses.
- Full parity with GUI workflows.
- Stable, agent-friendly error contracts.
- Safe alongside GUI (shared DB, WAL).

## Name + One-Liner
- `cashmop`: CashMop CLI for automated data operations.

## Usage
- `cashmop [global flags] <subcommand> [args]`

## Help
- Per-subcommand help required.
- Supported forms:
  - `cashmop help <subcommand>`
  - `cashmop <subcommand> --help` (or `-h`)

## Global Flags
- `-h, --help`: text help for LLM/AI agents (primary) and humans.
- `--version`: print version.

## Output Contract
- stdout: JSON success payloads only.
- stderr: JSON error payloads only.
- JSON envelope:
  - success: `{"ok":true,"data":<payload>}`
  - error: `{"ok":false,"errors":[{"code":"...","message":"...","field":"optional.path"}]}`

## Exit Codes
- `0` success
- `1` runtime failure
- `2` invalid usage/validation

## Environment
- DB path auto-resolved via app config dir.
- `APP_ENV=dev|test` selects dev/test DB.
- `CASHMOP_WORKER_ID` suffix for test DB.

## Safety
- No prompts or confirmations.
- Destructive actions require explicit flags (e.g. `--uncategorize`).

## Command Tree
- `import`
- `mappings`
- `tx`
- `categories`
- `rules`
- `analysis`
- `export`
- `backup`
- `settings`

## Subcommands

### `import`
- `cashmop import --file <path> --mapping <path|name|-> [--month YYYY-MM] [--dry-run]`
- `--mapping` accepts:
  - saved mapping name
  - JSON file path
  - `-` to read JSON from stdin
- `--dry-run` parses + validates only, no writes.

#### Mapping JSON Schema
- `csv.date` string header name
- `csv.description` array of header names
- `csv.amountMapping` one of:
  - `{"type":"single","column":"Amount"}`
  - `{"type":"debitCredit","debitColumn":"Debit","creditColumn":"Credit"}`
  - `{"type":"amountWithType","amountColumn":"Amount","typeColumn":"Type","negativeValue":"debit","positiveValue":"credit"}`
- `account` static account name
- `defaultOwner` optional
- `currencyDefault` ISO currency when no column

#### `cashmop help import` (expected output)
```
Import CSV/XLSX with an explicit mapping. Non-interactive.

Required:
  --file <path>
  --mapping <path|name|->

Optional:
  --month YYYY-MM   Override month selection
  --dry-run         Validate + parse only

Mapping JSON:
  csv.date           string
  csv.description    string[]
  csv.amountMapping  {type:single|debitCredit|amountWithType, ...}
  account            string
  defaultOwner       string (optional)
  currencyDefault    string

Examples:
  cashmop import --file ./bank.csv --mapping ./mapping.json --dry-run
  cashmop import --file ./bank.csv --mapping "BMO CSV"
  cat mapping.json | cashmop import --file ./bank.csv --mapping -
```

### `mappings`
- `cashmop mappings list`
- `cashmop mappings get --name <name>`
- `cashmop mappings save --name <name> --mapping <path|->`
- `cashmop mappings delete --name <name>`

### `tx`
- `cashmop tx list [--uncategorized] [--start YYYY-MM-DD] [--end YYYY-MM-DD] [--category-ids 1,2]`
- `cashmop tx categorize --id <id> --category <name|empty>`

### `categories`
- `cashmop categories list`
- `cashmop categories rename --id <id> --name <new>`
- `cashmop categories create --name <name>`

### `rules`
- `cashmop rules list`
- `cashmop rules preview --match-value <v> --match-type <starts|ends|contains|exact> [--amount-min <cents>] [--amount-max <cents>]`
- `cashmop rules create --match-value <v> --match-type <...> [--amount-min ...] [--amount-max ...] --category <name>`
- `cashmop rules update --id <id> [--recategorize] ...`
- `cashmop rules delete --id <id> [--uncategorize]`

### `analysis`
- `cashmop analysis list --start YYYY-MM-DD --end YYYY-MM-DD [--category-ids 1,2]`

### `export`
- `cashmop export --start YYYY-MM-DD --end YYYY-MM-DD --format csv|xlsx --out <path> [--category-ids 1,2]`

### `backup`
- `cashmop backup create`
- `cashmop backup info`
- `cashmop backup restore --file <path>`

### `settings`
- `cashmop settings get`
- `cashmop settings set --main-currency <ISO>`

## Error Codes (suggested)
- `invalid-arg`: missing/invalid flag or value
- `not-found`: mapping, rule, transaction, or file not found
- `conflict`: concurrency/lock conflict
- `io`: file read/write failures
- `db`: database query failure

## Examples
- `cashmop tx list --uncategorized`
- `cashmop tx categorize --id 123 --category "Groceries"`
- `cashmop rules preview --match-value "Starbucks" --match-type contains`
- `cashmop export --start 2025-01-01 --end 2025-01-31 --format csv --out ./cashmop_2025-01.csv`
- `cashmop backup create`
