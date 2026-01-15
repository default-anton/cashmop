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

## Environment + Config
- DB path auto-resolved via OS config dir (`$XDG_CONFIG_HOME`/`~/.config` on Linux, `~/Library/Application Support` on macOS, `%LOCALAPPDATA%` on Windows).
- `APP_ENV=dev|test` selects dev/test DB.
- `CASHMOP_WORKER_ID` suffix for test DB.

## Conventions
- Money values are decimal major units (e.g. `12.34`), not cents.
- Currency codes uppercase ISO.
- Date strings `YYYY-MM-DD`.

## Safety
- No prompts or confirmations.
- Destructive actions require explicit flags (e.g. `--uncategorize`).

## Command Tree
- `import`
- `mappings`
- `tx`
- `categories`
- `rules`
- `export`
- `backup`
- `settings`
- `fx`

## Subcommands

### `import`
- `cashmop import --file <path> --mapping <path|name|-> [--month YYYY-MM] [--dry-run]`
- `--mapping` accepts:
  - saved mapping name
  - JSON file path
  - `-` to read JSON from stdin
- `--dry-run` parses + validates only, no writes.
- Date parsing: ISO or common bank formats (`YYYY-MM-DD`, `MM/DD/YYYY`, `DD/MM/YYYY`, and loose date strings).
- Amount parsing: numeric values normalized to decimal major units; non-numeric chars stripped; `amountMapping.invertSign` flips sign.

#### Mapping JSON Schema
- `csv.date` string header name
- `csv.description` array of header names
- `csv.amountMapping` one of:
  - `{"type":"single","column":"Amount","invertSign":false}`
  - `{"type":"debitCredit","debitColumn":"Debit","creditColumn":"Credit","invertSign":false}`
  - `{"type":"amountWithType","amountColumn":"Amount","typeColumn":"Type","negativeValue":"debit","positiveValue":"credit","invertSign":false}`
- `csv.owner` optional column
- `csv.account` optional column
- `csv.currency` optional column
- `account` static account name (used when `csv.account` not set)
- `defaultOwner` optional (used when `csv.owner` not set; defaults to `Unassigned`)
- `currencyDefault` ISO currency when `csv.currency` not set

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
  csv.owner          string (optional)
  csv.account        string (optional)
  csv.currency       string (optional)
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
- `cashmop mappings get --name <name> | --id <id>`
- `cashmop mappings save --name <name> --mapping <path|->`
- `cashmop mappings delete --name <name> | --id <id>`

#### Output
- `list`: `[{"id":1,"name":"BMO CSV"}, ...]`
- `get`: `{"id":1,"name":"BMO CSV","mapping":{...}}`
- `save`: `{"id":1,"name":"BMO CSV"}`

### `tx`
- `cashmop tx list [--uncategorized] [--start YYYY-MM-DD] [--end YYYY-MM-DD] [--category-ids 1,2] [--query "..." ] [--amount-min <amount>] [--amount-max <amount>] [--sort date|amount] [--order asc|desc]`
- `cashmop tx categorize --id <id> --category <name|empty>`

#### Notes
- `--query` uses fzf-style fuzzy match against description only.
- `--amount-min`/`--amount-max` use decimal major units.
- `--sort` defaults to `date`, `--order` defaults to `desc`.
- Sorting may be applied in Go after DB query.

#### Output
- `list`: `[{"id":1,"date":"2025-01-12","description":"...","amount":-12.34,"category":"Groceries","account":"BMO","owner":"Alex","currency":"CAD"}, ...]`
- `categorize`: `{"transaction_id":123,"affected_ids":[123]}`

### `categories`
- `cashmop categories list`
- `cashmop categories rename --id <id> --name <new>`
- `cashmop categories create --name <name>`

#### Output
- `list`: `[{"id":1,"name":"Groceries"}, ...]`
- `create`: `{"id":1,"name":"Groceries"}`

### `rules`
- `cashmop rules list`
- `cashmop rules preview --match-value <v> --match-type <starts|ends|contains|exact> [--amount-min <amount>] [--amount-max <amount>]`
- `cashmop rules create --match-value <v> --match-type <...> [--amount-min ...] [--amount-max ...] --category <name>`
- `cashmop rules update --id <id> [--recategorize] ...`
- `cashmop rules delete --id <id> [--uncategorize]`

#### Notes
- `--amount-min`/`--amount-max` use decimal major units.

#### Output
- `list`: `[{"id":1,"match_type":"contains","match_value":"Uber","amount_min":null,"amount_max":null,"category_id":3,"category_name":"Transport"}, ...]`
- `preview`: `{"count":12,"sample":[{"id":1,"description":"...","amount":-12.34}, ...]}`
- `create`: `{"rule_id":1,"affected_ids":[1,2,3]}`
- `update`: `{"rule_id":1,"uncategorize_count":12,"applied_count":9}`
- `delete`: `{"rule_id":1,"uncategorized_count":12}`

### `export`
- `cashmop export --start YYYY-MM-DD --end YYYY-MM-DD --format csv|xlsx --out <path> [--category-ids 1,2]`

#### Output
- `{"count":123,"path":"/abs/path/file.csv"}`

#### Export Columns
- `Date`
- `Description`
- `Amount (Main)`
- `Amount (Original)`
- `Currency (Original)`
- `Category`
- `Account`
- `Owner`

### `backup`
- `cashmop backup create`
- `cashmop backup info`
- `cashmop backup validate --file <path>`
- `cashmop backup restore --file <path>`

#### Notes
- `restore` validates backup and creates a safety backup before overwriting DB.

#### Output
- `create`: `{"path":"/abs/path/cashmop_backup_20250101_120000.db"}`
- `info`: `{"lastBackupTime":"2025-01-01T12:00:00Z","hasBackup":true}`
- `validate`: `{"path":"...","size":12345,"transaction_count":1500,"created_at":"2025-01-01T12:00:00Z"}`

### `settings`
- `cashmop settings get`
- `cashmop settings set --main-currency <ISO>`

#### Output
- `get`: `{"main_currency":"CAD","fx_last_sync":"2025-01-01T12:00:00Z"}`
- `set`: same as `get`

### `fx`
- `cashmop fx status`
- `cashmop fx sync`
- `cashmop fx rate --base <ISO> --quote <ISO> --date YYYY-MM-DD`

#### Output
- `status`: `{"base_currency":"CAD","last_sync":"2025-01-01T12:00:00Z","pairs":[{"quote_currency":"USD","latest_rate_date":"2025-01-01"}]}`
- `sync`: `{"ok":true}`
- `rate`: `{"rate_date":"2025-01-01","rate":1.234,"source":"..."}`

## Error Codes (suggested)
- `invalid-arg`: missing/invalid flag or value
- `not-found`: mapping, rule, transaction, or file not found
- `conflict`: concurrency/lock conflict
- `io`: file read/write failures
- `db`: database query failure

## Examples
- `cashmop tx list --uncategorized --sort date --order desc`
- `cashmop tx list --start 2025-01-01 --end 2025-01-31 --query "starb"`
- `cashmop tx categorize --id 123 --category "Groceries"`
- `cashmop rules preview --match-value "Starbucks" --match-type contains`
- `cashmop export --start 2025-01-01 --end 2025-01-31 --format csv --out ./cashmop_2025-01.csv`
- `cashmop backup validate --file ./backup.db`
- `cashmop fx status`
