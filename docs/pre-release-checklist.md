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
- [ ] **Configure code signing** - https://wails.io/docs/guides/signing/ Set up certificates for each platform:
  - Windows: Authenticode certificate
  - macOS: Developer ID certificate
- [ ] **Configure macOS notarization** - Required for distribution outside App Store.

---

## 🟡 MEDIUM

*No MEDIUM priority items at this time.*

---

## 🟢 LOW

### 1. Polish
- [ ] **Add check for updates** - Notify users when new versions are available.

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
