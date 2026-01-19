# CashMop

Desktop-first cash flow tracking. Import messy bank exports, normalize once, punch through categorization fast, and export clean data. Local-only, open source, no cloud.

**Status:** Pre-release (v0.1.0). Backward compatibility not guaranteed.

![CashMop logo](frontend/src/assets/branding/logo-landscape.png)

Screenshot and walkthrough coming soon.

## Workflow

1. Import CSV/XLSX exports from banks or apps.
2. Map columns once, then punch through categorization in the loop.
3. Review analysis, filter/group, and export cleaned data.

## Core Features

- **Import Flow:** Vertical punch-through mapping for CSV/XLSX with previews.
- **Categorization Loop:** One transaction at a time, keyboard-first, inbox-zero flow.
- **Undo/Redo:** Fast recovery while punching through categories.
- **Rules:** Contains/Starts With/Ends With/Exact matching with amount filters.
- **Multi-Currency:** Conversion and display support (main currency must be CAD today).
- **Analysis + Export:** Month selector, grouping by category/owner/account, export CSV/XLSX.
- **Backups:** Automatic daily backups, pre-migration backups, manual restore.
- **Local-Only:** SQLite database stored on your machine.

## Tech Stack

- Go 1.25 + Wails v2
- React 19 + TypeScript + Vite
- SQLite + Tailwind CSS

## Getting Started

### Installation
Download the latest build from `https://github.com/default-anton/cashmop/releases`.

macOS (Apple Silicon): unzip and drag to Applications. Not notarized; Gatekeeper will warn. If blocked:
```bash
xattr -dr com.apple.quarantine CashMop.app
```

Linux: use AppImage (recommended; works on Arch) or `.deb` (Debian/Ubuntu).

### Development
1. Install Go 1.25+, Node.js, and the Wails CLI.
2. Install frontend dependencies:
   ```bash
   cd frontend
   npm ci
   ```
3. Run the dev app:
   ```bash
   make dev
   ```
4. Run validation:
   ```bash
   make check
   ```
5. Build a production bundle:
   ```bash
   make build
   ```

## Roadmap

- [ ] Sole-proprietor tools (receipts, flags, exports).
- [ ] Forecasting and cash flow projections.

## License

Licensed under the [Apache License 2.0](./LICENSE).
