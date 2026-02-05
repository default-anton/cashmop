#!/bin/bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
TMP_DIR="$ROOT_DIR/tmp"
ENV_FILE="$TMP_DIR/ui-feedback-loop.env"

DEFAULT_SESSION="cashmop-ui"
DEFAULT_VITE_PORT=5174
DEFAULT_WAILS_PORT=34115
DEFAULT_APP_ENV="test"

usage() {
    cat <<'EOF'
Usage:
  scripts/ui-feedback-loop.sh start [--session <name>] [--vite-port <port>] [--wails-port <port>] [--app-env <env>]
  scripts/ui-feedback-loop.sh stop [--session <name>]
  scripts/ui-feedback-loop.sh status [--session <name>]
  scripts/ui-feedback-loop.sh url

Starts a tmux session with two long-running panes:
  - Vite dev server
  - Wails dev server (bound to localhost:<wails-port>)

Defaults:
  session: cashmop-ui
  vite-port: 5174
  wails-port: 34115
  app-env: test
EOF
}

require_cmd() {
    local cmd=$1
    if ! command -v "$cmd" > /dev/null 2>&1; then
        echo "Error: missing required command: $cmd"
        exit 1
    fi
}

port_in_use() {
    local port=$1

    if command -v python3 > /dev/null 2>&1; then
        if python3 - "$port" <<'PY'
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

if not can_bind(socket.AF_INET, "127.0.0.1"):
    sys.exit(0)

try:
    if not can_bind(socket.AF_INET6, "::1"):
        sys.exit(0)
except OSError:
    pass

sys.exit(1)
PY
        then
            return 0
        fi

        return 1
    fi

    lsof -i :"$port" > /dev/null 2>&1
}

wait_for_http() {
    local url=$1
    local timeout_seconds=$2
    local label=$3

    local elapsed=0
    while ! curl -sf "$url" > /dev/null 2>&1; do
        sleep 0.5
        elapsed=$((elapsed + 1))

        if [ "$elapsed" -ge $((timeout_seconds * 2)) ]; then
            echo "Error: timed out waiting for $label at $url"
            return 1
        fi
    done
}

load_env_if_present() {
    if [ -f "$ENV_FILE" ]; then
        # shellcheck disable=SC1090
        source "$ENV_FILE"
    fi
}

save_env() {
    local session=$1
    local vite_port=$2
    local wails_port=$3
    local app_env=$4

    mkdir -p "$TMP_DIR"
    cat > "$ENV_FILE" <<EOF
SESSION=$session
VITE_PORT=$vite_port
WAILS_PORT=$wails_port
APP_ENV=$app_env
STARTED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF
}

start_loop() {
    local session="$DEFAULT_SESSION"
    local vite_port=$DEFAULT_VITE_PORT
    local wails_port=$DEFAULT_WAILS_PORT
    local app_env="$DEFAULT_APP_ENV"

    while [ "$#" -gt 0 ]; do
        case "$1" in
            --session)
                session=$2
                shift 2
                ;;
            --vite-port)
                vite_port=$2
                shift 2
                ;;
            --wails-port)
                wails_port=$2
                shift 2
                ;;
            --app-env)
                app_env=$2
                shift 2
                ;;
            *)
                echo "Unknown argument: $1"
                usage
                exit 1
                ;;
        esac
    done

    require_cmd tmux
    require_cmd pnpm
    require_cmd wails
    require_cmd curl

    if tmux has-session -t "$session" 2> /dev/null; then
        echo "Error: tmux session '$session' already exists"
        echo "Run: scripts/ui-feedback-loop.sh stop --session $session"
        exit 1
    fi

    if port_in_use "$vite_port"; then
        echo "Error: Vite port $vite_port is already in use"
        exit 1
    fi

    if port_in_use "$wails_port"; then
        echo "Error: Wails port $wails_port is already in use"
        exit 1
    fi

    mkdir -p "$TMP_DIR"

    local vite_log="$TMP_DIR/ui-feedback-vite.log"
    local wails_log="$TMP_DIR/ui-feedback-wails.log"

    : > "$vite_log"
    : > "$wails_log"

    tmux new-session -d -s "$session" -n vite "cd '$ROOT_DIR/frontend' && pnpm dev --port $vite_port --strictPort 2>&1 | tee '$vite_log'"

    local wails_prefix=""
    if command -v xvfb-run > /dev/null 2>&1 && [ -z "${DISPLAY:-}" ]; then
        wails_prefix="xvfb-run -a "
    fi

    tmux new-window -t "$session" -n wails "cd '$ROOT_DIR' && env APP_ENV='$app_env' CASHMOP_SKIP_WAILS_FRONTEND_WATCHER=1 CASHMOP_VITE_URL='http://localhost:$vite_port/' ${wails_prefix}wails dev -devserver localhost:$wails_port -frontenddevserverurl http://localhost:$vite_port 2>&1 | tee '$wails_log'"

    save_env "$session" "$vite_port" "$wails_port" "$app_env"

    echo "Waiting for Vite..."
    wait_for_http "http://localhost:$vite_port" 60 "Vite"

    echo "Waiting for Wails dev server..."
    wait_for_http "http://localhost:$wails_port" 180 "Wails dev server"

    cat <<EOF

