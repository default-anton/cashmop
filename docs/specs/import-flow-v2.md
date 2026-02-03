# Import Flow Spec (v2: Single Screen)

UI Location: `frontend/src/screens/ImportFlow/`

## Summary
Replace the v1 “punch-through” multi-step mapping with a single-screen import experience:
- File picker, mapping, month selection, and import happen on **one screen**.
- Column mapping happens via **dropdowns above each preview column**.
- Saved mapping auto-detect stays first-class, but users can override by choosing a different mapping preset or starting fresh.
- If no saved mapping matches, the UI falls back to a simple heuristic header-based prefill.
- Amount settings update the preview immediately (live feedback).

## Goals
- Zero “wizard steps” for mapping; the user can map everything in-place.
- Make the “right” mapping obvious and editable: dropdowns + nearby micro-controls.
- Preserve and extend saved mappings (order, flips, inferred amount strategy) as opaque JSON.
- Keep the workflow fast for power users:
  - Auto-match when confident.
  - Heuristic prefill when no match.
  - Search+select a mapping preset at any time.

## Non-goals
- Reworking backend import semantics (still import normalized transactions via `go.main.App.ImportTransactions`).
- Adding “Owner from column” mapping (Owner remains static).
- Dragging/reordering columns inside the preview table.

## Existing References (v1)
- Spec: `docs/specs/import-flow.md`
- Screen: `frontend/src/screens/ImportFlow/ImportFlow.tsx`
- Auto-match rules: `frontend/src/screens/ImportFlow/mappingDetection.ts`
- Mapping schema: `frontend/src/screens/ImportFlow/components/ColumnMapperTypes.ts`
- Amount parsing: `frontend/src/screens/ImportFlow/utils.ts` (`createAmountParser`)
- Month bucketing: `frontend/src/screens/ImportFlow/ImportFlow.tsx` (`computeMonthsFromMapping`)

Mock (discussion artifact):
- `docs/specs/import-flow-v2-mock-below-preview.html`

---

## One-screen layout (high-level)
Single screen contains:
1. File picker + file list (supports multiple files)
2. Mapping preset controls (auto-detected mapping + searchable override)
3. Mapping panel (Account/Owner/Default currency, description order, amount settings)
4. Preview table with per-column mapping dropdowns (sample up to 5 rows)
5. Embedded month selector (per file)
6. “Remember mapping” controls (optional)
7. Import CTA (enabled only when mapping + months selection are valid)

Recommended structure:
- Left panel: “Mapping”
- Right panel: “File Preview” (table) + “Import” (months, remember mapping, import CTA)

Multi-file behavior remains “punch-through”:
- You work on **one file at a time** on this same screen.
- You **import the current file**, then the UI advances to the next file (repeat).

---

## Terminology
- **Saved mapping**: an entry in `column_mappings` (name unique) storing `ImportMapping` JSON.
- **Auto-matched mapping**: mapping chosen by `pickBestMapping(...)` (exact signature/subset rules).
- **Mapping preset**: the saved mapping currently applied to the file (can be auto-matched or user-selected).
- **Heuristic prefill**: header-based guess applied only when no saved mapping was auto-matched and the user has not selected a preset.

---

## Mapping selection & override behavior
### Priority order (per file)
When a file is parsed:
1. If the user has explicitly selected a mapping preset for this file, apply that mapping (rebound to this file’s header casing).
2. Else attempt saved mapping auto-match via existing rules (`pickBestMapping`) **only if** the file has a detected header row.
3. Else apply heuristic prefill mapping (best-effort), leaving ambiguities unassigned (only when the file has a header row).

### User controls
At the top of the screen for the current file:
- **Mapping preset picker** (searchable):
  - Entries: all saved mappings (by name)
  - Special entry: “None (start fresh)”
- If a mapping was auto-matched, show a banner:
  - “Auto matched: <name>” + a “Change” affordance that focuses the preset picker.
- If the user chooses “None (start fresh)”, the mapping becomes “scratch/heuristic-driven” (see below).

### Applying a selected preset to a file
When the user picks a mapping preset:
- Apply mapping to the current file by:
  - rebinding column names by normalized header match (existing `rebindMappingToHeaders` covers casing),
  - then clearing any references to headers not present in the file (treat as unmapped),
  - applying the selected preset’s full mapping, including static values (`account`, `owner`, `currencyDefault`).
