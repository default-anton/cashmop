#!/bin/bash
set -e

cpu_count() {
    local count=""

    if command -v getconf > /dev/null 2>&1; then
        count=$(getconf _NPROCESSORS_ONLN 2>/dev/null || true)
    fi

    if [ -z "$count" ] && command -v nproc > /dev/null 2>&1; then
        count=$(nproc 2>/dev/null || true)
    fi

    if [ -z "$count" ] && command -v sysctl > /dev/null 2>&1; then
        count=$(sysctl -n hw.ncpu 2>/dev/null || true)
    fi

    if [ -z "$count" ]; then
        count=2
    fi

    echo "$count"
}

default_worker_count() {
    # CI should be stable and resource-light by default.
    if [ -n "${CI:-}" ]; then
        echo 1
        return
    fi

    local count
    count=$(cpu_count)

    if [ "$count" -lt 1 ]; then
        echo 1
        return
    fi

    # Wails dev instances are relatively heavy. Cap parallelism so local runs
    # stay fast without spiking CPU/memory.
    local max=4
    if [ "$count" -gt "$max" ]; then
        echo "$max"
        return
    fi

    echo "$count"
}

if [ -z "${WORKER_COUNT:-}" ]; then
    WORKER_COUNT=$(default_worker_count)
    echo "WORKER_COUNT not set; using WORKER_COUNT=$WORKER_COUNT"
fi

# Validate WORKER_COUNT
if [ "$WORKER_COUNT" -lt 1 ] || [ "$WORKER_COUNT" -gt 8 ]; then
    echo "Error: WORKER_COUNT must be between 1 and 8"
    exit 1
fi


port_in_use() {
    local port=$1

    if command -v python3 > /dev/null 2>&1; then
        python3 - "$port" <<'PY'
import socket
import sys

port = int(sys.argv[1])

# Return codes: 0 => in use, 1 => free

def can_bind(family, host):
    s = socket.socket(family, socket.SOCK_STREAM)
    try:
        if family == socket.AF_INET6:
            s.bind((host, port, 0, 0))
        else:
            s.bind((host, port))
    except OSError:
        return False
    finally:
        s.close()
    return True

# If we can't bind IPv4 loopback, it's in use.
if not can_bind(socket.AF_INET, "127.0.0.1"):
    sys.exit(0)

# If IPv6 exists and we can't bind IPv6 loopback, it's in use.
try:
    if not can_bind(socket.AF_INET6, "::1"):
        sys.exit(0)
except OSError:
    pass

sys.exit(1)
PY
        return
    fi

    lsof -i :$port > /dev/null 2>&1
}

DEFAULT_TEST_BASE_PORT=34115
FALLBACK_TEST_BASE_PORT_START=34200
FALLBACK_TEST_BASE_PORT_END=34900

is_integer() {
    local value=$1
    [[ "$value" =~ ^[0-9]+$ ]]
}

ports_available() {
    local base_port=$1
    local workers=$2

    if [ "$base_port" -lt 1024 ]; then
        return 1
    fi

    local last_port=$((base_port + workers - 1))
    if [ "$last_port" -gt 65535 ]; then
        return 1
    fi

    for i in $(seq 0 $((workers - 1))); do
        local port=$((base_port + i))
        if port_in_use "$port"; then
            return 1
        fi
    done

    return 0
}

choose_test_base_port() {
    local requested_base_port="${CASHMOP_TEST_BASE_PORT:-}"

    if [ -n "$requested_base_port" ]; then
        if ! is_integer "$requested_base_port"; then
            echo "Error: CASHMOP_TEST_BASE_PORT must be an integer"
            exit 1
        fi

        if ! ports_available "$requested_base_port" "$WORKER_COUNT"; then
            local requested_last=$((requested_base_port + WORKER_COUNT - 1))
            echo "Error: requested port range $requested_base_port-$requested_last is unavailable"
            echo "Hint: unset CASHMOP_TEST_BASE_PORT for auto-selection"
            exit 1
        fi

        CASHMOP_TEST_BASE_PORT=$requested_base_port
        return
    fi

    if ports_available "$DEFAULT_TEST_BASE_PORT" "$WORKER_COUNT"; then
        CASHMOP_TEST_BASE_PORT=$DEFAULT_TEST_BASE_PORT
        return
    fi

    for base_port in $(seq "$FALLBACK_TEST_BASE_PORT_START" "$FALLBACK_TEST_BASE_PORT_END"); do
        if ports_available "$base_port" "$WORKER_COUNT"; then
            CASHMOP_TEST_BASE_PORT=$base_port
            return
        fi
    done

    echo "Error: failed to find a free port range for $WORKER_COUNT worker(s)"
    echo "Tried default base port $DEFAULT_TEST_BASE_PORT and fallback range $FALLBACK_TEST_BASE_PORT_START-$FALLBACK_TEST_BASE_PORT_END"
    exit 1
}

