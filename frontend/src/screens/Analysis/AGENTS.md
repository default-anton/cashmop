# Analysis Screen

## Rules
- **Group-level Sorting**: Controls must be next to grouping buttons (`All`, `Category`, `Owner`, `Account`).
- **UI/UX**: 
    - Keep Category column visible even when grouping by Category to allow re-categorization.

## Common Patterns

### In-Place Category Editing
Transactions can be re-categorized directly in the table.
- **Component**: `EditableCategoryCell` using `CategoryGhostInput`.
- **Interaction**:
    - Click category tag to edit.
    - `Enter`: Save and exit. If suggestions are present, selects the first or highlighted one.
    - `Tab`/`Shift+Tab`: Navigate suggestions (wraps around).
    - `ArrowUp`/`ArrowDown`: Navigate suggestions (wraps around).
    - `Blur`: Cancel and exit.
    - `Escape`: Cancel and exit.
    - **Empty Input**: Saving an empty or whitespace-only value makes the transaction uncategorized (sets `category_id` to `NULL` in DB).
- **Data Refresh**: Trigger both transaction and category refreshes after save.

## Reference Examples
- `frontend/src/screens/Analysis/Analysis.tsx`: Main screen, sorting logic, and data orchestration.
- `frontend/src/screens/Analysis/components/GroupedTransactionList.tsx`: Table integration and `EditableCategoryCell`.
- `frontend/src/screens/Analysis/components/CategoryGhostInput.tsx`: Search/input component with portal-based suggestions.
