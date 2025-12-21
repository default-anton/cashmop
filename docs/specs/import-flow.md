# Import Flow Spec

UI Location: `frontend/src/screens/ImportFlow/`

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
