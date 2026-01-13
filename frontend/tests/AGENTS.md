# Integration Testing

Browser E2E; Playwright + Wails dev mode.

## Running Tests

From project root:
```bash
make integration                           # All
make integration-file FILE=tests/basic.spec.ts    # Single file
make integration-test NAME="pattern"       # Pattern match
./scripts/run-integration-tests.sh <args> # Direct (Playwright args)
```

## Test Environment

- `APP_ENV=test` disables OS dialogs/opens + background auto backup/FX sync; dialogs return temp paths
- Temp dir: `$TMPDIR/cashflow-test/$CASHFLOW_TEST_RUN_ID` (set in `scripts/run-integration-tests.sh`)

## Database State & Fixtures

- Reset: DB reset `beforeEach` via `./build/bin/test-helper reset`
- Fixtures: `frontend/tests/fixtures/*.yml`
- Data format: `page.evaluate()` bindings use backend types (e.g., amounts in cents)
- Reset gotcha: `test-helper` uses `DROP TABLE` + `SchemaSQL` (sqlite_master) to avoid stale inode/handles with running Wails

## Conventions

- POM: page objects in `frontend/tests/lib/pom/`
- Selectors: prefer `aria-label`; always `{ exact: true }` to avoid substring clashes
- Categorization rules: category input label is `Category for rule` (normal `Category`); POM should match both
- Fixtures: use custom fixtures `frontend/tests/lib/fixtures.ts` (auto DB reset)
- Timing: `await page.goto('/')` each test for fresh React mount + status check

## Parallel Testing (Dev Only)

Wails dev server multi-instance:
- Flag: `wails dev -devserver localhost:$PORT -m -s -nogorebuild -noreload -skipbindings`
- Port range: 34115 + parallelIndex (e.g., 34115-34116 for 2 workers)
- DB isolation: `CASHFLOW_WORKER_ID=<index>` → DB suffix `_w<id>`
- Playwright: override `baseURL` fixture with `testInfo.parallelIndex`
- Shared Frontend: uses single Vite instance via `-frontenddevserverurl`
- See: `docs/specs/integration-test-parallelization.md`

## Reference Examples

- `frontend/tests/basic.spec.ts`: entry journey categorization → analysis
