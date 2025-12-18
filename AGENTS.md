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

## Project Rules You MUST Follow

- Always read `frontend/tailwind.config.js` when creating or editing UI components to ensure consistency with the design system (colors, fonts, shadows, animations, etc.).
- Check types with `npx tsc --noEmit` in the `frontend/` directory after editing .ts, .tsx files.
- Feature specs are located in `docs/specs/`. When updating them, keep formatting simple and token-efficient (bullet points, concise text, no inline formatting).

