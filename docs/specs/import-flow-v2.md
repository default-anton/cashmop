# Import Flow Spec (v2: Single Screen)

UI Location: `frontend/src/screens/ImportFlow/`

## Summary
Replace the v1 “punch-through” multi-step mapping with a single-screen import experience:
- File picker, mapping, month selection, and import happen on **one screen**.
- Column mapping happens via **dropdowns above each preview column**.
- Saved mapping auto-detect stays first-class, but users can override by choosing a different mapping preset or starting fresh.
- If no saved mapping matches, the UI falls back to a simple heuristic header-based prefill.
- Debit/Credit mode supports **separate sign flips** for Debit and Credit columns.

## Goals
- Zero “wizard steps” for mapping; the user can map everything in-place.
- Make the “right” mapping obvious and editable: dropdowns + nearby micro-controls.
- Preserve and extend saved mappings (order, flips, amount mode) as opaque JSON.
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

---

## One-screen layout (high-level)
Single screen contains:
1. File picker + file list (supports multiple files)
2. Mapping preset controls (auto-detected mapping + searchable override)
3. Embedded header-row toggle (Yes/No)
4. Mapping panel (Account/Owner/Default currency, description order, amount mode settings)
5. Embedded month selector (per file)
6. Preview table with per-column mapping dropdowns
7. Import CTA (enabled only when mapping + months selection are valid)

Recommended structure:
- Left panel: “Mapping & Import”
- Right panel: “File Preview” (table)

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
When a file is parsed / header-row setting changes:
1. If the user has explicitly selected a mapping preset for this file, apply that mapping (rebound to this file’s header casing).
2. Else attempt saved mapping auto-match via existing rules (`pickBestMapping`).
3. Else apply heuristic prefill mapping (best-effort), leaving ambiguities unassigned.

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
  - leaving static values (`account`, `owner`, `currencyDefault`) intact.
- Do **not** run heuristic prefill after a user selects a preset (the preset is the baseline).

### “Similar but wrong” auto-match
Subset matching can select a mapping that’s plausible but wrong. The UX must make it easy to:
- switch to a different mapping preset, or
- choose “None (start fresh)” and map via dropdowns.

---

## Column mapping UI (dropdowns above each column)
### Column role options
Each visible column header renders a compact role control:
- `Ignore`
- `Date`
- `Description`
- `Amount`
- `Debit`
- `Credit`
- `Type`
- `Account`
- `Currency`

Rules:
- Single-use fields (`Date`, `Account`, `Currency`, amount-related fields) are one-to-one: assigning a header to one clears it from everywhere else.
- `Description` is multi-select: multiple columns can be set to `Description`.
- Choosing `Ignore` clears the header from everywhere.

Implementation note:
- `useColumnMapping` already enforces one-to-one via `removeHeaderEverywhere` + assignment helpers.

### Amount mode
The mapping must support the same 3 amount modes as v1:
- **Single**: one column provides signed amount.
- **Debit/Credit**: separate debit and/or credit columns.
- **Amount + Type**: amount column plus a “Type” column whose values indicate debit vs credit.

UX:
- An “Amount mode” segmented control lives in the left panel, but can also be auto-switched:
  - assigning any column as `Debit` or `Credit` switches to Debit/Credit mode
  - assigning any column as `Type` switches to Amount+Type mode
  - otherwise default to Single
- The per-column dropdown always shows all options, but incompatible selections should auto-switch modes rather than error.

### Amount micro-settings (near the dropdown)
Goal: sign flips must be close to the mapped column.

Single amount:
- When a column is `Amount`, show a small inline toggle next to the dropdown:
  - “Flip sign”
  - Backed by `amountMapping.invertSign`

Debit/Credit:
- When a column is `Debit`, show “Flip debit sign” toggle for that column.
- When a column is `Credit`, show “Flip credit sign” toggle for that column.
- Backed by new fields on the mapping (see schema changes below).

Amount + Type:
- When a column is `Amount`, show “Flip sign” toggle (`invertSign`).
- When a column is `Type`, show a small “Type values” control (popover) with:
  - Negative value (default `debit`)
  - Positive value (default `credit`)

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
- Amount mapping is valid (based on selected mode)
- Description has at least 1 column
- Account is set (static or mapped column)
- At least 1 month is selected

### Import payload
No backend changes required:
- Continue producing normalized transactions and calling `go.main.App.ImportTransactions(txs)`.

### Advancing between files
After successful import of the current file:
- Advance to the next file (same screen), keeping the user in the mapping+months+import layout.
- On the last file, the primary CTA can read “Import” and ends in the “Import complete” state.

---

## Saved mapping schema changes (needed for per-column debit/credit flips)
Current:
- `AmountMappingBase` has `invertSign?: boolean`, used for all amount modes.

v2 additions:
- Extend the `debitCredit` mapping with separate flips:
  - `invertDebitSign?: boolean`
  - `invertCreditSign?: boolean`

Back-compat rules:
- Existing mappings without the new fields behave as today.
- `invertSign` is **not legacy**:
  - For **Single amount**, it remains the standard “Flip sign” setting (some exports show expenses as positive; others as negative).
  - For **Amount + Type**, it remains a “Flip sign” setting applied after the type-derived sign.
- For **Debit/Credit**, v2 introduces `invertDebitSign` / `invertCreditSign` as the primary user-facing flips.
  - Keep supporting `invertSign` on Debit/Credit mappings for backward compatibility with older saved mappings that relied on an overall flip.
  - UX recommendation: don’t surface an overall “Flip sign” toggle in Debit/Credit mode by default; only reflect it if it exists on a loaded mapping (e.g. advanced/secondary control) to avoid confusion.

Parser update requirement:
- Update `createAmountParser` Debit/Credit branch to stop using `Math.abs(...)` for both sides (it prevents correct per-column flipping).

---

## Heuristic prefill mapping (fallback only)
Trigger:
- Only run when no saved mapping matched AND no mapping preset has been selected by the user.

Inputs:
- Primarily header text (normalized).
- Secondary (optional): sample row value patterns for no-header files.

Heuristics (suggested, simple):
- Date:
  - header contains: `date`, `posted`, `transaction date`
- Description:
  - header contains: `description`, `desc`, `memo`, `payee`, `merchant`, `name`
  - allow multiple picks (prefer left-to-right order)
- Amount:
  - header contains: `amount`, `amt`, `value`
- Debit/Credit:
  - header contains `debit` / `withdrawal` / `out`
  - header contains `credit` / `deposit` / `in`
- Type:
  - header contains: `type`, `dr/cr`, `debit/credit`
- Currency:
  - header contains: `currency`, `ccy`
- Account:
  - header contains: `account`

Ambiguity handling:
- If multiple candidates tie, leave unmapped (don’t guess).

UX:
- Show a small banner: “Pre-filled from headers — review quickly.”

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

Save semantics:
- Saving is optional and must **not block import**:
  - If save fails, show an error toast and still import (if mapping is valid).
- Save stores:
  - the full current mapping JSON (including description order and flips)
  - `meta.headers` (normalized, unique sorted) + `meta.hasHeader` for future matching (same as v1)

---

## Multi-file behavior
The screen supports importing multiple files in one session, **one file at a time**.

UX:
- Show progress: “File N of M” + current file name.
- No file switcher: users don’t jump between files mid-session; the flow is sequential.
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
