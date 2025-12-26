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
