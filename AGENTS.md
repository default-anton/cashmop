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

- Feature specs are here `docs/specs/`.
- Frontend dependencies belong in `frontend/package.json`. Never install npm packages in the root directory.
- Assume `wails dev` is running. If not, start it yourself in background (clean up when you're done). Use the browser skill to verify and test UI changes. The DevServer URL is http://localhost:34115.
- After changing Go files, run `make check` to ensure the backend is healthy and compiles without issues. This runs: `go test ./...`, `go vet ./...`, `go mod tidy`, and `wails build`.

## Integration Testing

- Run `./scripts/run-integration-tests.sh` to start Wails dev server in test mode and run Playwright tests.

## Database Conventions

- Uncategorized state: Use `NULL` in the database to represent uncategorized items (transactions, rules, etc.). In Go helpers, allow passing `0` to signify `NULL` for foreign keys where appropriate.

## Fuzzy Matching

- All fuzzy search uses `internal/fuzzy` (fzf).
- Ranking: word/string starts outrank mid-string; ties favor shorter strings (see `internal/fuzzy/fuzzy_test.go`).
- Lists must call Wails bindings; never client-side `.includes()` or JS fuzzy libs.
