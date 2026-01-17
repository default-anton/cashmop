# CLI Spec

## Context
- AI coding agents + local automation need full app access.
- CLI ships with desktop app; enables headless workflows.
- Core use case: import → categorize → analyze/export without UI.

## Goals
- Non-interactive.
- Machine-readable JSON for all non-help commands.
- Human-readable help/version.
- Parity with GUI workflows + DB behavior.
- Simple, familiar response shapes; stable fields (snake_case).

## Non-goals (v1)
- Concurrency/locking sophistication.
- Debug logging mode.
- Pagination (bounded by date-range constraints instead).

## Name + One-Liner
- `cashmop`: CashMop CLI for automated data operations.

## Distribution / Install Strategy
- Single **`cashmop`** binary: GUI + CLI modes.
  - No args (`cashmop`) => start desktop app (Wails).
  - Any args (`cashmop <subcommand> ...`) => run CLI mode; do **not** initialize Wails/webview.
- CLI availability on `PATH` is packaging-dependent:
  - Linux `.deb`: install `cashmop` to `/usr/bin/cashmop` (already done in `scripts/release.sh`).
  - Linux `AppImage`: no system install; provide `cashmop install-cli` helper to copy/symlink into `~/.local/bin` (and `uninstall-cli`).
  - macOS `.app` in `.zip`: **primary UX = explicit in-app action** (menu item: `CashMop → Install CLI…`).
    - Installs a small shim/symlink so `cashmop` is available on `PATH`.
    - Install target preference:
      - `/usr/local/bin` (if writable; otherwise prompt for admin credentials to write there)
      - fallback: `~/.local/bin` (no admin); show “add to PATH” instructions
    - Provide `Uninstall CLI…` to remove the shim.
    - Optional non-interactive equivalent: `cashmop install-cli [--path <dir>]`.
  - Windows NSIS installer: add optional checkbox “Add CashMop to PATH (current user)” to append `$INSTDIR` to `PATH` and remove on uninstall.

## Usage
- `cashmop [global flags] <subcommand> [args]`

## Help + Version
- Human-readable plain text.
- Output: **stdout**.
- Supported forms:
  - `cashmop help <subcommand>`
  - `cashmop <subcommand> --help` / `-h`
  - `cashmop --version`

## Global Flags
- `-h, --help`: help text.
- `--version`: print version.
- `--db <path>`: path to SQLite DB file to operate on.
  - If omitted: use the same “active DB” resolution as the desktop app (OS config dir + env overrides; see below). Does not depend on current working directory; intended to work when shipped alongside the desktop app.

## Output Contract
### Where output goes
- **All non-help command output goes to stdout.**
- **stderr must remain empty** (no logs, no stack traces, no debug prints).

### JSON shape (non-help commands)
- Always a **single JSON object** (no bare arrays).
- Always includes `ok: boolean`.

#### Success
- `{"ok": true, ...}`
- Command-specific fields at the top-level using snake_case.

#### Error
- `{"ok": false, "errors": [ ... ]}`
- `errors[]` entries:
  - `message` (required): plain English, unambiguous, actionable.
  - `field` (optional): flag/arg name (snake_case; e.g. `start`, `mapping`, `month`).
  - `hint` (optional): “do this instead” guidance.
  - `details` (optional): structured data (object) for validation context.
- Multiple errors allowed (especially validation failures).

## Exit Codes
- `0`: success
- `1`: runtime failure
- `2`: invalid usage/validation

## Environment + DB Path Resolution
- Default DB path resolution matches the desktop app:
  - `APP_ENV=test|dev|development` selects dev/test DB locations.
  - `CASHMOP_WORKER_ID` suffix for test DB.
  - Otherwise: OS config dir:
    - Linux: `$XDG_CONFIG_HOME` / `~/.config`
    - macOS: `~/Library/Application Support`
    - Windows: `%LOCALAPPDATA%`
- `--db <path>` overrides all of the above.