- Do **not** run heuristic prefill after a user selects a preset (the preset is the baseline).

### “None (start fresh)”
Meaning: the user wants to create a new mapping from scratch for this file, but we still help with heuristic prefill.

Behavior when selected:
- Reset the file’s mapping to defaults (no assigned columns; amount strategy defaults to a signed money column but with no header assigned yet).
- If the file has a header row **and** no auto-match existed for this file, run heuristic prefill once (same as fallback behavior).
- If the file has **no** header row, do **not** run heuristic prefill (see below).

### Switching presets when “dirty”
If the user has made edits to the current file’s mapping and then picks a different preset (including “None”):
- Apply the newly selected preset immediately, replacing the current per-file mapping state.
- Do not prompt; assume the user intent is to switch baselines quickly.

### “Similar but wrong” auto-match
Subset matching can select a mapping that’s plausible but wrong. The UX must make it easy to:
- switch to a different mapping preset, or
- choose “None (start fresh)” and map via dropdowns.

---

## Header detection & auto-match
Header detection is fully automatic in v2 (no manual toggle).

Rules:
- If the file has a detected header row, attempt auto-match via `pickBestMapping`.
- If the file has **no** detected header row, skip auto-match (user selects a preset or maps manually).

---

## Column mapping UI (dropdowns above each column)
### Column role options
Each visible column header renders a compact role control:
- `Ignore`
- `Date`
- `Description`
- `Money (signed)` (dynamic; see below)
- `Money out`
- `Money in`
- `Direction (in/out)`
- `Account`
- `Currency`

Rules:
- Single-use fields (`Date`, `Account`, `Currency`, amount-related fields) are one-to-one: assigning a header to one clears it from everywhere else.
- `Description` is multi-select: multiple columns can be set to `Description`.
- Choosing `Ignore` clears the header from everywhere.
- Amount-related roles are mutually exclusive in practice (the UI will auto-switch the internal strategy as the user assigns Money/Direction columns). Prefer guiding copy over error states.

Implementation note:
- `useColumnMapping` already enforces one-to-one via `removeHeaderEverywhere` + assignment helpers.

### Amount mapping UX (no explicit “mode”)
Users should not need to understand “amount modes”.

Instead:
- The UI uses plain language column roles (Money signed / Money out / Money in / Direction) and infers the internal amount mapping type automatically.
- When the user selects an amount-related role, show a short, contextual hint near the control explaining what Cashmop will do with those numbers (see semantics below).
- If the user makes a selection that implies a different internal amount mapping type, switch automatically. Do not error.

Dynamic labeling (reduce confusion):
- When `Direction (in/out)` is **not** mapped, label the role as `Money (signed)` (sign matters).
- When `Direction (in/out)` **is** mapped, relabel it to `Money (signed/unsigned)` (sign is ignored; Direction chooses +/-).

Suggested dropdown labels + help text:
- `Money (signed)`: “One column with positives/negatives (spending usually negative).”
- `Money (signed/unsigned)` (shown only when Direction is mapped): “Signed or unsigned is fine — Direction decides +/-.”
- `Money out`: “Spending / withdrawals / payments (we always import as negative).”
- `Money in`: “Income / deposits (we always import as positive).”
- `Direction (in/out)`: “A column that says debit/credit (or DR/CR) — used to choose +/-.”

Suggested contextual hint states (small inline text under the dropdown or a tiny helper row in the table header):
- No money columns mapped yet: “Pick the column(s) that contain money.”
- Money (signed) selected (no Direction): “Use the ± button if the preview colors look flipped.”
- Money out / Money in selected: “We ignore the sign in the file. Out becomes -, in becomes +.”
- Money (signed/unsigned) + Direction selected: “Signed or unsigned is fine — we ignore the sign and use Direction to choose +/-.”

Implementation note:
- Keep the persisted schema keys as-is (`Amount`, `Debit`, `Credit`, `Type` via `amountMapping`) for compatibility with saved mappings + CLI.
- Only the UI labels/copy change; internally they map to the same fields:
  - Money (signed) / Money (signed/unsigned) → `csv.amountMapping.column` (Single) **or** `csv.amountMapping.amountColumn` (Amount + Direction)
  - Money out/in → `csv.amountMapping.debitColumn` / `creditColumn`
  - Direction (in/out) → `csv.amountMapping.typeColumn`

