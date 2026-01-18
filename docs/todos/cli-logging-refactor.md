# TODO: Replace Global Log Suppression with Injectable Logger

## Context
The CLI and tests currently use a global variable `database.SuppressLogs` to silence migration logs and other database output.

## Problem
Global state for logging is brittle, makes parallel testing difficult, and prevents fine-grained control over output (e.g., allowing errors but silencing info).

## Requirements
- Replace `database.SuppressLogs` with an injectable logger.
- Update `internal/database` to accept a logger (e.g., `slog.Logger` or a custom interface) during initialization.
- Update `internal/cli/cli.go` to inject a "silent" logger (one that writes to `io.Discard`).
- Update the desktop app entry point to inject the standard application logger.

## Files
- `internal/database/db.go`
- `internal/database/migrate.go`
- `internal/cli/cli.go`
- `main.go`
