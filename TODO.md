# TODO: Data Ingestion (Import Flow) UI Completion

## Missing Features

1. **Amount column mapping flexibility** ✅ **Done**
   - UI now supports three mapping types:
     - Single column (default)
     - Separate Debit/Credit columns (map Debit as negative, Credit as positive)
     - Amount + Type column (separate amount and Debit/Credit indicator)
   - Validation ensures at least one column is mapped for Debit/Credit, both columns for Amount+Type.
   - Drag‑and‑drop interface for each column.

2. **Saved mappings persistence** ✅ **Done**
   - Saved mappings are now persisted to `localStorage` (key: `cashflow.savedMappings`).
   - Automatically loaded on component mount, saved on every update.
   - Existing saved mappings (RBC Bank, TD Visa) include the new `amountMapping` field for backward compatibility.

3. **Import confirmation integration**
   - The “Confirm Import” button only logs to console.
   - Will need to connect to a backend import API when available.

4. **Error handling improvements** ✅ **Done**
   - More robust validation for malformed CSV files, empty files, unsupported encodings, etc.

## Nice‑to‑have Enhancements

- Preview of mapped data (sample rows) before confirmation. ✅ **Done**
- Ability to edit/rename/delete saved mappings.
- Support for multiple file upload (batch import). ✅ **Done** (UI implemented; backend integration pending)
- Automatic detection of common bank formats (RBC, TD, etc.) and pre‑load saved mappings.
- Drag‑and‑drop reordering of combined Description columns. ✅ **Done**
