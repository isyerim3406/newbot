#!/usr/bin/env bash
set -o errexit
set -o nounset
set -o pipefail

STORAGE_DIR=/opt/render/project/.render
CHROME_DIR="$STORAGE_DIR/chrome"
CHROMEDRIVER_DIR="$STORAGE_DIR/chromedriver"

mkdir -p "$CHROME_DIR"
mkdir -p "$CHROMEDRIVER_DIR"

echo "Using storage dir: $STORAGE_DIR"

DEB="$CHROME_DIR/google-chrome-stable_current_amd64.deb"
CHROME_BIN="$CHROME_DIR/opt/google/chrome/google-chrome"

# Try extract google chrome .deb
if [[ ! -x "$CHROME_BIN" ]]; then
  echo "Downloading Google Chrome .deb..."
  wget -q --show-progress https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb -O "$DEB" || true

  if [[ -f "$DEB" ]]; then
    echo "Extracting .deb (dpkg -x fallback to ar+tar)..."
    if dpkg -x "$DEB" "$CHROME_DIR" 2>/dev/null; then
      echo "dpkg -x ok"
    else
      echo "dpkg failed, trying ar + tar fallback..."
      cd "$CHROME_DIR"
      ar x "$DEB"
      if [[ -f data.tar.xz ]]; then
        tar -xf data.tar.xz -C "$CHROME_DIR"
      elif [[ -f data.tar.gz ]]; then
        tar -xf data.tar.gz -C "$CHROME_DIR"
      else
        echo "No data.tar.* in .deb, removing and will fallback to chrome-for-testing"
        rm -f "$DEB"
      fi
      cd - >/dev/null || true
    fi
  fi
fi

# fallback to chrome-for-testing if chrome binary missing
if [[ ! -x "$CHROME_BIN" ]]; then
  echo "Chrome binary not found, using chrome-for-testing fallback..."
  CFT_DIR="$CHROME_DIR/chrome-for-testing"
  mkdir -p "$CFT_DIR"
  if [[ ! -f "$CFT_DIR/chrome-linux64.zip" ]]; then
    wget -q --show-progress "https://storage.googleapis.com/chrome-for-testing/latest/linux64/chrome-linux64.zip" -O "$CFT_DIR/chrome-linux64.zip"
    unzip -o "$CFT_DIR/chrome-linux64.zip" -d "$CFT_DIR" >/dev/null
  fi
  CHROME_BIN=$(ls "$CFT_DIR"/*/chrome 2>/dev/null | head -n1 || true)
  if [[ -n "$CHROME_BIN" ]]; then
    chmod +x "$CHROME_BIN"
    echo "Using chrome-for-testing binary: $CHROME_BIN"
  fi
fi

if [[ -x "$CHROME_BIN" ]]; then
  echo "Chrome binary available: $($CHROME_BIN --version 2>/dev/null || echo 'no version')"
else
  echo "ERROR: No chrome binary available after attempts."
fi

# Detect chrome version
CHROME_VER=""
if [[ -x "$CHROME_BIN" ]]; then
  CHROME_VER="$($CHROME_BIN --version | awk '{print $3}' 2>/dev/null || true)"
fi
CHROME_MAJOR="$(echo "$CHROME_VER" | cut -d. -f1 || true)"
echo "Chrome version detected: $CHROME_VER (major: $CHROME_MAJOR)"

# Chromedriver download (chrome-for-testing)
DRIVER_DIR="$CHROMEDRIVER_DIR"
mkdir -p "$DRIVER_DIR"

if [[ ! -f "$DRIVER_DIR/chromedriver" ]]; then
  echo "Attempting to fetch chromedriver via chrome-for-testing metadata..."
  if [[ -n "$CHROME_MAJOR" ]]; then
    META="https://googlechromelabs.github.io/chrome-for-testing/latest-$CHROME_MAJOR.json"
    if curl --silent --fail "$META" -o /tmp/cdriver_meta.json; then
      URL=$(jq -r '.downloads[]?.platforms[]? | select(.platform=="linux64") | .url' /tmp/cdriver_meta.json | head -n1 || true)
    fi
  fi

  if [[ -z "${URL:-}" ]]; then
    URL="https://storage.googleapis.com/chrome-for-testing/latest/linux64/chromedriver-linux64.zip"
  fi

  echo "Downloading chromedriver from: $URL"
  wget -q --show-progress "$URL" -O "$DRIVER_DIR/chromedriver-linux64.zip"
  unzip -o "$DRIVER_DIR/chromedriver-linux64.zip" -d "$DRIVER_DIR" >/dev/null
  if [[ -f "$DRIVER_DIR/chromedriver" ]]; then
    chmod +x "$DRIVER_DIR/chromedriver"
  else
    FOUND=$(find "$DRIVER_DIR" -type f -name chromedriver | head -n1 || true)
    if [[ -n "$FOUND" ]]; then
      mv "$FOUND" "$DRIVER_DIR/chromedriver" || true
      chmod +x "$DRIVER_DIR/chromedriver" || true
    fi
  fi
  rm -f "$DRIVER_DIR/chromedriver-linux64.zip"
fi

echo "Chromedriver version:"
"$DRIVER_DIR/chromedriver" --version 2>/dev/null || echo "chromedriver not found"

echo "Build script finished"
cd "$HOME/project" || true
