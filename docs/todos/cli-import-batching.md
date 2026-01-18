# TODO: Batch Account/User Resolution in CLI Import

## Context
The current CLI import implementation (`internal/cli/import.go`) resolves account and owner names to IDs inside the main transaction normalization loop.

## Problem
In `normalizeTransactions`, `database.GetOrCreateAccount` and `database.GetOrCreateUser` are called for every row in the CSV. For a 1,000-row file, this results in ~2,000 unnecessary database queries.

## Requirements
- Before starting the loop in `normalizeTransactions`, fetch all existing accounts and users from the database.
- Use a local map for lookups.
- Only hit the database if a name is not found in the map (and update the map accordingly).
- Ensure this logic remains consistent with how the GUI handles imports.

## Files
- `internal/cli/import.go`
- `internal/database/transactions.go`