Internal mapping types (kept for schema/back-compat; not shown to the user):
- **Single**: Money (signed) → `amountMapping.type = "single"`
- **Debit/Credit**: Money out / Money in → `amountMapping.type = "debitCredit"`
- **Amount + Type**: Money (signed/unsigned) + Direction (in/out) → `amountMapping.type = "amountWithType"`

### Amount micro-settings (near the dropdown)
Goal: keep amount semantics obvious and testable via the preview.

Money (signed):
- When a column is `Money (signed)` **and Direction is not mapped**, show a small inline toggle:
  - “±” (Flip sign)
  - Backed by `amountMapping.invertSign`
- Semantics:
  - The file’s single Amount column is expected to be signed: debit negative, credit positive.
  - Import uses the value as-is (parsed to cents).
  - `invertSign` multiplies the parsed amount by `-1`.

Money out / Money in:
- No sign flip controls for this mode.
- Semantics:
  - Values may be positive or negative in the file; we ignore file sign.
  - Import treats “Money out” as always negative and “Money in” as always positive:
    - `amount = abs(moneyIn) - abs(moneyOut)`
  - `invertSign` is ignored for this strategy.

Direction (in/out):
- When a column is `Direction (in/out)`, show a “Direction values” control (popover) with:
  - Out value (default `debit`)
  - In value (default `credit`)
- Semantics:
  - Amount may be positive or negative in the file; we ignore file sign.
  - Import uses `abs(amount)` and applies sign based on the Direction column:
    - if `direction == outValue` → amount is negative
    - if `direction == inValue` → amount is positive
  - `invertSign` is ignored for this strategy.

---

## Description mapping & order
Description can be composed from multiple columns.

UX:
- If more than 1 description column is selected, show a “Description order” list in the left panel:
  - items are the selected description columns
  - reorder via drag-and-drop inside this list (not the preview table)
  - remove via an “x” on each item
- The joiner remains a single space (`" "`) as in v1.

Mapping semantics:
- `csv.description: string[]` order matters and is persisted in saved mappings.
- Normalization of imported description stays:
  - join non-empty values in the selected order

---

## Account / Owner / Currency
### Account (required)
Keep v1 behavior:
- User can set a static account (fast), or map an Account column (flexible).
- UI lives in the left panel using `AutocompleteInput` (existing pattern).

### Owner (static, optional)
Owner remains static (no column mapping).
- UI: `AutocompleteInput` for owner name (existing pattern).
- Default when empty remains `Unassigned` (backend import payload already uses this).

### Currency (optional)
Keep v1 behavior:
- Default currency (required to exist, e.g. main currency) + optional mapping via Currency column.

---

## Month selection (embedded)
Month selection moves onto the same screen and is per file.

Behavior:
- Month options are computed from the file’s parsed rows + currently mapped Date column.
- Disabled until a Date column is mapped.
- Default selection: the last month present in the file (same as v1 intent).
- The Import CTA requires at least one selected month for each file being imported.

Implementation note:
- Reuse v1 logic as much as possible:
  - date parsing: `parseDateLoose`
  - month buckets: `computeMonthsFromMapping` (or extracted helper)

---

## Import CTA & validation
### Import enablement
Import (for the **current file**) is enabled when:
- Date is mapped
- Amount mapping is valid (based on the inferred amount strategy)
- Description has at least 1 column
- Account is set (static or mapped column)
- At least 1 month is selected

### Import payload
No backend changes required:
- Continue producing normalized transactions and calling `go.main.App.ImportTransactions(txs)`.

### Preview updates (live)
As the user edits the mapping (including amount settings like flip sign or direction values):
- Update the preview amounts immediately so it’s obvious what will be imported.
- Render preview amounts using the same sign-display rules as the app:
  - show absolute value (no `-` sign)
  - use color to indicate sign (income green, spending red)
  - if amount strategy changes (Money out/in, Direction, flip sign), the preview should update colors/values live

### Advancing between files
After successful import of the current file:
- Advance to the next file (same screen), keeping the user in the mapping+months+import layout.
- On the last file, the primary CTA can read “Import” and ends in the “Import complete” state.

