# Task: Implement In-Place Category Editing in Analysis Screen

## Context
The Analysis screen (`frontend/src/screens/Analysis/Analysis.tsx`) displays transactions in a grouped table format. Currently, categories are displayed as static tags. To improve the curation experience, we need to allow users to update a transaction's category directly within this table.

## Requirements

### 1. Ghost Input Interaction
- Transform the Category tag in `GroupedTransactionList.tsx` into an interactive element.
- On click, the tag should be replaced by a focused, minimal search input ("Ghost Input").
- The input should support search-as-you-type for existing categories.
- Use the existing BM25-backed search logic if available, or a simple fuzzy filter of existing categories.

### 2. Keyboard & Focus Behavior
- **Enter**: Save the selected category and return to the tag view.
- **Escape**: Cancel editing and revert to the original tag.
- **Blur**: Save the current selection (or the first match) and revert to the tag view.
- The input must auto-focus immediately when the tag is clicked.

### 3. Backend Integration
- When a category is selected, call the appropriate Wails backend binding to update the transaction's `category_id` in the SQLite database.
- The UI should optimistically update or refresh the transaction list to reflect the change.
- If the grouping is currently set to "Category", updating the category should move the transaction to the correct group card (or trigger a data re-fetch).

### 4. UI/UX Details
- Maintain the "speed and delight" philosophy. The transition between tag and input should be seamless.
- The input should fit within the height of the table row to avoid layout shift.
- Show a subtle hover state on the Category tag to indicate it is editable (e.g., change background or show a pencil icon).

## Technical Touchpoints
- **Frontend Component**: `frontend/src/screens/Analysis/components/GroupedTransactionList.tsx`
- **Wails Bindings**: Check `frontend/src/wailsjs/go/main/App.d.ts` for transaction update methods.
- **Styling**: Tailwind CSS.
