# Database migrations

- SQL files here are embedded via go:embed; rebuild after adding/changing one.
- Naming: `{NNN}_{description}.sql` for up migrations, `{NNN}_{description}_down.sql` for down migrations (3-digit zero-padded, snake_case, next available number).
- Content: use `CREATE TABLE IF NOT EXISTS` for new tables; `ALTER TABLE` for changes; keep statements idempotent; each migration is atomic.
- Flow: `schema_migrations` tracks applied versions; startup runs pending migrations in order inside transactions.
- Rollback: down migrations allow rolling back the most recently applied migration using `database.Rollback()`.
- Rules: never edit past migrations; add a new file instead (both up and down if needed).
- Testing: reset test DB (drops everything incl schema_migrations, reruns all migrations):
  `go run cmd/test-helper/main.go reset`
- Key files: `internal/database/migrate.go` (runner), `internal/database/db.go` (InitDB ➜ Migrate), `internal/database/migrations/*.sql`, `cmd/test-helper/main.go`.
