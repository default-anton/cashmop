# Cashflow Tracker

Desktop-first cash flow tracking application for tech-savvy users. Cross-platform (Windows, Linux, macOS) with focus on speed and delight.

---

## Tech Stack

* Backend: Go 1.25 + Wails v2 framework
* Frontend: React 18 + TypeScript + Vite
* UI: Tailwind CSS
* Database: SQLite (local on-device)
* ORM: Standard library `database/sql` with `modernc.org/sqlite` driver
* Build: Wails CLI, npm scripts

## Feature Specifications

- [Data Ingestion (Import Flow)](./docs/specs/import-flow.md)
- [The Categorization Loop](./docs/specs/categorization-loop.md)
- [Analysis Screen](./docs/specs/analysis.md)

## Project Rules You MUST Follow

- Feature specs are located in `docs/specs/`. When updating them, keep formatting simple and token-efficient (bullet points, concise text, no inline formatting).
- Frontend dependencies belong in `frontend/package.json`. Never install npm packages in the root directory.
- `wails dev` is always running. Use the browser skill to verify and test UI changes. The DevServer URL is http://localhost:34115.
- After changing Go files, run `go test ./...`, `go vet ./...`, `go mod tidy`, and `wails build` to ensure the backend is healthy and compiles without issues.

## Integration Testing

- Orchestration: Run `./scripts/run-integration-tests.sh` to start Wails dev server in test mode and run Playwright tests.
- Knowledge: Detailed implementation details and gotchas in `docs/knowledge/integration-testing.md`.

## Database Conventions

- Uncategorized state: Use `NULL` in the database to represent uncategorized items (transactions, rules, etc.). In Go helpers, allow passing `0` to signify `NULL` for foreign keys where appropriate.

## Fuzzy Matching

- Implementation: All fuzzy searching uses `internal/fuzzy` (encapsulating the `fzf` algorithm).
- Ranking Priority: Matches at string/word starts > middle-string fuzzy matches. Tie-break: shorter strings first.
- Hard Rule: Avoid client-side `.includes()` or JS fuzzy libraries for lists. Always use Wails bindings to `internal/fuzzy` to ensure consistent ranking and behavior across the UI.
- Reference: `internal/fuzzy/fuzzy_test.go` for ranking verification.
