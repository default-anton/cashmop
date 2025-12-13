# Plan: Data Ingestion (Import Flow) – Backend Implementation

## Objective

Implement the backend services and database schema required to support the frontend Import Flow (CSV/Excel file import, column mapping, month selection, and transaction storage).

## Overview

The frontend Import Flow UI (components/data-ingestion) is largely complete (see `TODO.md`). It currently logs to console on confirmation. This plan outlines the backend work needed to make the import functional:

1. **Extend database schema** for import metadata (optional audit).
2. **Create Go data models** matching the frontend’s `ImportMapping` and parsed rows.
3. **Implement a service layer** that:
   - Transforms parsed CSV rows into `Transaction` records using the mapping.
   - Filters rows by selected months.
   - Deduplicates existing transactions (optional, future).
   - Inserts the final transactions into the `transactions` table.
4. **Expose Wails‑bound methods** on the `App` struct for the frontend to call.
5. **Update the frontend** to call the new backend API.

**Note:** Saved mappings are already persisted in the frontend’s `localStorage`. That feature remains frontend‑only for now; the backend does not need to manage saved mappings.

---

## 1. Database Schema

### 1.1 Import Sessions (`import_sessions`) – Optional

Useful for audit and deduplication. Can be added later if needed; not required for MVP.

| Column          | Type     | Constraints                         | Description |
|-----------------|----------|-------------------------------------|-------------|
| `id`            | INTEGER  | PRIMARY KEY AUTOINCREMENT           | |
| `mapping_json`  | TEXT     | NOT NULL                            | JSON‑serialized `ImportMapping` used |
| `account`       | TEXT     | NOT NULL                            | Account name used for this import |
| `currency`      | TEXT     | NOT NULL DEFAULT 'CAD'              | |
| `file_count`    | INTEGER  | NOT NULL DEFAULT 1                  | Number of files imported |
| `total_rows`    | INTEGER  | NOT NULL                            | Total rows processed (before month filtering) |
| `imported_rows` | INTEGER  | NOT NULL                            | Rows actually inserted after month filtering |
| `selected_months`| TEXT    | NOT NULL                            | JSON array of month keys (`["2025-12"]`) |
| `created_at`    | TEXT     | DEFAULT CURRENT_TIMESTAMP           | |

**Indexes:**
- `idx_import_sessions_created_at` for chronological reports.

### 1.2 Extend `transactions` table (existing)

The existing `transactions` table already includes all required fields (`account`, `currency`, `amount`, `description`, `owner`, `date`, `category`, `raw_metadata`). No changes needed.

**Considerations:**
- Add a nullable `import_session_id` column to link transactions to an import session (optional for now). **Will be omitted for MVP.**

---

## 2. Go Data Models

Create new files under `internal/models/`:

### 2.1 `mapping.go`

Mirrors the frontend’s `AmountMapping` and `ImportMapping` types.

```go
package models

// AmountMapping mirrors the frontend’s AmountMapping union.
type AmountMapping struct {
    Type         string  `json:"type"` // "single", "debitCredit", "amountWithType"
    Column       string  `json:"column,omitempty"`
    DebitColumn  string  `json:"debitColumn,omitempty"`
    CreditColumn string  `json:"creditColumn,omitempty"`
    AmountColumn string  `json:"amountColumn,omitempty"`
    TypeColumn   string  `json:"typeColumn,omitempty"`
}

// ImportMapping mirrors frontend’s ImportMapping.
type ImportMapping struct {
    CSV struct {
        Date          string        `json:"date"`
        Description   []string      `json:"description"`
        Amount        string        `json:"amount"` // legacy
        AmountMapping *AmountMapping `json:"amountMapping,omitempty"`
        Owner         string        `json:"owner,omitempty"`
        Currency      string        `json:"currency,omitempty"`
    } `json:"csv"`
    Account        string `json:"account"`
    CurrencyDefault string `json:"currencyDefault"`
}
```

### 2.2 `import_request.go`

```go
package models

// ImportRequest is the payload sent from the frontend when confirming an import.
type ImportRequest struct {
    Mapping        ImportMapping `json:"mapping"`
    ParsedRows     []ParsedRow   `json:"parsedRows"` // Already mapped rows (frontend sends them)
    SelectedMonths []string      `json:"selectedMonths"` // Month keys ("2025-12")
}

// ParsedRow represents a single row after mapping, ready for insertion.
type ParsedRow struct {
    Date        string  `json:"date"`       // ISO 8601 (YYYY-MM-DD)
    Description string  `json:"description"`
    Amount      float64 `json:"amount"`
    Owner       string  `json:"owner"`
    Currency    string  `json:"currency"`
}
```

**Note:** The frontend already computes `ParsedRow` in `ImportConfirmation.tsx` (previewRows). We’ll reuse that logic for **all** rows and send the pre‑mapped data to the backend. This keeps mapping logic in one place (frontend) and simplifies the backend.

