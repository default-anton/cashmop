# Persist Knowledge: Integration Testing

Implemented full integration testing suite per `docs/specs/integration-testing.md`.

## Key Components

### Database Support
- **`internal/database/db.go`**: Supports `APP_ENV=test` to use `./cashflow_test.db`.
- **`internal/database/schema.sql`**: standalone schema file, embedded and exported as `SchemaSQL`.

### CLI Test Helper
- **`build/bin/test-helper`**: Provides `reset` command.
- **Wipe Strategy**: Dynamically finds all tables (via `sqlite_master`), disables foreign keys, and drops them.
- **Schema Re-init**: Re-enables foreign keys and re-runs `SchemaSQL`.
- **Fixtures**: Loads YAML fixtures from `frontend/tests/fixtures/`.

### Playwright Integration
- **Setup**: Configured in `frontend/playwright.config.ts`.
- **Orchestration**: `scripts/run-integration-tests.sh` builds the helper once, manages the Wails Dev server lifecycle (using PID files), and waits for the server via `curl`.
- **`package.json`**: Added `test:integration` script.

## Lessons Learned
- **Inode Issues**: Deleting the SQLite file while Wails is connected leads to stale handles. Prefer `DROP TABLE` + schema re-run for a clean state without breaking the connection.
- **Dynamic Reset**: Querying `sqlite_master` for tables to drop prevents the test helper from becoming stale as the schema evolves.
- **Pre-built Binary**: Using `go run` in `beforeEach` is slow. Build the test helper once in the orchestration script and run the binary for a ~10x speedup in test setup.
- **Wait Loop**: Use `curl -s http://localhost:34115` instead of `lsof` to ensure the server is actually responding, not just opening a port.
- **Headless Mode**: `wails dev -browser` combined with `StartHidden: os.Getenv("APP_ENV") == "test"` in `main.go` allows running integration tests without a native window popping up. This provides a "web-only" environment for Playwright while keeping the Wails dev server features.
- **Locator Strictness**: Use explicit `aria-label` on primary action buttons (e.g., `aria-label="Categorize"`) and `page.getByLabel('...')` in Playwright for robust, unambiguous locators.
- **App Mounting**: Navigation via `page.goto('/')` in Playwright ensures a fresh React mount and triggers the application's initial status checks.