## Conventions
### Money
- Storage + backend calculations: **cents (INTEGER/int64)**.
- CLI user-facing money values: **decimal major units as strings**.
  - Examples: `"12.34"`, `"-12.34"`.
  - CLI accepts decimal strings for flags (e.g. `--amount-min "10.00"`).
  - Parsing: same as GUI (`frontend/src/utils/currency.ts::parseCents`) — strip non-numeric chars except `-`, `.` and `,`; treat `,` as decimal separator.

### Dates
- Date strings: `YYYY-MM-DD`.
- Month strings: `YYYY-MM`.

### Match types
- Use the same vocabulary as backend:
  - `starts_with | ends_with | contains | exact`

### Fuzzy query
- `--query` uses the same fuzzy matcher as the GUI (`internal/fuzzy`).
- Matching is done against the same composite label as the Analysis screen:
  - `description | account | category_or_uncategorized | owner_or_no_owner | date | amount_decimal | currency ::id`

## Safety
- No prompts or confirmations.
- Destructive actions require explicit flags (e.g. `--uncategorize`, `--no-apply-rules`).
- Exports overwrite existing output files.

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

---

## Commands

### `import`
Import CSV/XLSX with an explicit mapping. Non-interactive.

#### Usage
- `cashmop import --file <path> --mapping <path|name|-> [--month YYYY-MM ...] [--dry-run] [--no-apply-rules]`

#### Flags
- `--file <path>` (required)
- `--mapping <path|name|->` (required)
  - saved mapping name
  - JSON file path
  - `-` to read JSON from stdin
- `--month YYYY-MM` (repeatable)
  - If omitted:
    - if file contains exactly one month → import it
    - if file contains multiple months → error with found months + require `--month`
- `--dry-run` parses + validates only, no writes.
- `--no-apply-rules` skips automatic rule application after insert (default: apply rules).

#### File parsing (parity with GUI)
- CSV:
  - comma-separated
  - supports quotes and escaped quotes (`""`)
  - strips UTF-8 BOM
  - trims cells
  - auto header detection (keywords + heuristics) like GUI
  - date parsing: same as GUI `parseDateLoose` (ISO-ish, common bank formats like `MM/DD/YYYY` and `DD/MM/YYYY`, and `Date(...)` fallback)
- XLSX:
  - first sheet
  - trims cells

#### Mapping JSON Schema (parity with GUI)

Note: mapping JSON is stored/loaded exactly like the GUI (camelCase keys such as `amountMapping`, `invertSign`, `defaultOwner`, `currencyDefault`). Treat as an opaque blob.

```jsonc
{
  "csv": {
    "date": "Date",               // required
    "description": ["Desc"],      // required (non-empty)
    "amountMapping": {             // required
      "type": "single|debitCredit|amountWithType",
      // ... see variants below
      "invertSign": false          // optional
    },
    "owner": "Owner",             // optional
    "account": "Account",         // optional
    "currency": "Currency"        // optional
  },
  "account": "BMO",               // required (used when csv.account not set)
  "defaultOwner": "Unassigned",   // optional (used when csv.owner not set)
  "currencyDefault": "CAD"        // required (used when csv.currency not set)
}
```

Amount mapping variants:
- `{"type":"single","column":"Amount","invertSign":false}`
- `{"type":"debitCredit","debitColumn":"Debit","creditColumn":"Credit","invertSign":false}`
- `{"type":"amountWithType","amountColumn":"Amount","typeColumn":"Type","negativeValue":"debit","positiveValue":"credit","invertSign":false}`

#### Success output

Note: DB import may skip duplicates (same behavior as GUI); `skipped_count` reports how many input rows were not inserted.

```json
{
  "ok": true,
  "imported_count": 123,
  "skipped_count": 0,
  "months": ["2025-01"],
  "applied_rules": true
}
```

#### Dry-run output
```json
{
  "ok": true,
  "dry_run": true,
  "parsed_count": 123,
  "months": ["2025-01", "2025-02"],
  "warnings": []
}
```

---

### `mappings`
Manage saved import mappings.

#### Commands
- `cashmop mappings list`
- `cashmop mappings get --name <name> | --id <id>`
- `cashmop mappings save --name <name> --mapping <path|->`
- `cashmop mappings delete --name <name> | --id <id>`

