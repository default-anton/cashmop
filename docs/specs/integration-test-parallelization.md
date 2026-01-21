# Integration Test Parallelization Spec

Current state: Sequential execution (`workers: 1`, `fullyParallel: false`), single Wails instance, shared DB file.
Baseline: 28.8s (`time make integration`)

## Goal
- Reduce integration test runtime to ~20-22s (2 workers, ~1.1-1.2x speedup)
- Maintain test isolation; prevent shared state issues

## Approach: Multi-Instance + Per-Worker DBs

### Architecture Changes

| Component | Current | Parallel |
|-----------|---------|----------|
| Wails instances | 1 (port 34115) | N (ports 34115 + worker) |
| DB files | 1 shared (`cashmop_test.db`) | N per-worker files |
| Playwright workers | 1 | N (configurable, default 2) |
| Execution | Sequential | Parallel |

## Implementation

### 1. Database Path - Per-Worker

**File:** `internal/database/db.go`

```go
func resolveDatabasePath() (string, error) {
    env := strings.ToLower(os.Getenv("APP_ENV"))
    workerID := os.Getenv("CASHMOP_WORKER_ID")

    switch env {
    case "test":
        suffix := "test"
        if workerID != "" {
            suffix = fmt.Sprintf("test_w%s", workerID)
        }
        return devTestPath(suffix)
    case "dev", "development":
        return devTestPath("dev")
    default:
        // Production path unchanged
    }
}
```

### 2. Test Helper - Preserve Worker Env Var

**File:** `cmd/test-helper/main.go`

```go
func resetDB() error {
    // Preserve worker ID for DB path resolution
    workerID := os.Getenv("CASHMOP_WORKER_ID")
    if workerID == "" {
        workerID = "0"  // Default to worker 0
    }
    os.Setenv("APP_ENV", "test")
    os.Setenv("CASHMOP_WORKER_ID", workerID)  // RE-SET for db.go

    database.InitDB()
    // ... rest of reset logic unchanged
}
```

### 3. Wails Port - Dynamic with Robustness

**File:** `scripts/run-integration-tests.sh`

```bash
#!/bin/bash
set -e

WORKER_COUNT=${WORKER_COUNT:-4}
MAX_PORT=$((34115 + WORKER_COUNT - 1))

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

# Kill any existing wails dev processes
if pgrep -f "wails dev" > /dev/null; then
    echo "Killing existing wails dev processes..."
    pkill -f "wails dev" || true
    sleep 2
fi

TEST_RUN_ID="${CASHMOP_TEST_RUN_ID:-$(date +%s)-$$}"
export CASHMOP_TEST_RUN_ID="$TEST_RUN_ID"
export WORKER_COUNT

# Build test-helper once
echo "Building test-helper..."
mkdir -p build/bin
go build -o ./build/bin/test-helper ./cmd/test-helper/main.go

# Cleanup on exit
ROOT_DIR=$(pwd)
PID_FILES=()
cleanup() {
    echo "Cleaning up..."
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

# Start N Wails instances
echo "Starting $WORKER_COUNT Wails instances..."
FAILED_STARTUP=0
for i in $(seq 0 $((WORKER_COUNT-1))); do
    PORT=$((34115 + i))
    PID_FILE="$ROOT_DIR/.wails_dev_$i.pid"
    LOG_FILE="$ROOT_DIR/wails_$i.log"

    echo "  Worker $i on port $PORT..."
    APP_ENV=test CASHMOP_WORKER_ID=$i \
        wails dev -devserver localhost:$PORT -frontenddevserverurl http://localhost:5173 -m -s -nogorebuild -noreload -skipbindings > "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    PID_FILES+=("$PID_FILE")

    # Wait for this instance to be ready
    MAX_RETRIES=40
    RETRY_COUNT=0
    while ! curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT | grep -q "200"; do
        sleep 0.5
        RETRY_COUNT=$((RETRY_COUNT+1))
        if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
            echo "  ERROR: Timeout waiting for worker $i (port $PORT)"
            echo "  Log output:"
            tail -20 "$LOG_FILE"
            FAILED_STARTUP=1
            break
        fi
        if (( RETRY_COUNT % 10 == 0 )); then
            echo "    Still waiting for worker $i ($RETRY_COUNT/$MAX_RETRIES)..."
        fi
    done
done

if [ $FAILED_STARTUP -eq 1 ]; then
    echo "ERROR: One or more instances failed to start"
    exit 1
fi

echo "All instances ready. Running Playwright tests..."
cd frontend
pnpm test:integration --workers=$WORKER_COUNT "$@"
```