choose_vite_port() {
    # GitHub runners often have something bound on 5173; avoid it.
    for port in $(seq 5174 5190); do
        if ! port_in_use "$port"; then
            VITE_PORT=$port
            return 0
        fi
    done

    echo "Error: no free port found for Vite (tried 5174-5190)"
    exit 1
}

choose_test_base_port
TEST_BASE_LAST_PORT=$((CASHMOP_TEST_BASE_PORT + WORKER_COUNT - 1))
echo "Using integration Wails port range $CASHMOP_TEST_BASE_PORT-$TEST_BASE_LAST_PORT"

TEST_RUN_ID="${CASHMOP_TEST_RUN_ID:-$(date +%s)-$$}"
export CASHMOP_TEST_RUN_ID="$TEST_RUN_ID"
export WORKER_COUNT
export CASHMOP_TEST_BASE_PORT

# Build test-helper once
echo "Building test-helper..."
mkdir -p build/bin
go build -o ./build/bin/test-helper ./cmd/test-helper/main.go

# Generate bindings once to avoid races and avoid each Wails instance doing it.
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
    if [ -n "${VITE_PID:-}" ]; then
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
        DB_FILE="$ROOT_DIR/tmp/cashmop_test_w$i.db"
        if [ -f "$DB_FILE" ]; then
            echo "Removing test database: $DB_FILE"
            rm -f "$DB_FILE"*
        fi
    done

    # Remove temp dirs
    if [ -n "${CASHMOP_TEST_RUN_ID:-}" ]; then
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
    echo "Starting Vite dev server on port $VITE_PORT..."
    cd frontend
    pnpm dev --port "$VITE_PORT" --strictPort > ../tmp/vite.log 2>&1 &
    VITE_PID=$!
    cd ..
}

wait_for_vite() {
    echo "Waiting for Vite..."
    MAX_RETRIES=60
    RETRY_COUNT=0
    while ! curl -sf "http://localhost:$VITE_PORT" > /dev/null; do
        if ! kill -0 "$VITE_PID" > /dev/null 2>&1; then
            echo "  ERROR: Vite process exited"
            cat tmp/vite.log
            exit 1
        fi

        sleep 0.5
        RETRY_COUNT=$((RETRY_COUNT+1))
        if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
            echo "  ERROR: Timeout waiting for Vite on port $VITE_PORT"
            cat tmp/vite.log
            exit 1
        fi
    done

    echo "Vite is running on port $VITE_PORT"
}

start_worker() {
    local index=$1
    local port=$((CASHMOP_TEST_BASE_PORT + index))
    local pid_file="$ROOT_DIR/tmp/.wails_dev_$index.pid"
    local log_file="$ROOT_DIR/tmp/wails_$index.log"

    local frontend_args=()
    if [ -n "${VITE_PORT:-}" ]; then
        frontend_args=(-frontenddevserverurl "http://localhost:$VITE_PORT")
    fi

    local bindings_args=(-skipbindings)

    local wails_prefix=()
    if command -v xvfb-run > /dev/null 2>&1; then
        wails_prefix=(xvfb-run -a)
    fi

    local env_args=(APP_ENV=test CASHMOP_WORKER_ID=$index)
    if [ "$WORKER_COUNT" -gt 1 ]; then
        env_args+=(CASHMOP_SKIP_WAILS_FRONTEND_WATCHER=1)
        env_args+=(CASHMOP_VITE_URL="http://localhost:$VITE_PORT/")
    fi

    echo "  Worker $index on port $port..."
    env "${env_args[@]}" "${wails_prefix[@]}" wails dev -devserver localhost:$port "${frontend_args[@]}" -m -s -nogorebuild -noreload "${bindings_args[@]}" > "$log_file" 2>&1 &
    echo $! > "$pid_file"
    PID_FILES+=("$pid_file")
}

wait_for_workers() {
    local start_index=$1
    local end_index=$2
    local failed_startup=0

    for i in $(seq "$start_index" "$end_index"); do
        local port=$((CASHMOP_TEST_BASE_PORT + i))
        local log_file="$ROOT_DIR/tmp/wails_$i.log"

        echo "    Waiting for worker $i to start..."
        MAX_RETRIES=200
        RETRY_COUNT=0
        while ! curl -s -o /dev/null -w "%{http_code}" http://localhost:$port | grep -q "200"; do
            sleep 0.5
            RETRY_COUNT=$((RETRY_COUNT+1))
            if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
                echo "  ERROR: Timeout waiting for worker $i (port $port)"
                echo "  Log output (last 200 lines):"
                tail -200 "$log_file"
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

if [ "$WORKER_COUNT" -gt 1 ]; then
    choose_vite_port
    start_vite
    wait_for_vite
fi

echo "Starting $WORKER_COUNT Wails instances..."
for i in $(seq 0 $((WORKER_COUNT-1))); do
    start_worker "$i"
    wait_for_workers "$i" "$i"
done

echo "All instances ready. Running Playwright tests..."
cd frontend
pnpm test:integration --workers=$WORKER_COUNT "$@"
