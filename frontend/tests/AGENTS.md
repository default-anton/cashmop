# Integration Testing

Browser E2E; Playwright + Wails dev mode.

## Running Tests

From project root:
```bash
make integration
```

## Database State & Fixtures

- Reset: DB reset `beforeEach` via `./build/bin/test-helper reset`
- Fixtures: `frontend/tests/fixtures/*.yml`
- Reset gotcha: `test-helper` uses `DROP TABLE` + `SchemaSQL` (sqlite_master) to avoid stale inode/handles with running Wails

## Conventions

- POM: page objects in `frontend/tests/lib/pom/`
- Selectors: prefer `aria-label`; always `{ exact: true }` to avoid substring clashes
- Fixtures: use custom fixtures `frontend/tests/lib/fixtures.ts` (auto DB reset)
- Timing: `await page.goto('/')` each test for fresh React mount + status check

## Reference Examples

- `frontend/tests/basic.spec.ts`: entry journey categorization → analysis
