# Cashflow Tracker

Desktop-first cash flow tracker; tech-savvy users; cross-platform (Windows, Linux, macOS); speed + delight focus.

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
- After Go or frontend changes: `make check` (go test/vet/tidy/build, typescript, integration)
- Integration tests rules: `frontend/tests/AGENTS.md`
- Frontend rules: `frontend/AGENTS.md`
- Migrations: `internal/database/migrations/*.sql`; see `internal/database/migrations/AGENTS.md`
- Uncategorized state: DB `NULL`; Go helpers accept `0` => `NULL` FKs
- Fuzzy search: `internal/fuzzy` (fzf)
  - Ranking: word/string start > mid; tie => shorter (`internal/fuzzy/fuzzy_test.go`)
  - Lists: Wails bindings only; no client `.includes()` / JS fuzzy
