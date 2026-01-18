# TODO: Centralize Default Currency Logic

## Context
The application often falls back to "CAD" when no main currency is set in the database.

## Problem
The "CAD" fallback is hardcoded in multiple places across the codebase (e.g., `internal/database/currency.go`, `internal/cli/tx.go`, `internal/cli/import.go`). This makes it difficult to change the default or ensure consistent behavior.

## Requirements
- Centralize the default currency fallback to a single location, preferably in `internal/database/currency.go`.
- Export a constant or a helper function (e.g., `database.DefaultCurrency()`) that all other packages use.
- Remove all hardcoded "CAD" strings used as fallbacks in the CLI and DB layers.

## Files
- `internal/database/currency.go`
- `internal/cli/tx.go`
- `internal/cli/import.go`
