# Release Process

## Versioning
- Tags: `vX.Y.Z` (SemVer).
- App version string: `X.Y.Z` (no leading `v`).

## Steps
1. Pick `X.Y.Z`.
2. Update versions:
   - `internal/version/version.go`
   - `wails.json` (`info.productVersion`)
   - `frontend/package.json` + `frontend/package-lock.json`
3. Update `CHANGELOG.md`:
   - Move items from `[Unreleased]`.
   - Add release header with date (`YYYY-MM-DD`).
4. Update `README.md` status + macOS install note (not notarized).
5. Run checks:
   - `make check`
6. Tag + push:
   - `git tag vX.Y.Z`
   - `git push origin vX.Y.Z`
7. Verify GitHub release artifacts:
   - `cashmop-macos-arm64-X.Y.Z.zip`
   - `cashmop-linux-amd64-X.Y.Z.AppImage`
   - `cashmop-linux-amd64-X.Y.Z.deb`
