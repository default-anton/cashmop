# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
### Changed
### Deprecated
### Removed
### Fixed
### Security

## [0.2.2] - 2026-01-28

### Added
- Settings: add "Sync missing rates" button to manually trigger FX rate synchronization

### Changed
- Import: perform FX rate sync synchronously so rates are available before the UI refreshes

### Fixed
- Improve FX sync and UI responsiveness after import (refresh transactions on FX updates, clear FX cache on import, allow retry for missing rates, always emit completion event)
- Tighten exchange rate settings layout

## [0.2.1] - 2026-01-27

### Added
- Owner filtering to financial analysis

### Changed
- Move transaction currency conversion to backend for improved performance and consistency
- Move temporary files and development databases to `/tmp`
- Suppress stale FX rate warnings when there are no recent foreign currency transactions

## [0.2.0] - 2026-01-22

### Changed
- Remove totals summary cards from Analysis screen

### Fixed
- Use current database path for backup instead of default
- CI: Improve reliability with pnpm 8.15.9, Vite port detection, webkit2gtk symlink, xvfb, and longer test timeouts

## [0.1.1] - 2026-01-21

### Added
- Bulk transaction deletion via Analysis screen
- Checkbox selection for transactions
- Delete confirmation modal with loading state
- 'Delete (N)' floating action button for selected transactions

### Fixed
- Race condition in delete flow: disable button while deleting

## [0.1.0] - 2026-01-21

### Added
- Initial release
- CSV/Excel transaction import
- Manual transaction entry
- Account and owner management
- Category management with color coding
- Categorization rules (contains, starts_with, ends_with, exact match)
- Search and filter transactions
- Automatic database backups with retention policy
- Pre-migration database backups
