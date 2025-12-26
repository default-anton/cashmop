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
    - `Enter` or `Blur`: Save and exit.
    - `Escape`: Cancel and exit.
- **Data Refresh**: Trigger both transaction and category refreshes after save.

## Reference Examples
- `frontend/src/screens/Analysis/Analysis.tsx`: Main screen, sorting logic, and data orchestration.
- `frontend/src/screens/Analysis/components/GroupedTransactionList.tsx`: Table integration and `EditableCategoryCell`.
- `frontend/src/screens/Analysis/components/CategoryGhostInput.tsx`: Search/input component with portal-based suggestions.
