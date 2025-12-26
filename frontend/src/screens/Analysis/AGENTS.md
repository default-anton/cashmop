# Analysis Screen

## Rules
- **Group-level Sorting**: Controls must be next to grouping buttons (`All`, `Category`, `Owner`, `Account`).
- **Transaction-level Sorting**: Integrated into `Table` headers.
- **Terminology**: Use "Owner" (corresponds to `owner_name` in DB).
- **Icons**: `User` for Owner, `ArrowUpDown` for sort.
- **UI/UX**: 
    - Keep Category column visible even when grouping by Category to allow re-categorization.
    - **No Caps for Names**: Do not use `uppercase` for names/metadata (Categories, Accounts, Owners). Use normal casing.
    - **Visual Stability**: Use **Optimistic Updates** for categorization. Never trigger a global loading state that unmounts the list. Use `framer-motion` (layout prop) to animate transactions moving between cards and `AnimatePresence` for cards appearing/disappearing.
    - **Success Feedback**: Provide immediate in-place feedback (e.g., success flash on the tag) after a save, while syncing the backend in the background.

## Common Patterns

### In-Place Category Editing
Transactions can be re-categorized directly in the table.
- **Component**: `EditableCategoryCell` using `CategoryGhostInput`.
- **Interaction**:
    - Click category tag to edit.
    - `Enter` or `Blur`: Save and exit.
    - `Escape`: Cancel and exit.
- **Dropdowns in Tables**: Use **React Portals** (`createPortal`) for suggestions/dropdowns in table cells to prevent clipping by `overflow-hidden` or causing unwanted table height changes.
- **Data Refresh**: Trigger both transaction and category refreshes after save.

## Reference Examples
- `frontend/src/screens/Analysis/Analysis.tsx`: Main screen, sorting logic, and data orchestration.
- `frontend/src/screens/Analysis/components/GroupedTransactionList.tsx`: Table integration and `EditableCategoryCell`.
- `frontend/src/screens/Analysis/components/CategoryGhostInput.tsx`: Search/input component with portal-based suggestions.
