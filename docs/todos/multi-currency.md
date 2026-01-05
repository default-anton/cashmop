# Multi-Currency Todo

> Spec: docs/specs/multi-currency.md
> Created: 2026-01-05
> Status: In Progress

## Milestones
- [x] 1. Backend schema + settings/rates data access + unit tests
- [x] 2. FX provider (BoC) + sync orchestration + Wails events
- [x] 2b. BoC provider record/replay integration test (cassette pattern)
- [x] 3. Currency settings UI + global context + warnings
- [x] 4. Transaction display + import/export/analysis conversions
- [ ] 5. Integration/UI test coverage updates

## Progress Log
- 2026-01-05: Initialized todo and milestones.
- 2026-01-05: Completed milestone 1 (migrations, currency settings + fx rate access, unit tests). Default show-original set to false per Settings section; reconcile if spec expects true.
- 2026-01-05: Added FX provider + sync orchestration and DB helpers for currency ranges and FX status.
- 2026-01-05: Wired FX sync into app startup/import, added Wails bindings and rates-updated event emission.
- 2026-01-05: Skipped FX sync when app context is nil to keep in-memory tests stable.
- 2026-01-05: Added BoC record/replay cassette test and recorded baseline response fixture.
- 2026-01-05: Added CurrencyContext, settings card, and main currency/show-original wiring; warning banners in amount screens next.
- 2026-01-05: Added FX warning banners across Analysis/Import/Categorization and completed milestone 3.
- 2026-01-05: Swapped Settings main currency selector to AutocompleteInput and updated frontend rules.
- 2026-01-05: Wired import flow to carry currency, defaulting to main currency when unmapped.
- 2026-01-05: Updated analysis + categorization to compute main-currency amounts client-side, show original toggles, and flag missing-rate banners.
- 2026-01-05: Adjusted rule matching/search + exports to use main-currency conversions and include original/main amounts on export.
- 2026-01-05: make check timed out during go test ./... (retry with a longer timeout or run go test ./... separately).