### 4. Playwright Config - Parallel

**File:** `frontend/playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.WORKER_COUNT || 2,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:34115`,  // Default for worker 0
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```

### 5. Fixtures - Worker-Aware BaseURL

**File:** `frontend/tests/lib/fixtures.ts`

```typescript
import { test as base } from '@playwright/test';
import { execSync } from 'child_process';
import * as path from 'path';

type MyFixtures = {
  dbReset: void;
  testDialogPaths: void;
  categorizationPage: CategorizationPage;
  analysisPage: AnalysisPage;
  importFlowPage: ImportFlowPage;
  settingsPage: SettingsPage;
};

const testRunId = process.env.CASHMOP_TEST_RUN_ID || 'local';

// Worker-specific baseURL helper
function getWorkerBaseURL(workerIndex: number): string {
  return `http://localhost:${34115 + workerIndex}`;
}

export const test = base.extend<MyFixtures>({
  // Override baseURL for worker-specific instance
  baseURL: async ({}, use, testInfo) => {
    await use(getWorkerBaseURL(testInfo.workerIndex));
  },

  // DB reset uses CASHMOP_WORKER_ID env var (set by test-helper)
  dbReset: [async ({}, use) => {
    execSync('./build/bin/test-helper reset', { cwd: '..' });
    await use();
  }, { auto: true }],

  testDialogPaths: [async ({ page }, use, testInfo) => {
    const dir = getTestDir();
    const slug = sanitize(testInfo.titlePath.join('_'));
    const backupSavePath = path.join(dir, `backup_${testInfo.workerIndex}_${slug}.db`);
    const exportSavePath = path.join(dir, `export_${testInfo.workerIndex}_${slug}.csv`);

    await page.evaluate((paths) => {
      (window as any).__cashmopTestDialogPaths = paths;
    }, { backupSavePath, exportSavePath });

    await use();
  }, { auto: true }],

  categorizationPage: async ({ page }, use) => {
    await use(new CategorizationPage(page));
  },
  // ... other page fixtures
});
```

## Trade-offs

| Factor | Impact |
|--------|--------|
| Speed | ~1.1-1.2x faster (2 workers) minus startup overhead |
| Resources | ~N× memory (2 instances × ~200MB = ~400MB) |
| Complexity | Moderate (script changes, minor Go/TS changes) |
| Isolation | Perfect (separate DBs, no shared state) |
| Startup | ~N× slower initial (~20-25s for 2 workers) |

## Rollout Plan

### Phase 1: Validation (workers: 1, fullyParallel: true)
- Enable `fullyParallel: true` while keeping `workers: 1`
- Verify isolation (no cross-test state leakage)
- Baseline: 28.8s

### Phase 2: Multi-Worker (workers: 2)
- Implement full multi-instance approach with 2 workers
- Verify parallel execution, DB isolation
- Target: ~15s

### Phase 3: Scale Up (workers: 2)
- Increase to 2 workers
- Target: ~20-22s
- Tune based on dev machine resources

## Verification

- [ ] All tests pass with `WORKER_COUNT=2`
- [ ] Test runtime reduced by ≥2.5x
- [ ] No flaky tests (run 5+ iterations)
- [ ] DB files per worker created/cleaned up correctly
- [ ] Port conflicts detected before starting
- [ ] Failed startup results in clear error messages
- [ ] Ctrl+C cleanup works (test with manual interrupt)
- [ ] Log files created per worker, readable on failure

## Notes

- **Windows support**: Skipped (Linux/macOS only)
- **CI**: Dev machine only; no CI integration planned
- **Fixtures**: Shared YAML files across all workers
- **CASHMOP_TEST_RUN_ID**: Used for temp dir isolation (`$TMPDIR/cashmop-test/$RUN_ID`)
- **No WAL mode**: Separate DBs eliminate locking issues
- **Wails flag**: Uses `-devserver localhost:$PORT` (not `-port`)
- **Port range**: 34115-34122 for WORKER_COUNT=1-8

## Debugging Tips

```bash
# Check port conflicts
lsof -i :34115-34120

# Watch all worker logs in real-time
tail -f wails_*.log

# Run with 2 workers for debugging
WORKER_COUNT=2 ./scripts/run-integration-tests.sh

# Cleanup orphaned processes
pkill -f "wails dev"
```

## References

- Integration test script: `scripts/run-integration-tests.sh`
- Playwright config: `frontend/playwright.config.ts`
- Database init: `internal/database/db.go`
- Test fixtures: `frontend/tests/lib/fixtures.ts`
- Test helper: `cmd/test-helper/main.go`
