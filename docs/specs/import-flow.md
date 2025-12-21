# Import Flow Spec

UI Location: `frontend/src/screens/ImportFlow/`

## Data Ingestion
* Source: User exports CSV/Excel from banks.
* Mechanism: Drag-and-drop.
* Column Mapping:
    * Analyzes first file dropped.
    * Drag-and-drop interface to map CSV columns to app schema.
    * Mappings savable (e.g., "RBC Bank") for automatic future imports.
* Required Data Schema:
    1. `Account`: Distinguish multiple accounts.
    2. `Currency`: Default CAD.
    3. `Amount`: +/- handling, Debit/Credit columns, or Amount+Type.
    4. `Description`: Transaction details (can combine columns).
    5. `Owner`: Distinguish spouses/users.
    6. `Date`: Transaction date.
* Import Logic:
    * Prompt to import transactions from *last month* or select specific months.
    * Handles overlapping data.
    * Defaults to last month based on file dates.
