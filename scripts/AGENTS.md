# Scripts

## Integration tests (`scripts/run-integration-tests.sh`)

- Wails `-frontenddevserverurl` does **not** disable `frontend:dev:watcher`; Wails still runs `pnpm dev`.
- `WORKER_COUNT=1`: let Wails own Vite.
- `WORKER_COUNT>1`: start one shared Vite + pass `-frontenddevserverurl` to Wails workers.
- Linux CI: run `wails dev` under `xvfb-run -a` (headless).
- pnpm args: pass directly (`pnpm dev --port 5174`), not `pnpm dev -- --port ...` (pnpm already injects `--`).
- Prefer avoiding Vite default port 5173 on GitHub runners (often occupied).
