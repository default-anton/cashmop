# Scripts

## Integration tests (`scripts/run-integration-tests.sh`)

- `WORKER_COUNT`:
  - default: auto (caps at 4 locally; forced to 1 on CI)
  - override: `WORKER_COUNT=1|2|... make integration`
- `WORKER_COUNT=1`: let Wails own Vite.
- `WORKER_COUNT>1`: start one shared Vite + pass `-frontenddevserverurl` to Wails workers.
- Wails `-frontenddevserverurl` does **not** disable `frontend:dev:watcher`.
  - We wrap the watcher via `frontend/scripts/wails-dev-watcher.mjs`.
  - When `CASHMOP_SKIP_WAILS_FRONTEND_WATCHER=1`, the watcher becomes a lightweight no-op that still emits Vite-like output so Wails doesn't block on Vite detection.
- Linux CI: run `wails dev` under `xvfb-run -a` (headless).
- pnpm args: pass directly (`pnpm dev --port 5174`), not `pnpm dev -- --port ...` (pnpm already injects `--`).
- Prefer avoiding Vite default port 5173 on GitHub runners (often occupied).

## UI iteration loop (`scripts/ui-feedback-loop.sh`)

- Prefer this loop for UI changes.
- Start + inspect:
  ```bash
  make ui-loop-start
  agent-browser open "$(make -s ui-loop-url)"
  agent-browser snapshot -i
  ```
- Day-to-day commands:
  ```bash
  make ui-loop-status
  make ui-loop-stop
  tmux attach -t cashmop-ui
  ```
- Need custom ports/session/env? Use `scripts/ui-feedback-loop.sh --help`.
