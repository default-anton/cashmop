# Integration Testing Spec

Enable automated, black-box, browser-based integration testing of the Cashflow Tracker.

## Goals
- Validate full user journeys across the Web frontend.
- Ensure backend/frontend compatibility.
- Fast execution with isolated test environments.
- Consistent state via YAML fixtures.

## Tech Stack
- **Runner**: [Playwright](https://playwright.dev/) (TypeScript)
- **Environment**: Wails Dev mode (Web)
- **Database**: SQLite (Temporary file per test run)
- **Fixtures**: YAML-based data loading

## Environment Configuration
- **Wails Test Mode**: Triggered by `APP_ENV=test` environment variable.
- **Port**: Wails will listen on port `34116` (Frontend) and `34115` (DevServer) by default, or configurable via env.
- **Database**: 
  - Path: `./cashflow_test.db`.
  - Initialization: Use `schema.sql` (extracted from Go code).
  - Lifecycle: Deleted after all tests finish.

## Fixture Management
- **Format**: YAML files in `frontend/tests/fixtures/`.
- **Loading**: A dedicated Wails binding `app.LoadFixtures(name string)` or a CLI helper `go run ./cmd/test-helper load <name>`.
- **Strategy**: 
  1. Wipe DB.
  2. Run `schema.sql`.
  3. Load requested YAML fixture.
  4. Start/Restart app state.

## Test Structure
- Location: `frontend/tests/`
- Pattern: `*.spec.ts`
- Conventions:
  - Page Object Model (POM) for common UI interactions (Import Flow, Categorization, Analysis).
  - One fixture set per major feature area.

## Fixture Coverage
Fixtures must cover the following scenarios:
- **Import Flow**: 
  - New account creation via import.
  - Column mapping persistence (pre-configured mappings).
  - Multi-account imports.
- **Categorization**:
  - Empty state (no uncategorized).
  - Fuzzy matching suggestions (multiple similar categories).
  - Complex rules (amount ranges, match types).
- **Analysis**:
  - Multi-year data for trend analysis.
  - Diverse categories for breakdown charts.
  - Edge cases (no data in selected month).

## Implementation Plan
1. **Schema Extraction**: Extract DDL from `internal/database/db.go` into `schema.sql`.
2. **Environment Support**: Update `internal/database/db.go` to support configurable DB paths.
3. **Fixture Loader**: Implement a Go-based YAML loader that populates the DB.
4. **Wails Integration**: Add `LoadFixtures` binding for test orchestration.
5. **Playwright Setup**: Install Playwright in `frontend/`, configure `playwright.config.ts` to point to the Wails DevServer URL.
6. **CI Integration**: Add `npm run test:e2e` to GitHub Actions.

## Example Fixture (fixtures/basic-transactions.yaml)
```yaml
accounts:
  - name: "Checking"
    type: "checking"
categories:
  - name: "Groceries"
  - name: "Rent"
transactions:
  - account: "Checking"
    date: "2023-10-01"
    description: "Safeway"
    amount: -54.20
    category: "Groceries"
```
