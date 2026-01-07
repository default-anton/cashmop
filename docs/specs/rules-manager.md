# Rules Manager Spec

UI Location: `frontend/src/screens/RuleManager/`

## Core Experience
* Dedicated screen to view, create, edit, and delete categorization rules
* Table-based display with sorting and filtering
* Reuse categorization loop visual language (RuleEditor component, matching preview)
* Accessible via main nav (separate item) and from CategoryManager cards
* Reuse existing UI components, look and feel from categorization loop and analysis screens (extract components as needed)

## Table View (same style as table in frontend/src/screens/Analysis/Analysis.tsx)

Reuse components from `frontend/src/screens/Analysis/` (extract components as needed).

**Columns:**
- **Match Type**: Badge showing `Contains`, `Starts With`, `Ends With`, `Exact`
- **Match Value**: The text pattern (e.g., "Uber", "Starbucks")
- **Amount Filter**: Compact display (e.g., "Any", "≥ $50", "≤ $20", "$10-$50")
- **Category**: Category name with badge styling
- **Created**: Date/time rule was created (sortable)
- **Actions**: Edit and delete buttons

**Table Features:**
- Sort by any column
- Filter by category (reuse CategoryFilterContent component, frontend/src/screens/Analysis/components/GroupedTransactionList.tsx)
- Filter by match type
- Empty state

## Create/Edit Rule

Reuse components from categorization loop `frontend/src/screens/CategorizationLoop/`

**Modal UI:**
- Reuse `RuleEditor.tsx` component from categorization loop
- Fields:
  - Match type selector (dropdown or segmented control)
  - Match value input
  - Amount filter (Any / ≥ / ≤ / Between with inline inputs)
  - Category search input (fuzzy-backed autocomplete)
- Live preview: Shows all matching transactions (including already categorized)
  - Columns: Date, Description, Amount (converted to main currency), Current Category (if any)
  - Match count: "X matching transaction(s)"
  - Table scrollable if >10 matches

**Save Behavior:**
- New rule: Creates rule, applies to matching uncategorized transactions
- Existing rule edit: Presents choice:
  1. **Update rule only**: Change rule criteria, don't touch existing categorizations
  2. **Update + recategorize**: Uncategize all transactions matched by OLD rule, then apply NEW rule to all matching uncategorized transactions

**Edit Modal UX:**
- Show current rule values pre-populated
- "Save changes" button opens confirmation:
  - Primary: "Update + Recategorize (X transactions)"
  - Secondary: "Update rule only"
  - Cancel

## Delete Rule

**Trigger:**
- Click delete icon in table row
- Confirmation dialog with two options:
  1. **Delete rule only**: Removes rule, keeps existing categorizations intact
  2. **Delete + uncategorize**: Removes rule AND sets all currently matching transactions' category_id to NULL

**Delete + uncategorize logic:**
- Find all transactions matching the rule (using same logic as `ApplyRuleWithIds`)
- Set those transactions' category_id to NULL
- Delete the rule

**Delete rule only logic:**
- Delete the rule
- No changes to transactions

## Navigation Integration

**Main Nav:**
- Add "Rules" button to top navigation
- Position: After "Categories" (or between "Categorize" and "Categories")

**From CategoryManager:**
- Each category card should have a "View Rules" button/icon
- Clicking navigates to RuleManager with category filter pre-applied

**Category Deletion Cascade:**
- When a category is deleted, all associated rules must be deleted

## References
- Existing categorization logic: `frontend/src/screens/CategorizationLoop/CategorizationLoop.tsx`
- RuleEditor component: `frontend/src/screens/CategorizationLoop/components/RuleEditor.tsx`
- Category rules backend: `internal/database/rules.go`
- Category manager: `frontend/src/screens/CategoryManager/CategoryManager.tsx`
- Table component pattern: `frontend/src/components/Table.tsx`
