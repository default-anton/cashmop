# Integration Testing Spec

Enable automated, black-box, browser-based integration testing of the Cashflow Tracker.

## Goals
- Validate full user journeys across the Web frontend.
- Ensure backend/frontend compatibility.
- Fast execution with isolated test environments.
- Fresh state before every test via Rails-style fixtures.

## Tech Stack
- **Runner**: [Playwright](https://playwright.dev/) (TypeScript)
- **Environment**: Wails Dev mode (Web)
- **Database**: SQLite (Temporary file `./cashflow_test.db`)
- **Fixtures**: YAML files per table

## Environment Configuration
- **Wails Test Mode**: Triggered by `APP_ENV=test` environment variable.
- **Port**: Wails will listen on port `34116` (Frontend) and `34115` (DevServer) by default.
- **Database Path**: Points to `./cashflow_test.db` when in test mode.

## Fixture Management (Rails-style)
- **Organization**: `frontend/tests/fixtures/{table_name}.yml`
- **Orchestration**: Playwright `beforeEach` hook calls a CLI helper to reset the DB.
- **CLI Helper**: `go run ./cmd/test-helper reset`
  - Wipes `./cashflow_test.db`.
  - Re-initializes using `internal/database/schema.sql`.
  - Loads all YAML files from the fixtures directory into their respective tables.
- **State**: The application stays running; SQLite handles the concurrent file access (resetting the file while the app is connected).

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

## Test Structure
- Location: `frontend/tests/`
- Pattern: `*.spec.ts`
- Conventions:
  - Page Object Model (POM) for common UI interactions.
  - `beforeEach` must invoke the DB reset/seed helper.

## Implementation Plan
1. **Schema Extraction**: (Done) Extracted DDL into `internal/database/schema.sql`.
2. **Environment Support**: Update `internal/database/db.go` to support configurable DB paths based on `APP_ENV`.
3. **CLI Test Helper**: Create `cmd/test-helper/main.go` to handle DB wipe, schema application, and YAML seeding.
4. **Playwright Setup**: Install Playwright in `frontend/`, configure `playwright.config.ts`.
5. **CI Integration**: Add `npm run test:e2e` to GitHub Actions.

## Example Fixture (`frontend/tests/fixtures/accounts.yml`)
```yaml
- name: "Checking"
  type: "checking"
- name: "Credit Card"
  type: "credit_card"
```

## Example Fixture (`frontend/tests/fixtures/transactions.yml`)
```yaml
- account: "Checking"
  date: "2023-10-01"
  description: "Safeway"
  amount: -54.20
  category: "Groceries"
```
