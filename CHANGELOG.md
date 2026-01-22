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
