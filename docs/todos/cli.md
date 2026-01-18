# CLI Spec Todo

## Context
- Spec: docs/specs/cli.md
- Task: Implement spec completely in iterative, continuous mode.
- Goal: full CLI mode with JSON outputs, command set, DB path handling, import/export/backup/rules/tx workflows, help/version.
- Constraints: non-interactive; stdout JSON for non-help; stderr empty; exit codes 0/1/2; DB path resolution parity; reuse GUI logic.

## Progress
- [x] Create todo log.
- [x] Add CLI entry/dispatch + DB init helper + output/error helpers.
- [x] Implement global flags/help/version + core command parsing.
- [x] Implement command handlers (mappings/categories/settings/fx/tx/rules/export/backup/import).
- [x] Add comprehensive test coverage for all CLI commands and flags.
- [x] Verify JSON error structure for all validation failures.
- [x] Fix bugs (fuzzy query ranking vs sorting).

## Changes
- `internal/database/db.go`: Added `InitDBWithPath`, `GetColumnMappingByID`, `GetColumnMappingByName`, and `ImportMapping` structs.
- `internal/database/transactions.go`: Added `BatchInsertTransactionsWithCount`.
- `internal/database/backup.go`: Added `RestoreBackupWithSafety`.
- `internal/cli/`: Created new package with command handlers, flag parsing, JSON output, and import/export logic.
- `main.go`: Added CLI branching.
- `tests/cli/`: Added comprehensive integration tests (`tx_test.go`, `rules_test.go`, `export_test.go`, `fx_test.go`, `error_test.go`).
