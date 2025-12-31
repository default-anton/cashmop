# Pre-Release Checklist

> Created: 2025-12-29
> Status: Draft
> Target Release: v1.0.0

This checklist covers all items that should be addressed before releasing to customers. Items are prioritized by severity: **CRITICAL** (must fix), **HIGH** (should fix), **MEDIUM** (nice to have), **LOW** (future consideration).

---

## 🔴 CRITICAL

*No CRITICAL priority items at this time.*

---

## 🟠 HIGH

### 1. Release Infrastructure
- [ ] **Set up CI/CD** - Create GitHub Actions workflow to:
  - Run tests (`make check`) on all PRs
  - Build for all platforms (windows/amd64, darwin/amd64, darwin/arm64, linux/amd64)
  - Generate release artifacts
- [ ] **Configure code signing** - Set up certificates for each platform:
  - Windows: Authenticode certificate
  - macOS: Developer ID certificate
- [ ] **Configure macOS notarization** - Required for distribution outside App Store.

---

## 🟡 MEDIUM

### 1. User Experience
- [ ] **Add undo functionality** - No way to undo accidental categorization or deletion.

### 2. Test Coverage
- [ ] **Test migration failures** - Add tests for migration rollback scenarios when schema updates fail.

---

## 🟢 LOW

### 1. Polish
- [ ] **Add about screen** - Show version, license, and credits (version available via `GetVersion()` binding).
- [ ] **Add check for updates** - Notify users when new versions are available.
- [ ] **Add keyboard shortcuts** - Beyond Cmd+K for web search, add shortcuts for common actions (import, export, settings).
- [ ] **Improve toast duration** - Default 5000ms may be too short for some messages; consider message-type-specific durations.

### 2. Documentation
- [ ] **Add user guide** - No end-user documentation exists.
- [ ] **Add architecture overview** - Document architecture for maintainers.

### 3. Code Quality
- [ ] **Implement auto-categorization** - `ImportFlow.tsx:288` has TODO comment for automatic categorization during import.

---

## Post-Release (Future)

- [ ] **Fix currency storage** - `amount` stored as `REAL` may introduce floating-point precision issues (e.g., 0.1 + 0.2 != 0.3). Migrating to INTEGER (cents) storage is deferred to v1.1+ due to migration complexity and risk. Practical impact is minimal for typical transaction amounts.
- [ ] **Cloud sync** - Multi-device synchronization.
- [ ] **Plugin system** - Allow user extensions.
- [ ] **Advanced reporting** - Charts, graphs, spending trends.
- [ ] **Recurring transactions** - Automatic transaction creation.

---

## Notes

- Items marked CRITICAL represent legal, data loss, or security issues that should block release.
- Items marked HIGH impact release quality significantly (infrastructure for distribution).
