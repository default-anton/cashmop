# Multi-Currency Spec

UI Location: `frontend/src/screens/Settings/`, `frontend/src/screens/Analysis/`, `frontend/src/screens/ImportFlow/`, `frontend/src/screens/CategorizationLoop/`, transaction tables

## Core Experience
- Multi-currency transactions; single Main Currency for totals, sorting, filters, rules.
- Amount display: main-currency amount always; original amount + currency optional via global toggle.
- Rates cached locally; app works offline; conversions computed on demand.

## Settings
- Currency card
  - Main Currency (default CAD)
  - Show original transaction currency (default off)
  - Exchange rate freshness (latest rate date; stale warning when >7 days)
- Settings stored in DB (not config files).

## Conversion Rules
- `converted_amount = amount * rate`.
- `rate` is base per 1 quote (e.g., CAD per USD when base is CAD).
- Same-currency conversion = 1.
- If no rate exists on/before date: converted amount `null`, UI shows `—`, totals exclude missing-rate items.
- Closest previous rate used for weekends/holidays.

## Rates & Providers
- Provider chosen by Main Currency.
- Current provider: CAD via Bank of Canada daily average (series `FX{QUOTE}CAD`).
- If main currency has no provider: conversions disabled + blocking error.
- If a transaction currency has no provider data: missing-rate warning.

## Sync + Cache
- On startup and after import, async FX sync for currencies + date ranges seen in transactions.
- Fetch missing ranges only, with a 7-day buffer before the minimum transaction date (for weekend/holiday coverage).
- `fx_last_sync` stored on successful sync; UI listens for rates-updated event + refresh.

## Import Flow
- Currency mapping step optional; default currency applied if column missing.
- Import preview shows per-row original currency.

## Export
- Export always includes both amounts + original currency columns.

## Data Model
- `app_settings` keys: `main_currency`, `show_original_currency`, `fx_last_sync`.
- `fx_rates` rows keyed by `(base_currency, quote_currency, rate_date, source)` with `rate`.

## Warnings
- Stale rates (>7 days): banner on all amount screens.
- Missing rates: stronger banner; amounts show `—` and excluded from totals.
