#!/bin/bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/release.sh --target <linux|macos> --arch <amd64|arm64> --version <version> [--output <dir>]

Examples:
  scripts/release.sh --target macos --arch arm64 --version v0.1.0
  scripts/release.sh --target linux --arch amd64 --version v0.1.0
EOF
}

TARGET=""
ARCH=""
VERSION=""
OUTPUT_DIR="dist"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --target)
      TARGET="$2"
      shift 2
      ;;
    --arch)
      ARCH="$2"
      shift 2
      ;;
    --version)
      VERSION="$2"
      shift 2
      ;;
    --output)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1"
      usage
      exit 1
      ;;
  esac
 done

if [ -z "$TARGET" ] || [ -z "$ARCH" ] || [ -z "$VERSION" ]; then
  usage
  exit 1
fi

VERSION_TAG="$VERSION"
VERSION_SEMVER="${VERSION_TAG#v}"

mkdir -p "$OUTPUT_DIR"

case "$TARGET" in
  macos)
    if [ "$ARCH" != "arm64" ]; then
      echo "macOS builds only supported for arm64"
      exit 1
    fi

    wails build --platform darwin/$ARCH

    EXPECTED_APP_PATH="build/bin/CashMop.app"

    DISCOVERED_APP_PATH=$(ls -d build/bin/*.app 2>/dev/null | head -n 1 || true)
    if [ -z "$DISCOVERED_APP_PATH" ]; then
      echo "No .app bundle found in build/bin"
      exit 1
    fi

    if [ "$(basename "$DISCOVERED_APP_PATH")" != "CashMop.app" ]; then
      TEMP_APP_PATH="build/bin/.cashmop-rename-$$.app"
      if [ -e "$TEMP_APP_PATH" ]; then
        echo "Temporary app path already exists: $TEMP_APP_PATH"
        exit 1
      fi

      mv "$DISCOVERED_APP_PATH" "$TEMP_APP_PATH"
      mv "$TEMP_APP_PATH" "$EXPECTED_APP_PATH"
    fi

    APP_PATH=$(ls -d build/bin/*.app 2>/dev/null | head -n 1 || true)
    if [ "$APP_PATH" != "$EXPECTED_APP_PATH" ]; then
      echo "Expected canonical app bundle at $EXPECTED_APP_PATH, found: ${APP_PATH:-<none>}"
      exit 1
    fi

    if [ "${SKIP_CODESIGN:-}" != "1" ]; then
      if ! codesign --force --deep --sign - "$APP_PATH"; then
        echo "codesign failed; continuing without signing"
      fi
    fi

    ZIP_NAME="$OUTPUT_DIR/cashmop-macos-$ARCH-$VERSION_SEMVER.zip"
    ditto -c -k --sequesterRsrc --keepParent "$APP_PATH" "$ZIP_NAME"

    if ! unzip -l "$ZIP_NAME" | grep 'CashMop\.app/' >/dev/null; then
      echo "macOS zip does not contain CashMop.app: $ZIP_NAME"
      exit 1
    fi
    ;;
  linux)
    wails build --platform linux/$ARCH

    BIN_PATH="build/bin/cashmop"
    if [ ! -f "$BIN_PATH" ]; then
      echo "Missing linux binary: $BIN_PATH"
      exit 1
    fi

    WORK_DIR=$(mktemp -d)
    APPDIR="$WORK_DIR/AppDir"
    mkdir -p "$APPDIR/usr/bin"
    cp "$BIN_PATH" "$APPDIR/usr/bin/cashmop"
    cp build/appicon.png "$APPDIR/cashmop.png"

    cat > "$APPDIR/cashmop.desktop" <<'EOF'
[Desktop Entry]
Name=CashMop
Exec=cashmop
Icon=cashmop
Type=Application
Categories=Office;Finance;
EOF

    cat > "$APPDIR/AppRun" <<'EOF'
#!/bin/sh
HERE=$(dirname "$(readlink -f "$0")")
exec "$HERE/usr/bin/cashmop" "$@"
EOF

    chmod +x "$APPDIR/AppRun"

    if ! command -v appimagetool >/dev/null 2>&1; then
      echo "appimagetool is required for AppImage packaging"
      exit 1
    fi

    APPIMAGE_NAME="$OUTPUT_DIR/cashmop-linux-$ARCH-$VERSION_SEMVER.AppImage"
    appimagetool "$APPDIR" "$APPIMAGE_NAME"

    DEB_DIR="$WORK_DIR/deb"
    mkdir -p "$DEB_DIR/DEBIAN" "$DEB_DIR/usr/bin" "$DEB_DIR/usr/share/applications" "$DEB_DIR/usr/share/icons/hicolor/512x512/apps"
    cp "$BIN_PATH" "$DEB_DIR/usr/bin/cashmop"
    cp build/appicon.png "$DEB_DIR/usr/share/icons/hicolor/512x512/apps/cashmop.png"

    cat > "$DEB_DIR/usr/share/applications/cashmop.desktop" <<'EOF'
[Desktop Entry]
Name=CashMop
Exec=cashmop
Icon=cashmop
Type=Application
Categories=Office;Finance;
EOF

    cat > "$DEB_DIR/DEBIAN/control" <<EOF
Package: cashmop
Version: $VERSION_SEMVER
Section: utils
Priority: optional
Architecture: $ARCH
Maintainer: Anton Kuzmenko <1917237+default-anton@users.noreply.github.com>
Description: CashMop desktop app
EOF

    DEB_NAME="$OUTPUT_DIR/cashmop-linux-$ARCH-$VERSION_SEMVER.deb"
    dpkg-deb --build "$DEB_DIR" "$DEB_NAME"
    ;;
  *)
    echo "Unknown target: $TARGET"
    usage
    exit 1
    ;;
esac
