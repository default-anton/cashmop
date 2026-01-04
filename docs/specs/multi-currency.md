# Multi-Currency Spec

UI Location: `frontend/src/screens/Settings/`, `frontend/src/screens/Analysis/`, `frontend/src/screens/ImportFlow/`, `frontend/src/screens/CategorizationLoop/`, any transaction tables

## Core Experience
- App supports transactions in multiple currencies.
- User selects a single **Main Currency** (global, app-wide) used for all totals, sorting, filtering, and comparisons.
- Transaction rows show **both**:
  - Converted amount in main currency
  - Original transaction amount + currency (toggleable)
- Official daily average rates from central banks are used (for CAD main currency, Bank of Canada daily average).
- Rates are cached locally and work offline; conversions recompute live.

## Settings
- New Settings card: **Currency**
  - Main Currency (default: CAD)
  - Toggle: **Show original transaction currency** (global setting, synced across pages, default: **off**)
  - Status row: **Exchange rate freshness** (Last update date, warning when stale > 7 days)
- Settings are persisted in DB (not config files).
- Currency pickers use the full ISO 4217 list; only currencies with an official source are convertible.

## Data Model
- New table: `app_settings`
  - `key TEXT PRIMARY KEY`, `value TEXT NOT NULL`
  - Keys:
    - `main_currency` (default `CAD`)
    - `show_original_currency` (`true`/`false`, default `true`)
    - `fx_last_sync` (ISO date string; last date fetched for the main currency)
- New table: `fx_rates`
  - `base_currency TEXT NOT NULL` (the main currency)
  - `quote_currency TEXT NOT NULL` (transaction currency)
  - `rate_date TEXT NOT NULL` (YYYY-MM-DD)
  - `rate REAL NOT NULL`
  - `source TEXT NOT NULL` (e.g., `boc`)
  - `created_at DATETIME DEFAULT CURRENT_TIMESTAMP`
  - Unique index: `(base_currency, quote_currency, rate_date, source)`
- Conversion rule: `converted_amount = amount * rate`
  - `rate` is **base per 1 quote** (e.g., CAD per USD when base is CAD)
  - If `quote_currency == base_currency`, rate = 1

## Rate Sourcing (CAD Main Currency)
- Provider: Bank of Canada Valet API (daily average).
- Series: `FX{QUOTE}CAD` for each quote currency.
- Reference implementation for BoC fetching + closest-previous lookup: `/Users/akuzmenko/code/flow/python_script/family_cashflow.py` (see `_get_exchange_rates` and `_find_closest_previous_date`).
- Fetch only needed currencies:
  - `quote_currency` values present in transactions, excluding base currency.
- Fetch only needed dates:
  - Determine min/max transaction dates for those currencies.
  - Fetch missing ranges only (delta fetch).
- If the exact date is missing (weekend/holiday), use the **closest previous** available date.
- If a transaction currency is not available from the provider, mark it as unsupported and show warnings (no conversion).

## Multi-Provider Architecture
- Rate providers are selected by **main currency**.
- Initial supported main currency: **CAD** only.
- Interface should allow adding official sources later (e.g., USD, EUR) without schema changes.
- If a main currency is selected without a provider, show a blocking error + disable conversion until supported.

## Conversion Rules
- All amount comparisons (sorting, filters, categorization rules) use **main-currency amounts**.
- Main-currency amounts are computed on demand (no stored converted amounts).
- If no rate exists at or before a date for a currency pair:
  - Converted amount is `null`
  - UI shows `—` and a warning banner (see Warnings)
  - Totals exclude missing-rate transactions

## UI/UX
- Transaction tables show:
  - Main currency amount in the primary amount column
  - Original amount + currency displayed next to it when setting is enabled
- Subtle per-page toggle (mirrors global setting) to show/hide original currency:
  - Uses the same global setting; changes propagate across pages.
- Column headers should label the main currency (e.g., `Amount (CAD)`), and optional subtext for original.

## Import Flow
- Currency mapping step already exists; ensure it flows into backend:
  - `TransactionInput` includes `currency`
  - Normalize rows uses mapped currency column or default currency
- Default currency from mapping is used when per-row currency is missing.
- Import preview tables show original currency for each row.

## Export
- Export includes both amounts:
  - `Amount (Main)`
  - `Amount (Original)`
  - `Currency (Original)`
- If original currency is hidden in UI, export still includes original columns.

## Background Sync
- On app startup and after import, trigger async rate sync:
  - Determine needed currencies + date ranges
  - Fetch only missing dates for each currency pair
- Store `fx_last_sync` when sync completes.
- Sync is non-blocking; UI should render with existing cached rates.
- When new rates are fetched, Go emits an event (Wails runtime) that the frontend listens for:
  - Frontend shows a toast (“Exchange rates updated”) and refreshes any amounts on screen.
  - Add a `CurrencyContext` in `frontend/src/contexts/` that:
    - exposes main currency + show-original flag
    - subscribes to the rates-updated event and triggers UI refresh

## Offline + Staleness Warnings
- App must function without network using cached rates.
- If the latest available rate date is **> 7 days** behind today:
  - Show a warning banner on every screen that displays amounts
  - Banner includes latest rate date and suggests syncing
- If rates are missing entirely for a currency pair, show a stronger warning banner.

## API / Wails Bindings
- Settings:
  - `GetAppSetting(key)` / `SetAppSetting(key, value)` or typed equivalents
  - `GetCurrencySettings()` / `UpdateCurrencySettings()` preferred for batching
- Rates:
  - `SyncFxRates()` (async trigger)
  - `GetFxRate(base, quote, date)` (uses closest previous date)
  - `GetFxRateStatus()` (latest date per pair, last sync date)
- Transactions:
  - `TransactionInput` includes `currency`
  - `TransactionModel` returns `currency` + `amount` (original), plus computed main amount on the frontend

## Testing
- Unit tests:
  - Rate lookup (exact date + closest previous)
  - Conversion math and missing-rate handling
- Integration:
  - Import flow uses currency mapping and saves transaction currency
  - Analysis totals use converted amounts and respect missing-rate exclusions
- UI:
  - Toggle persists and affects all screens
  - Warning banner shows when rates are stale or missing
