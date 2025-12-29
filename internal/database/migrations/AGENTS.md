# Database migrations

- SQL files here are embedded via go:embed; rebuild after adding/changing one.
- Naming: `{NNN}_{description}.sql` (3-digit zero-padded, snake_case, next available number).
- Content: use `CREATE TABLE IF NOT EXISTS` for new tables; `ALTER TABLE` for changes; keep statements idempotent; each migration is atomic.
- Flow: `schema_migrations` tracks applied versions; startup runs pending migrations in order inside transactions.
- Rules: never edit past migrations; add a new file instead.
- Testing: reset test DB (drops everything incl schema_migrations, reruns all migrations):
  `go run cmd/test-helper/main.go reset`
- Key files: `internal/database/migrate.go` (runner), `internal/database/db.go` (InitDB ➜ Migrate), `internal/database/migrations/*.sql`, `cmd/test-helper/main.go`.