---

## Saved mapping schema (amount semantics)
Current schema can stay as-is:
- `AmountMappingBase` has `invertSign?: boolean`.

v2 semantics:
- **Single**: `invertSign` is respected (flip the parsed signed amount).
- **Debit/Credit**: ignore `invertSign`; compute `abs(moneyIn) - abs(moneyOut)`.
- **Amount + Type**: ignore `invertSign`; use `abs(amount)` and apply sign based on the configured direction values.

---

## Heuristic prefill mapping (fallback only)
Trigger:
- Only run when no saved mapping matched AND no mapping preset has been selected by the user AND the file has a header row.
- Run at most once per file (on initial parse). Do not re-run on later edits or preset switches.

Inputs:
- Primarily header text (normalized).
- No-header files: no prefill (header-based heuristics are not applicable to generated `Column A/B/...` headers).

Heuristics (suggested, simple):
- Date:
  - header contains: `date`, `posted`, `transaction date`
- Description:
  - header contains: `description`, `desc`, `memo`, `payee`, `merchant`, `name`
  - allow multiple picks (prefer left-to-right order)
- Amount:
  - header contains: `amount`, `amt`, `value`
- Money out / Money in:
  - header contains `debit` / `withdrawal` / `out`
  - header contains `credit` / `deposit` / `in`
- Direction (in/out):
  - header contains: `type`, `dr/cr`, `debit/credit`, `direction`
- Currency:
  - header contains: `currency`, `ccy`
- Account:
  - header contains: `account`

Ambiguity handling:
- If multiple candidates tie, leave unmapped (don’t guess).

UX:
- Show a small banner: “Pre-filled from headers — review quickly.” (Only when heuristic prefill ran.)

---

## Saving mappings (new vs update)
Users must be able to tweak a mapping and either:
- **Save as new mapping** (recommended default when the mapping was auto-matched), or
- **Update the selected mapping** (overwrite by name).

UX in the left panel:
- “Remember mapping” control with three states:
  - Off
  - Save as new…
  - Update selected mapping
- If “Save as new…”, show a mapping name input (default suggestion from filename).
- If “Update selected mapping”, show the selected name (disabled name field) + a clear warning.
- Disable “Update selected mapping” if no preset is selected.
- Name collisions:
  - “Save as new…” requires a unique name (show inline error and skip saving if it already exists).
  - “Update selected mapping” overwrites by name (existing behavior).

Save semantics:
- Saving is optional and must **not block import**:
  - If save fails, show an error toast and still import (if mapping is valid).
- Save stores:
  - the full current mapping JSON (including description order and flips)
  - `meta.headers` (normalized, unique sorted) + `meta.hasHeader` for future matching (same as v1)

Default state:
- Start in **Off**.
- If the user edits the mapping and a preset is selected:
  - For auto-matched presets: default to “Save as new…” (safer; avoids overwriting).
  - For user-selected presets: default to “Update selected mapping” (user explicitly chose it).
- If the user edits the mapping and **no** preset is selected (e.g., “None (start fresh)”), default to “Save as new…”.
- The default selection is per-file and resets when moving to the next file.

---

## Multi-file behavior
The screen supports importing multiple files in one session, **one file at a time**.

UX:
- Show progress: “File N of M” + current file name.
- No file switcher and no “Back”: users don’t jump between files mid-session; the flow is sequential.
- Each file has independent:
  - mapping preset selection
  - mapping edits
  - month selection

Import:
- Primary CTA imports the **current file only**, then advances to the next file.
- If a file cannot be imported (missing required mapping/months), the CTA is disabled and the UI highlights what’s missing.

---

## Test impact (integration)
Existing Playwright tests assume a step-based flow (click header → Next → …):
- `frontend/tests/import.spec.ts`
- `frontend/tests/lib/pom/ImportFlowPage.ts`

These will need updates to:
- map via dropdowns (and description order panel)
- select months on the same screen
- validate the auto-mapping banner + mapping preset picker behavior

---

## CLI parity
Saved mappings are used by the CLI import path as well.

If import mapping semantics or schema change (e.g. amount parsing rules), update:
- Go mapping types (`internal/mapping`)
- CLI normalization/parsing (`internal/cli`)
