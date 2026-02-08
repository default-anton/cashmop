## Frontend Rules You MUST Follow

- Read `./tailwind.config.js` before UI edits; match tokens (colors/fonts/shadows/animations)
- After .ts/.tsx edits: `make typescript`
- Formatting: `make fmt` (runs Biome for frontend) or `pnpm run fmt`
- Lint: `make check` (runs Biome check for frontend) or `pnpm run check`
- Wails events: Go `runtime.EventsEmit(ctx, "event")`; React `EventsOn` + cleanup `return () => off?.()`; example `ShowAbout()` emits "show-about"
- Visual stability/motion: optimistic updates; no global loading that unmounts lists; `framer-motion` `layout` + `AnimatePresence` mode="popLayout"; subtle 4–8px vertical offsets; `easeOut` or high-damping springs; no exit scale; in-place success feedback while backend syncs
- Typography/casing: small labels `text-canvas-600` + `uppercase`; data names no `uppercase`
- Copy tone: playful/quirky/fresh; millennial-friendly; concise; avoid corporate finance-speak
- Finance: negative amounts no minus; abs value + red `text-finance-expense`
- Shared utilities: check `src/utils/` before adding helpers (e.g., `currency.ts`)
- Suggestions/dropdowns: `createPortal` to avoid clipping/height jumps
- Selects: use `AutocompleteInput` for basic selects, esp long lists
- Multi-select filters >5 items: search input (auto-focus), select all/deselect all, "ONLY" on item hover, clear selection count (or "All selected")
- External links: use `openExternal` wrapper; no `BrowserOpenURL` direct, no `window.open()` or `<a href>`
