# Pre-Release Checklist

> Created: 2025-12-29
> Status: Draft
> Target Release: v1.0.0

This checklist covers all items that should be addressed before releasing to customers. Items are prioritized by severity: **CRITICAL** (must fix), **HIGH** (should fix), **MEDIUM** (nice to have), **LOW** (future consideration).

---

## 🟠 HIGH

*No HIGH priority items at this time.*

---

## 🟡 MEDIUM

### 1. Release Infrastructure
- [ ] **Set up CI/CD** - No GitHub Actions or automated builds exist. Create workflow to:
  - Run tests on all PRs
  - Build for all platforms (windows/amd64, darwin/amd64, darwin/arm64, linux/amd64)
  - Generate release artifacts
- [ ] **Add version constant** - Create `var Version = "1.0.0"` in Go code, accessible via CLI or UI.
- [ ] **Create CHANGELOG.md** - Document changes for each release.
- [ ] **Configure code signing** - Set up certificates for each platform:
  - Windows: Authenticode certificate
  - macOS: Developer ID certificate
  - Linux: AppImage signing (optional)
- [ ] **Configure macOS notarization** - Required for distribution outside App Store.

### 2. Database Migration Improvements
- [ ] **Add rollback capability** - Migrations only move forward. Consider adding down migrations for development/testing.
- [ ] **Improve migration failure recovery** - App aborts on startup if migration fails. Add:
  - Automatic backup before migration
  - Rollback on failure
  - Better error messages
- [ ] **Fix date storage** - Dates stored as `TEXT` rather than ISO8601 format. May cause sorting/issues.
- [ ] **Fix currency storage** - `amount` stored as `REAL` may introduce floating-point precision issues. Use INTEGER (cents) or DECIMAL.

### 3. Test Coverage
- [ ] **Add database layer tests** - `internal/database/` has no tests for CRUD operations, migrations, or rule application.
- [ ] **Add app service tests** - `app.go` has 30+ methods with no test coverage.
- [ ] **Add component unit tests** - 23+ React components have no unit tests (only E2E tests exist).
- [ ] **Test edge cases** - Add tests for:
  - Empty files
  - Malformed CSV/Excel
  - Very large imports
  - Migration failures
  - Concurrent operations

### 4. Configuration Hardcoding
- [ ] **Make window dimensions configurable** - Hardcoded to 1024x768 in `main.go:20-21`.
- [ ] **Make Brave Search timeout configurable** - Hardcoded to 15s in `internal/brave/search.go:18`.
- [ ] **Make file size limit configurable** - Hardcoded to 10MB in `ImportFlow.tsx:126`.
- [ ] **Use environment-specific configs** - Only `APP_ENV=test` exists. Add support for dev/prod configs.

### 5. User Experience
- [ ] **Add onboarding** - No first-run experience for new users.
- [ ] **Improve error messages** - Some errors are technical (e.g., "failed to decode base64"). Make user-friendly.
- [ ] **Add progress indicators** - Large file imports show no progress.
- [ ] **Add undo functionality** - No way to undo accidental categorization or deletion.

### 6. Accessibility
- [ ] **Add ARIA labels** - Review interactive components for proper accessibility attributes.
- [ ] **Keyboard navigation** - Ensure all features are keyboard accessible.
- [ ] **Screen reader testing** - Test with NVDA (Windows) or VoiceOver (macOS).

---

## 🟢 LOW

### 1. Code Cleanup
- [ ] **Implement auto-categorization** - `ImportFlow.tsx:339` has TODO comment for this feature.
- [ ] **Remove duplicate schema.sql** - `internal/database/schema.sql` duplicates migration 001. Unclear if needed.
- [ ] **Add code coverage reporting** - Set up `go test -coverprofile` and frontend coverage reports.

### 2. Documentation
- [ ] **Add user guide** - No end-user documentation exists.
- [ ] **Add contributor guide** - No CONTRIBUTING.md for external contributors.
- [ ] **Document architecture** - Add architecture overview for maintainers.
- [ ] **Add troubleshooting guide** - Common issues and solutions.

### 3. Polish
- [ ] **Add about screen** - Show version, license, and credits.
- [ ] **Add check for updates** - Notify users when new versions are available.
- [ ] **Improve toast duration** - Default 5000ms may be too short for some messages.
- [ ] **Add keyboard shortcuts** - Power users would appreciate shortcuts for common actions.

---

## Post-Release (Future)

- [ ] **Telemetry/Analytics** - Consider anonymous usage tracking (with opt-out).
- [ ] **Cloud sync** - Multi-device synchronization.
- [ ] **Plugin system** - Allow user extensions.
- [ ] **Advanced reporting** - Charts, graphs, spending trends.
- [ ] **Recurring transactions** - Automatic transaction creation.

---

## Summary Statistics

| Priority | Items | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 0 | None |
| 🟠 HIGH | 0 | None |
| 🟡 MEDIUM | 24 | Nice to have |
| 🟢 LOW | 11 | Future consideration |

**Total: 35 items to review**

---

## Notes

- Items marked CRITICAL represent legal, data loss, or security issues that should block release.
- Items marked HIGH impact user experience significantly or pose moderate security risks.
- Test coverage is low but E2E tests cover critical user flows, which may be sufficient for v1.0.
- Consider releasing as beta to select users first to gather feedback on full release.
