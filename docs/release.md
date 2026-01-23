# Release Process

## Versioning
- Tags: `vX.Y.Z` (SemVer).
- App version string: `X.Y.Z` (no leading `v`).

## Steps
1. Pick `X.Y.Z`.
2. Update `CHANGELOG.md` first (must be done before tagging):
   - Move items from `[Unreleased]`.
   - Add release header with date (`YYYY-MM-DD`).
3. Update versions:
   - `internal/version/version.go`
   - `wails.json` (`info.productVersion`)
   - `frontend/package.json` + `frontend/package-lock.json`
4. Update `README.md` status + macOS install note (not notarized).
5. Run checks:
   - `make check`
6. Commit + push changes (CRITICAL: do NOT skip):
   - `git add CHANGELOG.md internal/version/version.go wails.json frontend/package.json frontend/package-lock.json README.md`
   - `git commit -m "Release vX.Y.Z"`
   - `git push origin main`
7. Tag + push:
   - `git tag vX.Y.Z`
   - `git push origin vX.Y.Z`
8. Update GitHub release notes with changelog:
   - GitHub Actions auto-creates release (empty notes).
   - Update with `CHANGELOG.md` content for version:
     ```bash
     VERSION=0.1.1
     gh release edit v$VERSION --notes "$(./scripts/extract-changelog.ts $VERSION)"
     ```
9. Verify GitHub release artifacts:
   - Release notes match `CHANGELOG.md` section
   - `cashmop-macos-arm64-X.Y.Z.zip`
   - `cashmop-linux-amd64-X.Y.Z.AppImage`
   - `cashmop-linux-amd64-X.Y.Z.deb`

## Common Pitfalls

- **Forgot to commit & push before tagging**: If you tag without committing/pushing changes to `CHANGELOG.md`, version files, and docs, the tag will point to stale commits. Always complete step 6 (commit + push) before step 7 (tag).
