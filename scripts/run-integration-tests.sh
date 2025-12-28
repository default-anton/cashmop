#!/bin/bash
set -e

# Build test helper once
echo "Building test-helper..."
mkdir -p build/bin
go build -o ./build/bin/test-helper ./cmd/test-helper/main.go

# Cleanup on exit
ROOT_DIR=$(pwd)
PID_FILE="$ROOT_DIR/.wails_dev.pid"
cleanup() {
  if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    echo "Stopping Wails dev server (PID: $PID)..."
    kill "$PID" || true
    rm "$PID_FILE"
  fi
}
trap cleanup EXIT

echo "Starting Wails dev server in test mode..."
APP_ENV=test nohup wails dev -m -nogorebuild -noreload > wails.log 2>&1 &
echo $! > "$PID_FILE"

# Wait for port 34115 to be serving
echo "Waiting for Wails dev server to be ready..."
MAX_RETRIES=60
RETRY_COUNT=0
while ! curl -s http://localhost:34115 > /dev/null; do
  sleep 2
  RETRY_COUNT=$((RETRY_COUNT+1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "Timeout waiting for Wails dev server"
    cat wails.log
    exit 1
  fi
  if (( RETRY_COUNT % 5 == 0 )); then
    echo "Still waiting... ($RETRY_COUNT/60)"
  fi
done

echo "Server is ready! Running Playwright tests..."
cd frontend
npm run test:integration