### 2.3 `import_result.go`

```go
package models

type ImportResult struct {
    TotalRows    int `json:"totalRows"`
    ImportedRows int `json:"importedRows"`
    SkippedRows  int `json:"skippedRows"` // duplicates, etc.
}
```

---

## 3. Service Layer

Create `internal/services/import.go`:

### 3.1 Import Service

- `ImportTransactions(req ImportRequest) (ImportResult, error)`

**Steps:**
1. Validate required fields.
2. For each `ParsedRow`:
   - Parse the date string (already in ISO‑8601 `YYYY‑MM‑DD` from frontend).
   - Determine month key (`YYYY‑MM`).
   - Keep only rows whose month key is in `req.SelectedMonths`.
3. For each kept row, build a `Transaction` model:
   - `Account` from `req.Mapping.Account`
   - `Currency` from row’s currency (or `req.Mapping.CurrencyDefault`)
   - `Amount`, `Description`, `Owner`, `Date`
   - `Category` = `""` (uncategorized)
   - `RawMetadata` = `""` (optional, could store original CSV columns as JSON)
4. Insert batch into `transactions` table using a prepared statement.
5. Return `ImportResult` with counts.

**Duplicate Prevention:** For MVP, skip duplicates based on (`account`, `date`, `amount`, `description`) hash. Implement a simple `SELECT EXISTS` before each insert, or use `INSERT OR IGNORE` with a unique constraint. We’ll add a unique constraint later; for now we can skip duplicates in code.

### 3.2 Database Helpers

Extend `internal/database/db.go` with helper functions:
- `InsertTransactions(tx []Transaction) error`
- `TransactionExists(t Transaction) (bool, error)` (optional)

**Performance:** Use a single SQL transaction and batch insert with `INSERT INTO transactions (...) VALUES (...), (...), ...`.

---

## 4. Wails Bindings

Add methods to `App` in `app.go` (or a separate file `app_import.go`):

```go
// ImportTransactions is the main import endpoint.
func (a *App) ImportTransactions(req models.ImportRequest) (models.ImportResult, error) {
    // Call service layer
}
```

**Note:** Wails automatically exposes this method to the frontend via the generated TypeScript bindings (`frontend/wailsjs/go/main/App`). After adding the method, run `wails dev` to regenerate the bindings.

---

## 5. Frontend Integration

Update `frontend/src/components/data-ingestion/ImportConfirmation.tsx`:

1. Import the generated Wails binding:
   ```ts
   import { ImportTransactions } from "../../wailsjs/go/main/App";
   ```
2. Replace the `onConfirm` log with a call to `ImportTransactions(request)`.
3. Prepare the request payload:
   - Extract the mapping logic from `previewRows` into a reusable function `mapAllRows(parsedFile, mapping): ParsedRow[]`.
   - Ensure `ParsedRow.Date` is formatted as ISO 8601 (`YYYY-MM-DD`). Use the existing `parseDateLoose` helper and convert to ISO string.
   - Apply this function to **all** rows (not just preview). For multiple files, concatenate results.
   - Combine `mapping`, `parsedRows`, `selectedMonthKeys`.
4. Show a loading spinner while the import runs.
5. On success, show a toast and navigate to the categorization view (future).
6. On error, display the error message.

**Performance Note:** Mapping all rows synchronously could block the UI for very large files (10k+ rows). For MVP we assume typical bank exports are under 2,000 rows. If needed, we can move the mapping to a Web Worker later.

---

## 6. Error Handling & Validation

- Validate that `ParsedRow` amounts are numbers.
- Ensure dates are in ISO‑8601 (`YYYY‑MM‑DD`) format (frontend already converts).
- Handle duplicate transactions gracefully (skip with warning).
- Use SQL transactions to roll back if any insert fails.

---

## 7. Testing Strategy

- Unit tests for `services/import.go` (date parsing, month filtering, amount conversion).
- Integration tests that insert real transactions and verify counts.
- Mock the database for service‑layer tests.

---

## 8. Future Enhancements (Out of Scope)

- Excel file parsing (frontend currently mocks this).
- Automatic detection of bank formats.
- Deduplication based on transaction hash.
- Undo import / delete imported transactions.
- Saved mappings backend persistence (currently frontend only).
- Import sessions audit table.

---

## 9. Timeline Estimate

| Task | Estimate |
|------|----------|
| Go data models | 0.5 day |
| Import service (core logic) | 1.5 days |
| Database helpers & batch insert | 0.5 day |
| Wails bindings | 0.5 day |
| Frontend integration | 1 day |
| Testing & bug fixes | 1 day |
| **Total** | **5 days** |

---

## 10. Next Steps

1. Review this plan with the team.
2. Start with data models and service layer.
3. Implement database helpers.
4. Integrate with frontend and test with real CSV exports.

---

*Last updated: December 13, 2025*