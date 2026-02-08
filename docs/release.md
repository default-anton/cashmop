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
   - `frontend/package.json` + `frontend/pnpm-lock.yaml`
4. Update `README.md` status + macOS install note (not notarized).
5. Run checks:
   - `make check`
6. Commit + push changes (CRITICAL: do NOT skip):
   - `git add CHANGELOG.md internal/version/version.go wails.json frontend/package.json frontend/pnpm-lock.yaml README.md`
   - `git commit -m "Release vX.Y.Z"`
   - `git push origin main`
7. Tag + push:
   - `git tag vX.Y.Z`
   - `git push origin vX.Y.Z`
8. Wait for GitHub Actions to finish (REQUIRED):
   - Wait for the `release` workflow for the tag commit:
     ```bash
     VERSION=0.1.1
     SHA=$(git rev-list -n 1 v$VERSION)
     RELEASE_RUN_ID=$(gh run list --workflow release --limit 30 --json databaseId,headSha --jq ".[] | select(.headSha == \"$SHA\") | .databaseId" | head -n1)
     gh run watch "$RELEASE_RUN_ID" --exit-status
     ```
   - Also wait for CI on the release commit:
     ```bash
     CI_RUN_ID=$(gh run list --workflow ci --limit 30 --json databaseId,headSha --jq ".[] | select(.headSha == \"$SHA\") | .databaseId" | head -n1)
     gh run watch "$CI_RUN_ID" --exit-status
     ```
9. Update GitHub release notes with changelog:
   - Update with `CHANGELOG.md` content for version:
     ```bash
     VERSION=0.1.1
     gh release edit v$VERSION --notes "$(./scripts/extract-changelog.ts $VERSION)"
     ```
10. Verify GitHub release artifacts:
   - Release notes match `CHANGELOG.md` section
   - `cashmop-macos-arm64-X.Y.Z.zip`
   - `cashmop-linux-amd64-X.Y.Z.AppImage`
   - `cashmop-linux-amd64-X.Y.Z.deb`
   - Quick check command:
     ```bash
     VERSION=0.1.1
     gh release view v$VERSION --json assets --jq '.assets[].name'
     ```
