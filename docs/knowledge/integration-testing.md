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
- **Port**: Wails DevServer in test mode (from `run-integration-tests.sh`) serves on `http://localhost:34115`.
- **File Uploads**: `page.setInputFiles()` paths are relative to the `frontend/` directory when running from the root or via `run-integration-tests.sh`. Avoid `__dirname` in ESM tests.
- **Auto-navigation**: `ImportFlow` may auto-navigate to categorization on completion if uncategorized transactions exist. Tests should handle both the "Import Complete!" screen and immediate navigation.
- **Orchestration**: `scripts/run-integration-tests.sh` supports arguments for passing specific test files to Playwright (e.g., `./scripts/run-integration-tests.sh tests/import.spec.ts`).
- **Headless Mode**: `wails dev -browser` combined with `StartHidden: os.Getenv("APP_ENV") == "test"` in `main.go` allows running integration tests without a native window popping up. This provides a "web-only" environment for Playwright while keeping the Wails dev server features.
- **Locator Strictness**: Use Page Object Models (POM) in `frontend/tests/lib/pom/` to encapsulate selectors and interaction logic. Favor `page.getByLabel()` and other explicit ARIA locators within POMs.
- **Custom Fixtures**: Use custom Playwright fixtures from `frontend/tests/lib/fixtures.ts` to automate setup (like database reset) and provide pre-instantiated POMs to tests.
- **App Mounting**: Navigation via `page.goto('/')` in Playwright ensures a fresh React mount and triggers the application's initial status checks.
