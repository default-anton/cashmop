# Multi-Currency Todo

> Spec: docs/specs/multi-currency.md
> Created: 2026-01-05
> Status: Done

## Context
- Spec: docs/specs/multi-currency.md
- Goal: multi-currency amounts + main-currency conversions; show-original toggle + warnings
- Constraints: CAD provider only; show_original default off; Playwright integration via `make check`

## Milestones
- [x] 1. Backend schema + settings/rates data access + unit tests
- [x] 2. FX provider (BoC) + sync orchestration + Wails events
- [x] 2b. BoC provider record/replay integration test (cassette pattern)
- [x] 3. Currency settings UI + global context + warnings
- [x] 4. Transaction display + import/export/analysis conversions
- [x] 5. Integration/UI test coverage updates

## Progress
- 2026-01-05: Milestones 1-5 complete.

## Changes
- `cmd/test-helper/main.go`: fixtures load `app_settings`/`fx_rates`, per-transaction currency override.
- `frontend/tests/fixtures/transactions.yml`, `frontend/tests/fixtures/fx_rates.yml`, `frontend/tests/fixtures/sample_import.csv`: USD + unsupported currency fixtures; currency column in CSV.
- `frontend/tests/import.spec.ts`, `frontend/tests/multi_currency.spec.ts`: import currency mapping + show-original verification; missing-rate warning/placeholder coverage.
- `docs/specs/multi-currency.md`: show_original default false.
- Tests: `make check`.

## Open
- None.

## Next
- None.
