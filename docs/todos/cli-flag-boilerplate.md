# TODO: Reduce Subcommand Flag Boilerplate

## Context
Every CLI subcommand in `internal/cli/*.go` manually initializes a `flag.FlagSet`, sets its output to `io.Discard`, and handles basic flags like `--help`.

## Problem
There is significant code duplication across `import.go`, `tx.go`, `rules.go`, etc. Adding a new global flag or changing help behavior requires updating every file.

## Requirements
- Create a helper function/struct in `internal/cli` to encapsulate subcommand flag initialization.
- The helper should handle:
    - `flag.NewFlagSet`
    - `SetOutput(io.Discard)`
    - Standard `--help` and `-h` registration.
- Refactor all subcommands to use this shared helper.
- Ensure validation errors remain consistent with the `commandResult` and `ErrorDetail` structure.

## Files
- `internal/cli/flags.go` (potential home for helper)
- All `internal/cli/` subcommand files.