Notes:
- `save` upserts by `name` (same as GUI).
- Mapping payloads are returned/stored in GUI schema (camelCase keys).

#### Outputs
- `list`
```json
{ "ok": true, "items": [{"id":1,"name":"BMO CSV"}] }
```

- `get`
```json
{ "ok": true, "item": {"id":1,"name":"BMO CSV","mapping":{}} }
```

- `save`
```json
{ "ok": true, "id": 1, "name": "BMO CSV" }
```

- `delete`
```json
{ "ok": true, "deleted": true }
```

---

### `tx`
Transaction operations.

#### `tx list`
List transactions in a bounded date range.

Usage:
- `cashmop tx list [--start YYYY-MM-DD --end YYYY-MM-DD] [--uncategorized] [--category-ids 1,2] [--query "..."] [--amount-min "12.34"] [--amount-max "99.99"] [--sort date|amount] [--order asc|desc]`

Date range rules:
- If neither `--start` nor `--end` is provided: default to **last full calendar month**.
- If one is provided, both must be provided.
- Range must be **≤ 93 days** (≈ 3 months). Otherwise validation error.

Notes:
- `--query` uses GUI-style fuzzy match (see conventions).
- Amount filters use decimal strings (major units).
  - Semantics: filter/sort uses main-currency converted amount (same as GUI). If conversion is unavailable for a tx/date/currency, that tx is excluded from amount filters; for `--sort amount` it sorts last.
- Category filtering:
  - default (no `--uncategorized`, no `--category-ids`): all transactions in range.
  - `--uncategorized`: only uncategorized.
  - `--category-ids 1,2`: only those categories.
  - both `--uncategorized` + `--category-ids`: union (those categories + uncategorized).
- `--sort` defaults to `date`, `--order` defaults to `desc`.

Output:
```json
{
  "ok": true,
  "count": 2,
  "transactions": [
    {
      "id": 1,
      "date": "2025-01-12",
      "description": "...",
      "amount": "-12.34",
      "currency": "CAD",
      "category": "Groceries",
      "account": "BMO",
      "owner": "Alex"
    }
  ]
}
```

#### `tx categorize`
Usage:
- `cashmop tx categorize --id <id> --category <name>`
- `cashmop tx categorize --id <id> --uncategorize`

Output:
```json
{ "ok": true, "transaction_id": 123, "affected_ids": [123] }
```

---

### `categories`
Usage:
- `cashmop categories list`
- `cashmop categories rename --id <id> --name <new>`
- `cashmop categories create --name <name>`

Outputs:
- `list`
```json
{ "ok": true, "items": [{"id":1,"name":"Groceries"}] }
```
- `create`
```json
{ "ok": true, "id": 1, "name": "Groceries" }
```

---

### `rules`
Usage:
- `cashmop rules list`
- `cashmop rules preview --match-value <v> --match-type <starts_with|ends_with|contains|exact> [--amount-min "..."] [--amount-max "..."]`
- `cashmop rules create --match-value <v> --match-type <...> [--amount-min "..."] [--amount-max "..."] --category <name>`
- `cashmop rules update --id <id> [--recategorize] ...`
- `cashmop rules delete --id <id> [--uncategorize]`

Notes:
- Amount filters use decimal strings (major units); rules store cents internally.
  - Semantics: amount-min/max apply to main-currency converted amount (same behavior as GUI rule matching).
- Amount values in outputs (`amount_min`, `amount_max`, `min_amount`, `max_amount`, transaction `amount`) are decimal strings (major units) or `null`.

Outputs:
- `list`
```json
{
  "ok": true,
  "items": [
    {
      "id": 1,
      "match_type": "contains",
      "match_value": "Uber",
      "amount_min": null,
      "amount_max": null,
      "category_id": 3,
      "category_name": "Transport"
    }
  ]
}
```

- `preview`
```json
{
  "ok": true,
  "count": 12,
  "min_amount": "-42.10",
  "max_amount": "120.00",
  "transactions": [
    {"id": 1, "description": "...", "amount": "-12.34", "currency": "CAD", "date": "2025-01-12"}
  ]
}
```

