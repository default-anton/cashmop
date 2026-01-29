import { spawn } from "node:child_process";

const skip = process.env.CASHMOP_SKIP_WAILS_FRONTEND_WATCHER === "1";

if (skip) {
  // Wails still runs `frontend:dev:watcher` even when `-frontenddevserverurl` is
  // provided. For parallel integration tests, we start one shared Vite instance
  // and keep this watcher as a lightweight no-op.
  //
  // Important: Wails' auto-detection is driven off the watcher's output. Emit
  // a Vite-like URL line so Wails doesn't sit in its detection timeout.
  const url = process.env.CASHMOP_VITE_URL || "http://localhost:5173/";

  console.log(`cashmop: using existing Vite server: ${url}`);
  console.log("\n  VITE v3.2.11  ready in 0 ms");
  console.log(`  ➜  Local:   ${url}`);
  console.log("  ➜  Network: use --host to expose");

  const interval = setInterval(() => {}, 1_000_000);

  const shutdown = () => {
    clearInterval(interval);
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
} else {
  const child = spawn("pnpm", ["dev"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  const shutdown = (signal) => {
    child.kill(signal);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  child.on("exit", (code) => {
    process.exit(code ?? 1);
  });
}
