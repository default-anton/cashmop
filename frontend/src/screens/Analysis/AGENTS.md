# Analysis Screen

The analysis screen provides deep dives into financial data with flexible grouping and multi-level sorting.

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
- **UI/UX**: The Category column is always visible in `GroupedTransactionList` (even when grouping by Category) to ensure transactions can be re-categorized in any view.
- **Backend**: Updates are handled via `CategorizeTransaction` Wails binding in `Analysis.tsx`.
- **Data Refresh**: After saving, the UI triggers both transaction and category refreshes to ensure all views (including filters and groupings) are up-to-date.

## Sorting & Grouping Rules

- **Group-level Sorting**: Sort controls for groups (e.g., sort by Name or Total) must be placed in the main controls area, next to the grouping buttons (`All`, `Category`, `Owner`, `Account`).
- **Transaction-level Sorting**: Sort controls for individual transactions must be integrated into the `Table` headers.
- **Terminology**: Use "Owner" to refer to the transaction owner/entity in the UI (corresponds to `owner_name` in the database).
- **Icons**: Use `User` icon for the "Owner" category and the `ArrowUpDown` icon for sort affordances.

## Reference Examples

- `frontend/src/screens/Analysis/Analysis.tsx`: Main screen and group sort controls.
- `frontend/src/screens/Analysis/components/GroupedTransactionList.tsx`: Transaction lists and table sorting integration.
- `frontend/src/screens/Analysis/components/CategoryGhostInput.tsx`: The minimal search/input component.
