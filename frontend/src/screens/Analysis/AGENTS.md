# Analysis Screen

This directory contains the Analysis screen, which provides a detailed breakdown of transactions grouped by various criteria.

## Common Patterns

### In-Place Category Editing
Transactions can be re-categorized directly within the list table using a "Ghost Input" pattern.

- **Component**: `EditableCategoryCell` (in `GroupedTransactionList.tsx`)
- **Interaction**: 
    - Click on a category tag to enter edit mode.
    - Edit mode replaces the tag with `CategoryGhostInput`.
    - `Enter`: Saves the category and exits edit mode.
    - `Escape`: Cancels and exits edit mode.
    - `Blur`: Saves the category and exits edit mode.
- **Backend**: Updates are handled via `CategorizeTransaction` Wails binding in `Analysis.tsx`.
- **Data Refresh**: After saving, the UI triggers both transaction and category refreshes to ensure all views (including filters and groupings) are up-to-date.

## Reference Examples
- `frontend/src/screens/Analysis/components/CategoryGhostInput.tsx`: The minimal search/input component.
- `frontend/src/screens/Analysis/components/GroupedTransactionList.tsx`: Implements the `EditableCategoryCell`.
- `frontend/src/screens/Analysis/Analysis.tsx`: Handles the categorization logic and data flow.
