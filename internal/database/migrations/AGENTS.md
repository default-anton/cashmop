# Database migrations

- Embedded via go:embed; rebuild after add/change
- Naming: `{NNN}_{description}.sql` up; `{NNN}_{description}_down.sql` down; 3-digit zero-pad; snake_case; next available
- Content: `CREATE TABLE IF NOT EXISTS` new tables; `ALTER TABLE` changes; idempotent; one migration = one atomic unit
- Flow: `schema_migrations` tracks versions; startup runs pending in order inside transactions
- Rollback: open a `*database.Store` and call `store.Rollback()` (rolls back the latest applied migration)
- Rules: never edit past migrations; add new file(s)
- Testing: reset test DB (drops all incl schema_migrations, reruns all migrations):
  `go run cmd/test-helper/main.go reset`
- Key files: `internal/database/migrate.go`, `internal/database/store.go`, `internal/database/migrations/*.sql`, `cmd/test-helper/main.go`
