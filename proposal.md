## Problem: Single CSV Exports Often Contain Multiple Accounts

Bank exports (CSV/Excel) frequently bundle transactions from multiple accounts—checking, savings, credit cards—into a single file. The current import flow forces all transactions into one selected account, requiring users to split the file manually or run multiple imports. This is a significant friction point for power users.

## Core Design Principles (Seasoned Entrepreneur Lens)

1. Delight through simplicity – The solution must feel obvious, not overwhelming.
2. Power when needed – Advanced users should be able to map multiple accounts without extra steps; casual users shouldn’t notice the complexity.
3. Leverage existing patterns – Reuse the mental model and UI components already established (Owner mapping, drag‑and‑drop, saved mappings).
4. Zero‑break compatibility – Existing saved mappings and single‑account imports must keep working exactly as they do today.

## Proposed Solution: Column‑Based Account Mapping

### 1. Extend the ImportMapping Type

Add an `accountMapping` field that can be either:

```ts
type AccountMapping =
  | { type: 'single', account: string }                           // current behavior
  | { type: 'column', column: string, mapping: Record<string, string> }; // new
```

`mapping` is a dictionary from CSV column values (e.g., `"4500123456"`, `"VISA"`) to app account names (e.g., `"RBC Checking"`). This keeps saved mappings backward‑compatible (existing mappings default to `type: 'single'`).

### 2. UI Flow – Two Tiers of Complexity

Tier 1 – Single Account (Default, unchanged)  
The current account selector remains as is. A new toggle “Map from CSV column” (or a subtle “Advanced” link) reveals the column‑mapping option.

Tier 2 – Map from Column (Advanced)  
When the user chooses to map from a column:

- Column drop‑target appears (identical to Owner/Currency), allowing them to drag a header like “Account Number” or “Account Name”.
- Auto‑detect distinct values – The UI samples the first 100 rows, extracts unique values from the chosen column, and displays them in a compact table.
- Mapping table – Each distinct CSV value gets a dropdown of existing accounts plus “Create new…” (mirroring the Owner pattern). Users can map many‑to‑one (e.g., multiple account numbers to the same logical account) or create new accounts on‑the‑fly.
- Preview – A small badge shows how many distinct values were found and how many are already mapped.

### 3. Visual Design & Placement

- Place the new “Map from CSV column” toggle directly below the existing account selector, using a subdued link style (`text‑brand hover:underline`).
- When active, replace the single‑account dropdown with:
  1. A `DropTarget` for the account column (identical to the Owner drop‑zone).
  2. A compact, card‑style table of CSV‑value‑to‑account mappings (max 5 rows visible, scrollable).
- Use the same `SingleMappingPill` + `Select` components as the Owner field for consistency.
- Add a hint: “Leave column empty to assign all transactions to a single account.”

### 4. Handling Edge Cases

- Empty mapping cells – If a row’s account column is empty, fall back to a “Default account” selection (optional).
- New accounts – When a user maps a CSV value to “Create new…”, add the new account to `availableAccounts` and persist to localStorage (same as today).
- Performance – Distinct‑value detection runs on a sample (first 100 rows) to keep the UI snappy. A note informs users: “Mapping based on first 100 rows. All rows will use these rules.”
- Validation – Require that every distinct value is mapped before proceeding, or allow a “Remaining unmapped rows will use default account” option.

### 5. Confirmation & Preview

- Update the ImportConfirmation screen to show account mapping summary:
  - If single account: “All transactions → RBC Checking”
  - If column mapping: “Account Number → RBC Checking (45 rows), TD Visa (12 rows)”
- Preview rows should include the mapped account column so users can verify.

## Why This Design Wins

- Familiar – Uses the same drag‑and‑drop, dropdown, and mapping patterns users already understand from Owner and Amount mapping.
- Progressive disclosure – Casual users never see the complexity; power users get a powerful feature without leaving the flow.
- Scalable – Works for 2 accounts or 20.
- Future‑proof – The `accountMapping` type can later support more complex rules (regex, conditional logic) without breaking existing saves.

## Implementation Sketch

1. Extend `ImportMapping` type in `frontend/src/screens/ImportFlow/components/ColumnMapper.tsx`.
2. Add `accountMapping` state and UI toggle.
3. Add `distinctAccountValues` derived from parsed files (sample‑based).
4. Render mapping table when `accountMapping.type === 'column'`.
5. Update validation (`canProceed`) to handle both mapping types.
6. Update `ImportConfirmation` to display the mapping summary.
7. Ensure saved mappings are migrated (default `type: 'single'`).

## Final Thought

This enhancement turns a pain point (splitting CSV files) into a moment of delight (“Wow, it automatically separated my checking and savings!”). It aligns perfectly with the app’s desktop‑first, tech‑savvy audience and reinforces the product’s position as the fastest, most delightful cash‑flow tracker.

*No edits required now—this is a strategic recommendation. When you’re ready to implement, I can help with the detailed code changes.*
