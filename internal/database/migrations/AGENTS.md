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

## Migration testing (REQUIRED)

Every migration MUST have a corresponding test file.

**Structure:**
- `internal/database/migrations_test.go` — shared test helpers (`newMigrationTest`, `migrationTestHelper`)
- `internal/database/migration_NNN_test.go` — one test file per migration

**Test file naming:** `migration_{NNN}_{description}_test.go`

**Test requirements:**
1. Use `newMigrationTest(t, NNN)` — creates a fresh DB with migrations 1..NNN-1 applied
2. Insert test data in the format that existed **after** migration NNN-1
3. Run `h.run()` to apply migration NNN
4. Verify the post-migration state
5. Test idempotency (running twice produces same result)
6. If a down migration exists, test it with `h.runDown()`

**Example:** See `internal/database/migration_006_test.go` for the reference implementation.

**Why required:** Desktop app users have existing data. Migrations must work correctly on real data without breaking installations. Tests verify the migration works on actual data shapes and are idempotent.
