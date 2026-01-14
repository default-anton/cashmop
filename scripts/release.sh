#!/bin/bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/release.sh --target <linux|macos> --arch <amd64|arm64> --version <version> [--output <dir>]

Examples:
  scripts/release.sh --target macos --arch arm64 --version v0.2.0
  scripts/release.sh --target linux --arch amd64 --version v0.2.0
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

mkdir -p "$OUTPUT_DIR"

case "$TARGET" in
  macos)
    if [ "$ARCH" != "arm64" ]; then
      echo "macOS builds only supported for arm64"
      exit 1
    fi

    wails build --platform darwin/$ARCH

    APP_PATH=$(ls build/bin/*.app | head -n 1)
    if [ -z "$APP_PATH" ]; then
      echo "No .app bundle found in build/bin"
      exit 1
    fi

    codesign --force --deep --sign - "$APP_PATH"

    ZIP_NAME="$OUTPUT_DIR/cashmop-macos-$ARCH-$VERSION.zip"
    ditto -c -k --sequesterRsrc --keepParent "$APP_PATH" "$ZIP_NAME"
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

    APPIMAGE_NAME="$OUTPUT_DIR/cashmop-linux-$ARCH-$VERSION.AppImage"
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
Version: $VERSION
Section: utils
Priority: optional
Architecture: $ARCH
Maintainer: Anton Kuzmenko <1917237+default-anton@users.noreply.github.com>
Description: CashMop desktop app
EOF

    DEB_NAME="$OUTPUT_DIR/cashmop-linux-$ARCH-$VERSION.deb"
    dpkg-deb --build "$DEB_DIR" "$DEB_NAME"
    ;;
  *)
    echo "Unknown target: $TARGET"
    usage
    exit 1
    ;;
esac
