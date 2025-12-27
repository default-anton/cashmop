#!/bin/bash
set -e

# Cleanup on exit
trap 'pkill -f "wails dev" || true' EXIT

echo "Starting Wails dev server in test mode..."
APP_ENV=test nohup wails dev > wails.log 2>&1 &

# Wait for port 34115
echo "Waiting for port 34115 to be ready..."
MAX_RETRIES=60
RETRY_COUNT=0
while ! lsof -i :34115 > /dev/null; do
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
