# Import Flow Spec

UI Location: `frontend/src/screens/ImportFlow/`

## Core experience
Cashmop’s import flow is a **single-screen**, **multi-file**, **sequential** import experience:
- Users can drop one or more files (CSV/XLSX/XLS).
- For the *current* file, users map columns using dropdowns in the preview table.
- Users choose which months to import (per file).
- Import runs for the current file, then automatically advances to the next file.

This flow is designed to be fast for repeat imports via **saved column mappings**.

---

## Supported inputs & parsing rules
### Supported file types
- `.csv`
- `.xlsx`
- `.xls`

### Limits and guardrails
- Files larger than **10 MB** are rejected.
- Empty files (0 bytes) are rejected.

### CSV parsing (important behavior)
- CSV parsing is **comma-separated**.
- Quoted fields are supported via `"..."` with `""` escapes.
- Leading UTF-8 BOM is ignored.
- Empty/whitespace-only lines are skipped.

### Excel parsing
- Excel files are parsed by the backend (`go.main.App.ParseExcel`) and returned as a 2D string array.

### Header detection
Header detection is automatic.
- If a header row is detected:
  - the first row becomes headers
  - data rows start at row 2
- If no header row is detected:
  - headers are generated as `Column A`, `Column B`, …
  - data rows include the first row

Header detection is used for:
- whether **auto-match** is allowed
- whether **heuristic prefill** runs

---

## Key concepts
### Import mapping
An **import mapping** (`ImportMapping`) describes:
- which column is Date
- which column(s) form Description (ordered)
- how Amount is computed (see “Amount semantics”)
- optional mapped Account/Currency columns
- static Account/Owner/Default currency values

### Saved mappings (“presets”)
Saved mappings are persisted in SQLite (`column_mappings`) and appear as selectable presets.

Saved mappings include metadata used for matching:
- `meta.headers`: normalized, unique, sorted header set
- `meta.hasHeader`: whether the file had a header row

---

## High-level UI layout
Single screen, three working areas:
1. **Mapping panel** (left)
   - mapping preset picker
   - static Account / Owner / Default currency
   - description order controls (when multiple Description columns are selected)
2. **Preview table** (right/top)
   - sample of parsed rows
   - per-column role dropdowns
   - amount micro-controls (± flip sign, direction values)
3. **Import panel** (right/bottom)
   - month selector
   - “Remember mapping” controls
   - Import CTA

Multi-file context is shown as: `File N of M` and the current filename.

---

## Mapping preset behavior
### Baseline mapping on file parse
When a file is parsed, Cashmop chooses a baseline mapping:
1. If the file has a detected header row:
   - try to **auto-match** a saved mapping
   - otherwise apply **heuristic prefill** (best-effort)
2. If the file does not have a detected header row:
   - start from default mapping (no header-based prefill)

### Manual preset selection
Users can override at any time via the preset picker:
- Selecting a saved preset applies that mapping, rebound to the current file’s headers.
- Selecting **“None (start fresh)”** resets to defaults and may apply heuristic prefill *if the file has a header row*.

When a preset is applied:
- any references to headers not present in the file are cleared
- the mapping becomes the baseline for further edits

---

## Auto-match rules (saved mapping detection)
Auto-match is only attempted when:
- the file has a detected header row (`hasHeader=true`)
- header source is automatic (no user override)
- the file’s headers do not contain **ambiguous duplicates** after normalization

Matching order:
1. **Exact signature match**
   - `meta.headers` signature equals file header signature
   - `meta.hasHeader` matches when present
2. **Subset match**
   - a saved mapping’s `meta.headers` may be a subset of the file’s headers
   - subset match is only attempted when the saved mapping has at least **4** distinct normalized headers
3. **Scored match**
   - candidates must satisfy:
     - Date matches
     - Amount matches (based on mapping type)
     - at least one Description header matches
   - best match is chosen by ratio/score and accepted only if:
     - score ≥ 3, or
     - ratio ≥ 0.75

When a mapping is applied, it is **rebound** to the file’s actual header casing.

---

