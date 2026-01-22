#!/bin/bash
set -e

WORKER_COUNT=${WORKER_COUNT:-2}

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
if pgrep -f "wails dev" > /dev/null || pgrep -f "cashmop" > /dev/null; then
    echo "Killing existing processes..."
    pkill -f "wails dev" || true
    pkill -f "cashmop" || true
    sleep 2
fi

# Kill any process using port 5173 (Vite default port)
if lsof -i :5173 > /dev/null 2>&1; then
    echo "Killing process using port 5173..."
    lsof -ti :5173 | xargs kill -9 2>/dev/null || true
    sleep 1
fi

TEST_RUN_ID="${CASHMOP_TEST_RUN_ID:-$(date +%s)-$$}"
export CASHMOP_TEST_RUN_ID="$TEST_RUN_ID"
export WORKER_COUNT

# Build test-helper once
echo "Building test-helper..."
mkdir -p build/bin
go build -o ./build/bin/test-helper ./cmd/test-helper/main.go

# Generate bindings once to avoid race conditions
echo "Generating bindings..."
if ! wails build -s -nopackage -o bindings-gen 2>&1; then
    echo "ERROR: Failed to generate bindings"
    exit 1
fi
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
        DB_FILE="$ROOT_DIR/cashmop_test_w$i.db"
        if [ -f "$DB_FILE" ]; then
            echo "Removing test database: $DB_FILE"
            rm -f "$DB_FILE"
        fi
    done

    # Remove temp dirs
    if [ -n "$CASHMOP_TEST_RUN_ID" ]; then
        TMP_BASE="${TMPDIR:-/tmp}"
        TEST_DIR="${TMP_BASE%/}/cashmop-test/$CASHMOP_TEST_RUN_ID"
        if [ -d "$TEST_DIR" ]; then
            echo "Removing test temp dir..."
            rm -rf "$TEST_DIR"
        fi
    fi
}

trap cleanup EXIT INT TERM

start_vite() {
    echo "Starting Vite dev server..."
    cd frontend
    pnpm dev -- --port 5173 --strictPort > ../vite.log 2>&1 &
    VITE_PID=$!
    cd ..
}

wait_for_vite() {
    echo "Waiting for Vite..."
    MAX_RETRIES=60
    RETRY_COUNT=0
    while ! curl -s http://localhost:5173 > /dev/null && ! curl -s http://localhost:5174 > /dev/null; do
        sleep 0.5
        RETRY_COUNT=$((RETRY_COUNT+1))
        if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
            echo "  ERROR: Timeout waiting for Vite"
            cat vite.log
            exit 1
        fi
    done

    # Wait a bit for Vite to write its log
    sleep 1

    # Read the actual port from Vite log
    VITE_PORT=$(grep "Local:" vite.log | tail -1 | grep -oE 'localhost:[0-9]+' | cut -d: -f2)
    if [ -z "$VITE_PORT" ]; then
        VITE_PORT=5173
    fi
    echo "Vite is running on port $VITE_PORT"
}

start_worker() {
    local index=$1
    local port=$((34115 + index))
    local pid_file="$ROOT_DIR/.wails_dev_$index.pid"
    local log_file="$ROOT_DIR/wails_$index.log"

    echo "  Worker $index on port $port..."
    APP_ENV=test CASHMOP_WORKER_ID=$index \
        wails dev -devserver localhost:$port -frontenddevserverurl http://localhost:$VITE_PORT -m -s -nogorebuild -noreload -skipbindings > "$log_file" 2>&1 &
    echo $! > "$pid_file"
    PID_FILES+=("$pid_file")
}

wait_for_workers() {
    local start_index=$1
    local end_index=$2
    local failed_startup=0

    for i in $(seq "$start_index" "$end_index"); do
        local port=$((34115 + i))
        local log_file="$ROOT_DIR/wails_$i.log"

        echo "    Waiting for worker $i to start..."
        MAX_RETRIES=80
        RETRY_COUNT=0
        while ! curl -s -o /dev/null -w "%{http_code}" http://localhost:$port | grep -q "200"; do
            sleep 0.5
            RETRY_COUNT=$((RETRY_COUNT+1))
            if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
                echo "  ERROR: Timeout waiting for worker $i (port $port)"
                echo "  Log output (last 20 lines):"
                tail -20 "$log_file"
                failed_startup=1
                break
            fi
        done

        if [ $failed_startup -eq 1 ]; then
            break
        fi
        echo "    Worker $i ready."
    done

    if [ $failed_startup -eq 1 ]; then
        echo "ERROR: One or more instances failed to start"
        exit 1
    fi
}

start_vite
wait_for_vite
echo "Starting $WORKER_COUNT Wails instances..."
for i in $(seq 0 $((WORKER_COUNT-1))); do
    start_worker "$i"
    wait_for_workers "$i" "$i"
done

echo "All instances ready. Running Playwright tests..."
cd frontend
pnpm test:integration --workers=$WORKER_COUNT "$@"
