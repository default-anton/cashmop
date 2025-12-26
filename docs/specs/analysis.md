# Analysis Spec

UI Location: `frontend/src/screens/Analysis/`

## Core Experience
* Comprehensive view of financial health for a selected period.
* Time-based Analysis: Month-by-month selection.
* Summary Cards: Real-time calculation of Total Income, Total Expenses, and Net Flow.
* Flexible Grouping: View data grouped by Category, Owner, Account, or a flat list.

## Filtering & Selection
* Month Selector: Quick access to any month with historical data.
* Category Filter: Multi-select dropdown to drill down into specific spending areas.
* Real-time Updates: Totals and lists update instantly upon filter or grouping changes.

## Data Organization
* Multi-level Sorting:
    * Group Level: Sort groups by name or by their absolute total amount.
    * Transaction Level: Sort transactions within groups by date or amount.
* Visual Grouping: Groups are presented as cards with their own subtotals and transaction counts.

## Transaction View
* Rich Table Interface:
    * Date: Visual calendar-style icons.
    * Description: Clear, legible transaction labels.
    * Contextual Tags: Inline display of Account, Category, and Owner (dynamically hidden based on grouping).
    * Amount: Color-coded (Income vs. Expense) with mono-spaced font for alignment.
* Empty States: Friendly guidance when no data matches the current filters.
