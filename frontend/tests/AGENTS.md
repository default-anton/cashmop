# Integration Testing

Browser-based, end-to-end tests using Playwright and Wails Dev mode.

## Running Tests

From the project root:
```bash
./scripts/run-integration-tests.sh
```

## Database State & Fixtures

- **Reset**: Database is reset `beforeEach` test via `./build/bin/test-helper reset`.
- **Fixtures**: Located in `./fixtures/*.yml`. 
- **DB Reset Gotcha**: `test-helper` uses `DROP TABLE` + `SchemaSQL` instead of deleting the file to avoid stale file handle/inode issues with the running Wails process. Tables are found dynamically via `sqlite_master`.

## Conventions

- **POM**: Use Page Object Models for complex screens (TODO).
- **Locators**: Use explicit `aria-label` and `page.getByLabel()` for primary actions. Avoid brittle CSS selectors.
- **Timing**: Use `await page.goto('/')` in each test to ensure a fresh React mount and status check.

## Reference Examples
- `frontend/tests/basic.spec.ts`: Entrypoint journey from categorization to analysis.