- `create`
```json
{ "ok": true, "rule_id": 1, "affected_ids": [1,2,3] }
```

- `update`
```json
{ "ok": true, "rule_id": 1, "uncategorize_count": 12, "applied_count": 9 }
```

- `delete`
```json
{ "ok": true, "rule_id": 1, "uncategorized_count": 12 }
```

---

### `export`
Usage:
- `cashmop export --start YYYY-MM-DD --end YYYY-MM-DD --format csv|xlsx --out <path> [--category-ids 1,2]`

Rules:
- Date range required and must be ≤ 93 days.
- Overwrites `--out` if it exists.

Output:
```json
{ "ok": true, "count": 123, "path": "/abs/path/file.csv" }
```

Export columns (parity with GUI):
- `Date`
- `Description`
- `Amount (Main)`
- `Amount (Original)`
- `Currency (Original)`
- `Category`
- `Account`
- `Owner`

---

### `backup`
Usage:
- `cashmop backup create [--out <path>]`
- `cashmop backup info`
- `cashmop backup validate --file <path>`
- `cashmop backup restore --file <path>`

Notes:
- `backup create`:
  - if `--out` omitted: create in default backup dir with timestamped filename (same naming as GUI auto backups).
  - if `--out` exists: overwrite.
- `restore` validates backup and creates a safety backup before overwriting DB.
- `backup info`: `last_backup_time` is RFC3339 string or `null`.

Outputs:
- `create`
```json
{ "ok": true, "path": "/abs/path/cashmop_backup_20250101_120000.db" }
```

- `info`
```json
{ "ok": true, "last_backup_time": "2025-01-01T12:00:00Z", "has_backup": true }
```

- `validate`
```json
{
  "ok": true,
  "path": "...",
  "size": 12345,
  "transaction_count": 1500,
  "created_at": "2025-01-01T12:00:00Z"
}
```

- `restore`
```json
{ "ok": true, "restored_from": "...", "safety_backup_path": "..." }
```

---

### `settings`
Usage:
- `cashmop settings get`
- `cashmop settings set --main-currency <ISO>`

Outputs:
- `get`
```json
{ "ok": true, "settings": {"main_currency":"CAD","fx_last_sync":"2025-01-01T12:00:00Z"} }
```

- `set`
```json
{ "ok": true, "settings": {"main_currency":"CAD","fx_last_sync":"2025-01-01T12:00:00Z"} }
```

---

### `fx`
Usage:
- `cashmop fx status`
- `cashmop fx sync`
- `cashmop fx rate --base <ISO> --quote <ISO> --date YYYY-MM-DD`

Outputs:
- `status`
```json
{
  "ok": true,
  "base_currency": "CAD",
  "last_sync": "2025-01-01T12:00:00Z",
  "pairs": [{"quote_currency":"USD","latest_rate_date":"2025-01-01"}]
}
```

- `sync`
```json
{ "ok": true }
```

- `rate`
```json
{ "ok": true, "rate_date": "2025-01-01", "rate": 1.234, "source": "..." }
```

---

## Error Examples
Invalid usage:
```json
{
  "ok": false,
  "errors": [
    {
      "field": "start",
      "message": "--start requires --end.",
      "hint": "Provide both --start and --end, or omit both to default to last calendar month."
    }
  ]
}
```

Import validation:
```json
{
  "ok": false,
  "errors": [
    {
      "field": "mapping",
      "message": "Mapping is missing required field csv.date.",
      "hint": "Set mapping.csv.date to the header name containing transaction dates."
    },
    {
      "field": "month",
      "message": "File contains multiple months (2025-01, 2025-02).",
      "hint": "Repeat --month to select which months to import."
    }
  ]
}
```

## Implementation Notes (required for parity)
- CLI mode must not emit logs to stdout/stderr.
- DB init failures must be returned as structured JSON errors in CLI mode (not `log.Fatal`).
- Desktop app may continue to log as it does today.
