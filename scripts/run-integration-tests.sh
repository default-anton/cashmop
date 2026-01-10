#!/bin/bash
set -e

WORKER_COUNT=${WORKER_COUNT:-4}

# Validate WORKER_COUNT
if [ "$WORKER_COUNT" -lt 1 ] || [ "$WORKER_COUNT" -gt 8 ]; then
    echo "Error: WORKER_COUNT must be between 1 and 8"
    exit 1
fi

# Check port availability
for i in $(seq 0 $((WORKER_COUNT-1))); do
    PORT=$((34115 + i))
    if lsof -i :$PORT > /dev/null 2>&1; then
        echo "Error: Port $PORT is already in use"
        echo "Run: lsof -i :$PORT to find the process"
        exit 1
    fi
done

# Kill any existing wails dev or app processes
if pgrep -f "wails dev" > /dev/null || pgrep -f "cashflow" > /dev/null; then
    echo "Killing existing processes..."
    pkill -f "wails dev" || true
    pkill -f "cashflow" || true
    sleep 2
fi

TEST_RUN_ID="${CASHFLOW_TEST_RUN_ID:-$(date +%s)-$$}"
export CASHFLOW_TEST_RUN_ID="$TEST_RUN_ID"
export WORKER_COUNT

# Build test-helper once
echo "Building test-helper..."
mkdir -p build/bin
go build -o ./build/bin/test-helper ./cmd/test-helper/main.go

# Generate bindings once to avoid race conditions
echo "Generating bindings..."
wails build -s -nopackage -o bindings-gen > /dev/null 2>&1
rm -f build/bin/bindings-gen

# Cleanup on exit
ROOT_DIR=$(pwd)
PID_FILES=()
cleanup() {
    echo "Cleaning up..."
    # Kill Vite
    if [ -n "$VITE_PID" ]; then
        echo "Stopping Vite dev server (PID: $VITE_PID)..."
        kill "$VITE_PID" 2>/dev/null || true
    fi

    for pid_file in "${PID_FILES[@]}"; do
        if [ -f "$pid_file" ]; then
            PID=$(cat "$pid_file")
            echo "Stopping Wails dev server (PID: $PID)..."
            kill "$PID" 2>/dev/null || true
            rm -f "$pid_file"
        fi
    done

    # Remove per-worker DB files
    for i in $(seq 0 $((WORKER_COUNT-1))); do
        DB_FILE="$ROOT_DIR/cashflow_test_w$i.db"
        if [ -f "$DB_FILE" ]; then
            echo "Removing test database: $DB_FILE"
            rm -f "$DB_FILE"
        fi
    done

    # Remove temp dirs
    if [ -n "$CASHFLOW_TEST_RUN_ID" ]; then
        TMP_BASE="${TMPDIR:-/tmp}"
        TEST_DIR="${TMP_BASE%/}/cashflow-test/$CASHFLOW_TEST_RUN_ID"
        if [ -d "$TEST_DIR" ]; then
            echo "Removing test temp dir..."
            rm -rf "$TEST_DIR"
        fi
    fi
}

trap cleanup EXIT INT TERM

# Start Vite once
echo "Starting Vite dev server..."
cd frontend
npm run dev -- --port 5173 --strictPort > ../vite.log 2>&1 &
VITE_PID=$!
cd ..

# Wait for Vite
echo "Waiting for Vite..."
MAX_RETRIES=60
RETRY_COUNT=0
while ! curl -s http://localhost:5173 > /dev/null; do
    sleep 0.5
    RETRY_COUNT=$((RETRY_COUNT+1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "  ERROR: Timeout waiting for Vite"
        cat vite.log
        exit 1
    fi
done

# Start N Wails instances
echo "Starting $WORKER_COUNT Wails instances..."
FAILED_STARTUP=0
for i in $(seq 0 $((WORKER_COUNT-1))); do
    PORT=$((34115 + i))
    PID_FILE="$ROOT_DIR/.wails_dev_$i.pid"
    LOG_FILE="$ROOT_DIR/wails_$i.log"

    echo "  Worker $i on port $PORT..."
    APP_ENV=test CASHFLOW_WORKER_ID=$i \
        wails dev -devserver localhost:$PORT -frontenddevserverurl http://localhost:5173 -m -nogorebuild -noreload -skipbindings > "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    PID_FILES+=("$PID_FILE")

    # Wait for this instance to be ready
    echo "    Waiting for worker $i to start..."
    MAX_RETRIES=80
    RETRY_COUNT=0
    while ! curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT | grep -q "200"; do
        sleep 0.5
        RETRY_COUNT=$((RETRY_COUNT+1))
        if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
            echo "  ERROR: Timeout waiting for worker $i (port $PORT)"
            echo "  Log output (last 20 lines):"
            tail -20 "$LOG_FILE"
            FAILED_STARTUP=1
            break
        fi
    done
    
    if [ $FAILED_STARTUP -eq 1 ]; then
        break
    fi
    echo "    Worker $i ready."
done

if [ $FAILED_STARTUP -eq 1 ]; then
    echo "ERROR: One or more instances failed to start"
    exit 1
fi

echo "All instances ready. Running Playwright tests..."
cd frontend
npm run test:integration -- --workers=$WORKER_COUNT "$@"
