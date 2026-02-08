# Category Manager Spec

UI Location: `frontend/src/screens/CategoryManager/`

## Core Experience

- Table-first category workspace aligned with Analysis/RuleManager visual language
- Primary tasks on one screen:
  - list categories
  - fuzzy search categories
  - rename categories inline
  - create categories
  - delete categories
  - quickly manage category rules in-context

## Category Table

Columns:
- **Category** (inline rename)
- **Transactions** (count currently assigned to category)
- **Rules** (count currently assigned to category)
- **Last Used** (latest transaction date)
- **Actions**

Toolbar:
- Search input (`aria-label="Search categories"`)
- Result count
- `New Category` button
- Clear search affordance when active

## Quick Rule Management

- Row action `Manage Rules` opens a rules modal scoped to that category
- Rules modal includes:
  - search
  - list of rules for selected category
  - create/edit/delete actions
  - optional deep-link to full RuleManager with category pre-filtered
- Rule creation from this modal prefills and locks the selected category

## Keyboard Flow (Power User)

- Screen-level:
  - `/` focuses category search
  - `Ctrl/Cmd+N` opens Create Category modal
  - `Esc` clears active category search
- Inline rename:
  - `Enter` saves
  - `Esc` cancels
- Create Category modal:
  - `Enter` creates
  - `Esc` closes
- Delete Category modal:
  - `Enter` confirms delete + uncategorize
  - `Esc` cancels
- Category Rules modal:
  - `/` focuses rule search
  - `Ctrl/Cmd+N` opens New Rule
  - `Esc` clears search, then closes when search is empty
- Rule editor modal:
  - `Ctrl/Cmd+Enter` saves (or opens update confirmation when editing)
  - `Esc` closes (or closes nested update confirmation first)

## Delete Policy

Delete category behavior is **Delete + Uncategorize**:

1. set `transactions.category_id = NULL` for all transactions in the category
2. delete the category
3. delete category-linked rules explicitly in backend (and remain compatible with FK cascade where enabled)

Delete confirmation dialog must show:
- affected transaction count
- affected rule count

## Backend API

Wails `App` methods:
- `GetCategorySummaries()`
- `CreateCategory(name string)`
- `DeleteCategory(id int64)`
- existing: `GetCategories()`, `RenameCategory(id, newName)`, rule CRUD

`DeleteCategory` response includes:
- `category_id`
- `category_name`
- `uncategorized_count`
- `deleted_rule_count`