## Heuristic prefill rules
Heuristic prefill runs only when:
- file has a detected header row
- no saved mapping auto-matched

Heuristic prefill is conservative:
- it prefers leaving fields unmapped over guessing when ambiguous
- it can select multiple Description columns (left-to-right)

---

## Column roles and mapping rules
Each preview column has a role dropdown:
- Not mapped
- Date
- Description
- Account
- Currency
- Money (signed) / Money (signed/unsigned)
- Money out
- Money in
- Direction (in/out)

Mapped columns also expose a one-click clear (✕) action that sets the role back to **Not mapped**.

Rules:
- `Date`, `Account`, `Currency`, and amount-related roles are **one-to-one**.
  - assigning one clears it from other roles.
- `Description` is **multi-select** and ordered.
- Amount “mode” is inferred from role selections:
  - Money (signed) ⇒ `amountMapping.type = single`
  - Money out/in ⇒ `amountMapping.type = debitCredit`
  - Money + Direction ⇒ `amountMapping.type = amountWithType`

---

## Amount semantics (business rules)
Cashmop persists amount mapping as one of three internal strategies.

### 1) Single amount column (Money signed)
- Value is parsed from the selected column.
- `invertSign` is respected (± toggle in UI).

### 2) Separate out/in columns (Money out / Money in)
- File sign is ignored.
- Imported cents are:
  - `abs(moneyIn) - abs(moneyOut)`
- `invertSign` is ignored.

### 3) Amount + direction column (Money + Direction)
- File sign is ignored.
- Imported cents are:
  - `abs(amount)` with sign chosen by the direction value
  - direction strings are configurable (defaults: `debit` / `credit`)
- `invertSign` is ignored.

---

## Description semantics
- Description can be composed from multiple columns.
- Values are concatenated with a single space (`" "`) in the configured order.

---

## Account / Owner / Currency semantics
### Account (required)
Account must be provided via:
- a static account name, or
- an Account column mapping

### Owner (optional, static)
- Owner is a static string.
- Default when empty: `Unassigned`.

### Currency (optional)
- Currency can be mapped from a column or provided via default currency.
- Currency values are uppercased during normalization.

---

## Month selection (per file)
- Month options are computed from parsed rows using the mapped Date column.
- If no Date is mapped, month selection is effectively disabled and any prior selection is cleared.
- Default selection (when untouched): the **latest month present** in the file.
- Import requires at least **one selected month**.

---

## Import enablement & validation
The Import CTA is enabled only when:
- Date is mapped
- Amount mapping is valid for the chosen strategy
- at least 1 Description column is selected
- Account is set (static or mapped)
- at least 1 month is selected

When disabled, the UI surfaces which fields are missing.

---

## “Remember mapping” behavior (saving presets)
Remember mapping has three states per file:
- Off
- Save as new…
- Update selected mapping

Defaults:
- starts Off for a new file
- once the user edits the mapping:
  - if the current preset was explicitly chosen by the user ⇒ default to **Update**
  - otherwise (auto-match or None) ⇒ default to **Save**

Save rules:
- Saving is best-effort and must **not block import**.
- “Save” requires a unique name (case-insensitive).
- “Update” uses the selected preset name.
- Saved mappings store `meta.headers` and `meta.hasHeader` from the current file.

---

## Multi-file behavior
- Files are imported one at a time, in the order selected.
- After importing a file successfully:
  - if more files remain, the UI advances to the next file
  - otherwise the flow ends in the “Import Complete” state

Each file maintains its own:
- applied preset / mapping edits
- month selection
- remember mapping state

---

## Implementation references (for maintainers)
- UI entry: `frontend/src/screens/ImportFlow/ImportFlow.tsx`
- Model/state: `frontend/src/screens/ImportFlow/useImportFlowModel.ts`
- File parsing: `frontend/src/screens/ImportFlow/utils.ts` (`parseFile`) and `frontend/src/screens/ImportFlow/fileParsing.ts`
- Auto-match + heuristics: `frontend/src/screens/ImportFlow/mappingDetection.ts`
- Mapping transforms + normalization: `frontend/src/screens/ImportFlow/helpers.ts`
