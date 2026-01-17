# CashMop

Desktop-first cash flow tracker; tech-savvy users; cross-platform (Windows, Linux, macOS); speed + delight focus.

**Release Status:** Pre-release (no v1.0 yet). Backward compatibility NOT a concern.

---

## Tech Stack

- Backend: Go 1.25; Wails v2
- Frontend: React 19; TypeScript; Vite
- UI: Tailwind CSS
- DB: SQLite local
- ORM: stdlib `database/sql` + `modernc.org/sqlite`
- Build: Wails CLI; npm scripts

## Project Rules You MUST Follow

- Subdir AGENTS.md exist; read relevant
- Feature specs: `docs/specs/`
- Frontend deps: `frontend/package.json` only; never root
- After Go or frontend changes: `make check` (go test/vet/tidy/build/vulncheck, typescript, integration tests)
- Docs-only changes: skip `make check`
- Use plain `make` commands by default (no `V=1`) unless explicitly requested.
- Integration tests rules: `frontend/tests/AGENTS.md`
- Frontend rules: `frontend/AGENTS.md`
- Migrations: `internal/database/migrations/*.sql`; see `internal/database/migrations/AGENTS.md`
- Uncategorized state: DB `NULL`; Go helpers accept `0` => `NULL` FKs
- Fuzzy search: `internal/fuzzy` (fzf)
  - Ranking: word/string start > mid; tie => shorter (`internal/fuzzy/fuzzy_test.go`)
  - Lists: Wails bindings only; no client `.includes()` / JS fuzzy
- Monetary amounts: cents only (INTEGER, int64) - never float64
  - User-facing (UI/CLI) amounts should be decimal strings; convert at boundaries
  - Exception: `fx_rates.rate` stays REAL
  - Frontend: `utils/currency.ts` (`formatCents`, `parseCents`)
  - Rounding: Go `math.Round(x + 0.5)`, JS `Math.round(x * 100)`
