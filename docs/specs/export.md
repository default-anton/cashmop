# Export Spec

UI Location: `frontend/src/screens/Analysis/`

## Core Experience
* One-click export from Analysis screen.
* Native file picker dialog for destination.
* Instant feedback with toast notification on completion.
* Respects current filters (date range, categories).

## Export Flow
1. User clicks Export button in Analysis header
2. Native file picker opens (pre-filled with filename based on date range)
3. User selects destination and format
4. File written, success toast shown

## Formats
* **CSV** (default): UTF-8 with BOM for Excel/Numbers compatibility
* **XLSX**: Native Excel format with auto-column widths
* **Numbers**: Alias for CSV (macOS users can open directly)

## Filename Convention
* Single month: `cashflow_2025-01.csv`
* Date range: `cashflow_2025-01-01_to_2025-03-31.csv`
* All data: `cashflow_full_export.csv`

## Data Schema
**Columns (in order):**
```
Date | Description | Amount | Category | Account | Owner | Currency
```

* Empty category shown as blank (not "Uncategorized")
* Amount as signed number (negative = expense, positive = income)
* Date formatted as YYYY-MM-DD for spreadsheet compatibility

## Scope
* Transactions only (rules, categories, accounts not exported)
* Respects active Analysis filters:
  * Date range from month selector
  * Category filter (multi-select)
* All matching transactions in single file

## Technical Implementation
* **Backend**: Go generates CSV/XLSX using `encoding/csv` and `github.com/xuri/excelize/v2`
* **Frontend**: Wails runtime invokes native save dialog via `runtime.SaveFileDialog`
* **Integration**: Export button in Analysis header, shares filter state with transaction list
