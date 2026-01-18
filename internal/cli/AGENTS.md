# CLI Subcommands

- Initialize subcommand flags using `newSubcommandFlagSet(name)`.
- Use `fs.parse(args, helpCmd)` for parsing and standard help handling.
- Validation/runtime errors: use `validationError()` and `runtimeError()` from `response.go`.
- Success responses: return a struct/map in `commandResult.Response`.
- Help: handled automatically by `fs.parse`; returns `commandResult{Help: true}`.
- Example: `internal/cli/import.go`