UI feedback loop is ready.

- tmux session: $session
- Vite URL: http://localhost:$vite_port
- Wails URL: http://localhost:$wails_port

Next steps:
  agent-browser open http://localhost:$wails_port
  agent-browser snapshot -i

Helpful commands:
  tmux attach -t $session
  scripts/ui-feedback-loop.sh status
  scripts/ui-feedback-loop.sh stop
EOF
}

stop_loop() {
    load_env_if_present

    local session="${SESSION:-$DEFAULT_SESSION}"

    while [ "$#" -gt 0 ]; do
        case "$1" in
            --session)
                session=$2
                shift 2
                ;;
            *)
                echo "Unknown argument: $1"
                usage
                exit 1
                ;;
        esac
    done

    if tmux has-session -t "$session" 2> /dev/null; then
        tmux kill-session -t "$session"
        echo "Stopped tmux session '$session'"
    else
        echo "tmux session '$session' is not running"
    fi

    rm -f "$ENV_FILE"
}

status_loop() {
    load_env_if_present

    local session="${SESSION:-$DEFAULT_SESSION}"
    local vite_port="${VITE_PORT:-$DEFAULT_VITE_PORT}"
    local wails_port="${WAILS_PORT:-$DEFAULT_WAILS_PORT}"

    while [ "$#" -gt 0 ]; do
        case "$1" in
            --session)
                session=$2
                shift 2
                ;;
            *)
                echo "Unknown argument: $1"
                usage
                exit 1
                ;;
        esac
    done

    if tmux has-session -t "$session" 2> /dev/null; then
        echo "tmux session: running ($session)"
    else
        echo "tmux session: stopped ($session)"
    fi

    if curl -sf "http://localhost:$vite_port" > /dev/null 2>&1; then
        echo "vite: up (http://localhost:$vite_port)"
    else
        echo "vite: down (http://localhost:$vite_port)"
    fi

    if curl -sf "http://localhost:$wails_port" > /dev/null 2>&1; then
        echo "wails: up (http://localhost:$wails_port)"
    else
        echo "wails: down (http://localhost:$wails_port)"
    fi
}

url_loop() {
    load_env_if_present
    local wails_port="${WAILS_PORT:-$DEFAULT_WAILS_PORT}"
    echo "http://localhost:$wails_port"
}

main() {
    if [ "$#" -lt 1 ]; then
        usage
        exit 1
    fi

    local command=$1
    shift

    case "$command" in
        start)
            start_loop "$@"
            ;;
        stop)
            stop_loop "$@"
            ;;
        status)
            status_loop "$@"
            ;;
        url)
            url_loop
            ;;
        -h|--help|help)
            usage
            ;;
        *)
            echo "Unknown command: $command"
            usage
            exit 1
            ;;
    esac
}

main "$@"
