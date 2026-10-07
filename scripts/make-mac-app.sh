#!/bin/bash
# Builds TypeRush.app (default: ~/Applications) with its icon. Re-run after changing the app.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="${TYPERUSH_APP_DIR:-$HOME/Applications}"
APP="$APP_DIR/TypeRush.app"
BUNDLE_ID="local.typerush.app"
NODE="$(command -v node)"
cd "$ROOT"

npm run build

# Icon: 1024px PNG -> .iconset -> .icns
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
ICONSET="$WORK/AppIcon.iconset"
mkdir "$ICONSET"
for s in 16 32 128 256 512; do
  sips -z $s $s assets/icon-1024.png --out "$ICONSET/icon_${s}x${s}.png" >/dev/null
  sips -z $((s * 2)) $((s * 2)) assets/icon-1024.png --out "$ICONSET/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$WORK/AppIcon.icns"

# Only ever replace a previous TypeRush build.
if [ -e "$APP" ]; then
  existing="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP/Contents/Info.plist" 2>/dev/null || true)"
  if [ "$existing" != "$BUNDLE_ID" ]; then
    echo "Refusing to replace $APP: it is not a TypeRush build." >&2
    exit 1
  fi
  rm -rf "$APP"
fi

mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp -R dist "$APP/Contents/Resources/dist"
cp scripts/serve.mjs scripts/serve-lib.mjs "$APP/Contents/Resources/"
cp "$WORK/AppIcon.icns" "$APP/Contents/Resources/AppIcon.icns"
sed "s|__NODE__|$NODE|" scripts/mac-launcher.sh > "$APP/Contents/MacOS/TypeRush"
chmod +x "$APP/Contents/MacOS/TypeRush"

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>TypeRush</string>
  <key>CFBundleDisplayName</key><string>TypeRush</string>
  <key>CFBundleIdentifier</key><string>$BUNDLE_ID</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>CFBundleShortVersionString</key><string>0.2.0</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>TypeRush</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>LSUIElement</key><true/>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
</dict>
</plist>
PLIST

touch "$APP"
echo "Built $APP"
echo "Open it from Finder (or drag it to the Dock)."
