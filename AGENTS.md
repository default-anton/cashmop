# Project rules & guidelines

Desktop-first cash flow tracker; tech-savvy users; cross-platform (Windows, Linux, macOS); speed + delight focus.
Current release platforms: macOS arm64, Linux amd64.

**Release Status:** Pre-release (current: v0.1.0; no v1.0 yet). Backward compatibility NOT a concern.

---

## Tech Stack

- Backend: Go 1.25; Wails v2
- Frontend: React 19; TypeScript; Vite
- UI: Tailwind CSS
- DB: SQLite local
- ORM: stdlib `database/sql` + `modernc.org/sqlite`
- Build: Wails CLI; pnpm scripts

## Project Rules You MUST Follow

- Subdir AGENTS.md exist; read relevant
- Feature specs: `docs/specs/`
- Release process: `docs/release.md`
- Frontend deps: `frontend/package.json` only; never root
- After Go changes: `make fmt` (goimports -w)
- After Go or frontend changes: `make check` (tidy, goimports check, vet, go test, typescript, vulncheck, integration)
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

## Repo map (frequent paths)

- `frontend/src/`: React UI (components, hooks, screens, utils)
- `frontend/tests/`: frontend integration tests
- `frontend/wailsjs/`: generated Wails bindings
- `internal/`: Go backend packages
  - `internal/database/`: DB layer; migrations in `internal/database/migrations/`
  - `internal/models/`: domain models
  - `internal/cli/`: CLI commands
  - `internal/config/`: config load/parse
  - `internal/fx/`: FX rates
  - `internal/paths/`: OS paths + app dirs
  - `internal/version/`: version metadata
  - `internal/brave/`: Brave Search client
- `cmd/`: helper binaries
- `tests/`: Go integration/CLI tests (`tests/cli/`)
- `docs/specs/`: feature specs
- `docs/todos/`: tracked TODOs
- `scripts/`: dev/build scripts
- `assets/`: branding assets
- `build/`: Wails build outputs
- `wails.json`: Wails config
- `app.go`, `main.go`: Wails app entrypoints
