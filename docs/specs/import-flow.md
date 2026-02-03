# Import Flow Spec

UI Location: `frontend/src/screens/ImportFlow/`

> Note: this spec describes the **v1 punch-through mapping** flow. The planned single-screen flow lives in
> `docs/specs/import-flow-v2.md` (see also `docs/specs/import-flow-v2-mock.html`).

## Core Experience
- Vertical, "punch-through" flow (same philosophy as the Categorization Loop).
- User selects a CSV/Excel export.
- App immediately shows a preview table of the file *as-is* (parsed headers + up to 5 unique sample rows).
- One mapping decision at a time: user punches through required fields by clicking column headers.
- Auto-advance where possible to keep the flow fast.

## Steps
1. Choose file(s) (CSV, XLSX)
2. Map columns (one field at a time)
   - Date (required)
   - Amount (required)
     - Single amount column
     - OR Debit/Credit columns
     - OR Amount + Type columns
   - Description (required; can combine multiple columns)
   - Account (required; static value or column)
   - Owner (optional; static value or column)
   - Currency (optional; defaults to CAD or map a column)
3. Month selector
   - Defaults to the last month found in the file dates
4. Import

## Required Data Schema (App)
- Date
- Description
- Amount (+/- handling)
- Account

## Optional Schema
- Owner
- Currency (default CAD)

## Saved column mappings (auto-detect)
- When you reach the last mapping step, the UI can **save** the mapping for next time.
- Saved mappings are persisted in SQLite table `column_mappings` as an opaque JSON blob.
- The UI adds optional metadata to improve future matching:
  - `meta.headers`: normalized headers of the file used to create the mapping (case/whitespace-insensitive)
  - `meta.hasHeader`: whether the file had a header row

### Matching rules
- Each uploaded file is treated independently.
- Prefer an **exact signature match** (`meta.headers` + `meta.hasHeader`) to avoid applying a mapping from a different bank.
- If the bank adds extra columns, we still consider the mapping when `meta.headers` is a **subset** of the file headers.
  - Guardrail: subset matching is only attempted when the saved mapping has at least 4 distinct normalized headers. (Tiny header sets tend to create false positives.)
- Fallback (legacy mappings without `meta.*`): heuristic header scoring (still case/whitespace-insensitive).
- If the file contains duplicate headers that collide after normalization (case/whitespace), auto-matching is disabled to avoid ambiguous column binding.
- When a mapping matches case-insensitively, the UI **rebinds** mapping column names to the file’s actual header casing so the mapping can be applied reliably.
