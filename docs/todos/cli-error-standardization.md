# TODO: Standardize CLI Error Responses and Hints

## Context
The CLI spec requires specific JSON error structures including `field` and `hint` for validation failures.

## Problem
While `internal/cli/response.go` defines the structure, not all subcommands consistently populate the `Hint` field or use the correct `field` names as defined in the spec.

## Requirements
- Audit all CLI subcommands for consistency with the [CLI Spec](../specs/cli.md).
- Ensure every validation error (`exit code 2`) provides a helpful `Hint` to the user.
- Ensure the `field` value in `ErrorDetail` matches the flag name (e.g., `start` instead of `startDate`).
- Standardize the `commandResult` handling in `cli.go` to ensure no "naked" error strings are returned to the user.

## Files
- `internal/cli/cli.go`
- `internal/cli/response.go`
- `docs/specs/cli.md`
