### Product Overview
* Concept: High-performance, desktop-first cash flow tracking.
* Target Audience: Tech-savvy users, solo, or couples.
* Philosophy: Delightful, fast, friction-free.
* Platform: Cross-platform Desktop (Windows, Linux, macOS). *Note: Explicitly not a web or mobile app.*

---

## Feature Specifications

- [Data Ingestion (Import Flow)](./docs/specs/import-flow.md)
- [The Categorization Loop](./docs/specs/categorization-loop.md)
- [Analysis Screen](./docs/specs/analysis.md)

---

### 4. Technical Stack & Intelligence (TO BE IMPLEMENTED)
* Web Search Integration:
    * Integrate a free search engine API (e.g., DuckDuckGo, Brave) to allow users to search for transaction details directly from the app.
    * Goal: If the user is unsure how to categorize a transaction, the system suggests a category based on similar past transactions (keyword search using BM25).

---

### 5. Data Export (TO BE IMPLEMENTED)
* General: Users must be able to get their data out easily.
* Formats:
    1.  CSV:
        * Option to export full history.
        * Option to export specific date ranges (e.g., month-by-month).
        * If exporting by month, generate separate files (e.g., 12 files for a year).
    2.  Google Sheets:
        * API integration.
        * Click a button to push data to a specific folder/sheet in the user's Google Drive.
    3.  Apple Numbers:
        * Specific formatting for macOS users.
