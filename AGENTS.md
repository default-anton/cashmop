# Cashflow Tracker

Desktop-first cash flow tracking application for tech-savvy users. Cross-platform (Windows, Linux, macOS) with focus on speed and delight.

---

## Tech Stack

* Backend: Go 1.25 + Wails v2 framework
* Frontend: React 19 + TypeScript + Vite
* UI: Tailwind CSS
* Database: SQLite (local on-device)
* ORM: Standard library `database/sql` with `modernc.org/sqlite` driver
* Build: Wails CLI, npm scripts

## Project Rules You MUST Follow

- This project has AGENTS.md in subdirectories.
- Feature specs `docs/specs/`.
- Frontend dependencies belong in `frontend/package.json`. Never install npm packages in the root directory.
- After changing Go or frontend files, run `make check`. Runs: go test, vet, tidy, build, typescript, integration tests.
- About integration tests `frontend/tests/AGENTS.md`.
- Frontend rules to follow `frontend/AGENTS.md`.
- Database migrations are in `internal/database/migrations/*.sql`. Refer to `internal/database/migrations/AGENTS.md` for usage.
- Uncategorized state: Use `NULL` in the database to represent uncategorized items (transactions, rules, etc.). In Go helpers, allow passing `0` to signify `NULL` for foreign keys where appropriate.
- All fuzzy search uses `internal/fuzzy` (fzf).
    - Ranking: word/string starts outrank mid-string; ties favor shorter strings (see `internal/fuzzy/fuzzy_test.go`).
    - Lists must call Wails bindings; never client-side `.includes()` or JS fuzzy libs.
