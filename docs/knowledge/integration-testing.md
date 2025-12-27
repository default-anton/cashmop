# Persist Knowledge: Integration Testing

Implemented full integration testing suite per `docs/specs/integration-testing.md`.

## Key Components

### Database Support
- **`internal/database/db.go`**: Supports `APP_ENV=test` to use `./cashflow_test.db`.
- **`internal/database/schema.sql`**: standalone schema file, embedded and exported as `SchemaSQL`.

### CLI Test Helper
- **`cmd/test-helper/main.go`**: Provides `reset` command.
- **Wipe Strategy**: Drops all tables and re-runs `SchemaSQL` to avoid inode/file-handle issues with the running Wails process.
- **Fixtures**: Loads YAML fixtures from `frontend/tests/fixtures/`.

### Playwright Integration
- **Setup**: Configured in `frontend/playwright.config.ts`.
- **Orchestration**: `scripts/run-integration-tests.sh` manages the Wails Dev server lifecycle and Playwright execution.
- **`package.json`**: Added `test:integration` script.

## Lessons Learned
- **Inode Issues**: Deleting the SQLite file while Wails is connected leads to stale handles. Prefer `DROP TABLE` + schema re-run for a clean state without breaking the connection.
- **App Mounting**: Navigation via `page.goto('/')` in Playwright ensures a fresh React mount and triggers the application's initial status checks.
- **Locator Strictness**: Use specific selectors (e.g., `button.bg-brand.px-8`) when generic classes are shared across navigation and action components.
