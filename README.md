### Product Overview
* Concept: High-performance, desktop-first cash flow tracking.
* Target Audience: Tech-savvy users, solo, or couples.
* Philosophy: Delightful, fast, friction-free.
* Platform: Cross-platform Desktop (Windows, Linux, macOS). *Note: Explicitly not a web or mobile app.*

---

### 1. Data Ingestion (Import Flow)
* Source: User exports CSV or Excel files from their banks. (Excel is currently mocked)
* Mechanism: Drag-and-drop file import.
* Column Mapping:
    * The system analyzes the first file dropped.
    * User maps the CSV columns to the app’s internal schema via a drag-and-drop interface.
    * Mappings can be saved (e.g., named "RBC Bank") so future imports from the same source are automatic. (Automation is pending; currently requires manual selection)
* Required Data Schema:
    1.  Account: (To distinguish between multiple bank accounts).
    2.  Currency: (Default: CAD/Canadian Dollar).
    3.  Amount: (Can be negative or positive, can be in separate Debit/Credit columns, a single Amount column, or in separate Amount + Type columns).
    4.  Description: (Transaction details, can combine multiple CSV columns if needed).
    5.  Owner: (To distinguish between spouses/users in a multi-user setup).
    6.  Date: (Transaction date).
* Import Logic: User is prompted to transactions from the *last month* or select months to import (to handle overlapping data in bank exports). *Note: This should be a month multi-selector UI based on the transaction dates in the file. Defaults to the last month.*

---

### 2. The Categorization Loop (Core Feature)
* The UI Experience ("TikTok Style"):
    * Focus is on one uncategorized transaction at a time.
    * User categorizes it, and the app immediately flips to the next uncategorized transaction.
    * Goal: "Punch through" uncategorized items rapidly.
* Rule Creation (Heuristics):
    * Text Selection: User uses the mouse to select a substring within the Description (e.g., highlight "Starbucks").
    * Logic: The app creates a filter based on the selection (Contains, Starts With, or Ends With).
    * Value Logic: Optional filters for amounts (Greater than, Less than, or Between X and Y).
* Auto-Matching:
    * Once a rule is created (Category + Name), the app applies it to the current transaction *and* searches for all other existing uncategorized transactions that match.
    * These are batch-categorized immediately ("punched through").
* Duplicate Prevention: When creating a new category, the system allows searching existing categories to prevent slight naming variations (keyword search using BM25).

---

### 3. Data Analysis & View
* Philosophy: "Charts are overrated." Focus on raw numbers and clear grouping.
* Grouping:
    * Group by Owner (e.g., Wife vs. Husband).
    * Group by Categories.
* Metrics:
    * Subtotals per group.
    * Net Total (Cash positive vs. Cash negative).
* Filtering: Multi-select categories to isolate specific spending (e.g., view only "Groceries" and "Utilities").

---

### 4. Technical Stack & Intelligence
* Database: Local on-device database.
* Web Search Integration:
    * Integrate a free search engine API (e.g., DuckDuckGo) to allow users to search for transaction details directly from the app.
    * Goal: If the user is unsure how to categorize a transaction, the system suggests a category based on similar past transactions (keyword search using BM25).


---

### 5. Data Export
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
