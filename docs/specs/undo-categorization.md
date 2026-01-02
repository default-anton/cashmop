# Undo Categorization Spec

UI Location: `frontend/src/screens/CategorizationLoop/`

## Core Behavior

### Undo Scope
- Session-based undo stack (memory only, lost on refresh/close)
- Single-action depth: only the most recent action can be undone
- Applies to: single categorization, rule-based categorization, and skip actions

### Action Types

**1. Single Transaction Categorization**
- Trigger: User categorizes a transaction without text selection
- Undo: Revert transaction's `category_id` to `NULL`, re-add to uncategorized queue, jump user back to that transaction

**2. Rule-Based Categorization**
- Trigger: User categorizes with text/amount selection → creates rule + applies to matching uncategorized transactions
- Undo: Delete the rule, set all affected transactions' `category_id` to `NULL`, re-add to uncategorized queue, jump user back to the original transaction
- Critical: Must capture which transactions were affected by the rule (not just the count)

**3. Skip**
- Trigger: User punches through a transaction (empty category + Enter or skip button)
- Undo: Remove transaction ID from `skippedIds`, re-show in the queue, jump user back to that transaction

## Backend API Changes

### Go Methods to Add

```go
// Returns affected transaction IDs and the new rule ID
// Modified to return transaction IDs for undo support
func (a *App) CategorizeTransaction(id int64, categoryName string) (int64, []int64, error)

// Returns rule ID, transaction IDs affected, and error
// Modified to return transaction IDs for undo support
func (a *App) SaveCategorizationRule(rule database.CategorizationRule) (int64, []int64, error)

// Undo a rule: delete rule and revert affected transactions
// ruleId: the rule to delete
// transactionIds: transactions to revert to uncategorized
func (a *App) UndoCategorizationRule(ruleId int64, transactionIds []int64) error
```

### Implementation Notes

**CategorizeTransaction modifications:**
- Return original transaction ID and empty slice (single tx only)
- Keep existing category update logic

**SaveCategorizationRule modifications:**
- After applying rule, query `SELECT id FROM transactions WHERE category_id = ? AND [match conditions]` to get affected transaction IDs
- Return rule ID + transaction IDs

**UndoCategorizationRule logic:**
- Delete the rule: `DELETE FROM categorization_rules WHERE id = ?`
- Revert affected transactions: `UPDATE transactions SET category_id = NULL WHERE id IN (?)`

**Single transaction undo:**
- Use existing `CategorizeTransaction(id, "")` which sets category_id to NULL

## Frontend Implementation

### State Structure

```typescript
type UndoActionType = 'single' | 'rule' | 'skip' | null;

interface UndoState {
  type: UndoActionType;
  transactionId: number;
  ruleId?: number;
  affectedTransactionIds?: number[];  // For rule-based categorization
  categoryName?: string;  // For display in toast
}

// Add to CategorizationLoop component state
const [lastAction, setLastAction] = useState<UndoState | null>(null);
const [showUndoToast, setShowUndoToast] = useState(false);
```

### Undo Data Structure

When an action is performed, store:
```typescript
{
  type: 'single' | 'rule' | 'skip',
  transactionId: number,  // Primary tx (current or rule-based)
  ruleId?: number,  // Only for rule actions
  affectedTransactionIds?: number[],  // Only for rule actions
  categoryName?: string  // For display: "Undo Coffee Shop categorization"
}
```

### Action Flow

**On successful categorization (single or rule):**
1. Store action in `lastAction` state with affected transaction IDs
2. Show undo toast
3. Continue existing navigation (goToNext)
4. Start auto-fade timer (3-5 seconds)

**On skip:**
1. Store action in `lastAction` state with transactionId
2. Show undo toast
3. Continue existing navigation (goToNext)
4. Start auto-fade timer

### Toast UI

```typescript
// Position: Fixed bottom-right or bottom-center
// Auto-dismiss: 5 seconds (industry standard)
// Style: Google Material-style (subtle, with icon)
// Content: "Undo [category]" for categorization, "Undo skip" for skips
// Actions: "Undo" button + dismiss (x)

// Example toast content:
// - Single: "Undo Coffee Shop categorization" (button)
// - Rule: "Undo rule: Starbucks → Coffee (3 transactions)" (button)
// - Skip: "Undo skip" (button)
```

### Undo Handler

```typescript
const handleUndo = async () => {
  if (!lastAction) return;

  try {
    switch (lastAction.type) {
      case 'single':
        await go.main.App.CategorizeTransaction(lastAction.transactionId, '');
        break;
      case 'rule':
        await go.main.App.UndoCategorizationRule(lastAction.ruleId, lastAction.affectedTransactionIds);
        break;
      case 'skip':
        // Frontend-only: remove from skippedIds
        setSkippedIds(prev => {
          const next = new Set(prev);
          next.delete(lastAction.transactionId);
          return next;
        });
        break;
    }

    // Clear last action and hide toast
    setLastAction(null);
    setShowUndoToast(false);

    // Re-fetch transactions and jump back to the reverted transaction
    const updated = await fetchTransactions();
    if (updated.length === 0) {
      if (onFinish) onFinish();
    } else {
      setCurrentTxId(lastAction.transactionId);
      setCategoryInput('');
      setSuggestions([]);
    }
  } catch (e) {
    console.error('Undo failed', e);
  }
};
```

### Keyboard Shortcuts

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Cmd+Z / Ctrl+Z: Undo last categorization or rule
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      if (lastAction && (lastAction.type === 'single' || lastAction.type === 'rule')) {
        handleUndo();
      }
    }

    // Cmd+Shift+Z / Ctrl+Shift+Z: Undo skip
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
      e.preventDefault();
      if (lastAction && lastAction.type === 'skip') {
        handleUndo();
      }
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [lastAction]);
```

### Navigation Safety

**Critical constraint:** Undo must not break existing `goToNext` navigation logic.

**How this works:**
- `goToNext` operates on a transaction list and finds the next non-skipped ID
- When undo re-adds transactions to the queue via `fetchTransactions()`, the reverted transaction will appear in the updated list
- `setCurrentTxId(revertedTxId)` directly sets the current transaction (bypasses `goToNext`)
- Subsequent navigations continue to use `goToNext` as normal

**Edge case:** If reverted transaction is not in the updated list (should not happen):
- Fallback: set to first transaction in updated list or `null` (Inbox Zero)

## Toast Auto-Fade Behavior

```typescript
useEffect(() => {
  if (showUndoToast && lastAction) {
    const timer = setTimeout(() => {
      setShowUndoToast(false);
      // Keep lastAction state for Cmd+Z access until next action overwrites it
    }, 5000);  // 5 seconds (industry standard, matches Google, Stripe)

    return () => clearTimeout(timer);
  }
}, [showUndoToast, lastAction]);
```

## Backend Database Queries

### Rule Undo (delete + revert transactions)

```go
// Delete the rule
_, err := DB.Exec("DELETE FROM categorization_rules WHERE id = ?", ruleID)
if err != nil {
  return err
}

// Revert all affected transactions to uncategorized
placeholders := strings.Repeat("?,", len(affectedTxIds))
placeholders = placeholders[:len(placeholders)-1]  // Remove trailing comma
query := fmt.Sprintf("UPDATE transactions SET category_id = NULL WHERE id IN (%s)", placeholders)

args := make([]interface{}, len(affectedTxIds))
for i, id := range affectedTxIds {
  args[i] = id
}

_, err = DB.Exec(query, args...)
return err
```

### Getting Affected Transaction IDs (for SaveCategorizationRule)

```go
// After applying the rule, query which transactions were affected
query := `
  SELECT t.id FROM transactions t
  WHERE t.category_id = ?
    AND t.description LIKE ?
`
// Add amount filters if present
// Return the list of IDs
```

## Data Flow Example

### Rule-Based Categorization + Undo

```
1. User creates rule: "Starbucks" → "Coffee" (matches 3 transactions)
2. handleCategorize:
   - Calls SaveCategorizationRule
   - Returns: ruleId=123, affectedTxIds=[5, 12, 45]
   - Sets lastAction: {type: 'rule', transactionId: 5, ruleId: 123, affectedTransactionIds: [5, 12, 45], categoryName: 'Coffee'}
   - Shows toast: "Undo rule: Starbucks → Coffee (3 transactions)"
   - Fetches updated uncategorized transactions
   - Calls goToNext(updated, 5, false) → moves to next uncategorized

3. User clicks "Undo" or presses Cmd+Z within 5 seconds:
   - handleUndo:
     - Calls UndoCategorizationRule(123, [5, 12, 45])
     - Backend: deletes rule 123, sets category_id = NULL for txs [5, 12, 45]
     - Clears lastAction, hides toast
     - Fetches updated transactions (5, 12, 45 are back in queue)
     - setCurrentTxId(5) → jumps back to original transaction

4. User can now categorize differently
```

### Skip + Undo

```
1. User skips transaction ID 42
2. handleSkip:
   - Adds 42 to skippedIds
   - Sets lastAction: {type: 'skip', transactionId: 42}
   - Shows toast: "Undo skip"
   - Calls goToNext(transactions, 42, true) → moves to next non-skipped

3. User clicks "Undo" or presses Cmd+Shift+Z within 5 seconds:
   - handleUndo:
     - Removes 42 from skippedIds
     - Clears lastAction, hides toast
     - setCurrentTxId(42) → jumps back to skipped transaction

4. User can now categorize transaction 42
```

## Edge Cases

### No Undo Available
- `lastAction` is `null`: Cmd+Z and Cmd+Shift+Z do nothing
- Toast not shown

### Undo After New Action
- When new categorization/skip occurs: overwrite `lastAction` with new action
- Previous action cannot be undone (single-action depth)

### Undo After Toast Dismissal
- Toast auto-fades or user closes it: `lastAction` still stored in state
- Cmd+Z / Cmd+Shift+Z still works until next action overwrites it
- This matches industry standard (undo available even after toast disappears)

### Multiple Rule Applications on Same Transactions
- If rule A is applied, then rule B (different match) affects overlapping transactions:
  - Undoing rule B only reverts transactions affected by rule B
  - Transactions affected by both rules will have rule A's category (not NULL)

### Concurrent Categorization (Multiple Sessions)
- Session-based undo only tracks current session
- If user opens two app instances, each has independent undo state

## Testing Requirements

### Backend
- [ ] `CategorizeTransaction` returns transaction ID + affected IDs (empty for single)
- [ ] `SaveCategorizationRule` returns rule ID + affected transaction IDs
- [ ] `UndoCategorizationRule` correctly deletes rule and reverts all affected transactions
- [ ] Rule undo only affects transactions that were categorized by that rule

### Frontend
- [ ] Undo toast appears after categorization
- [ ] Undo toast auto-fades after 5 seconds
- [ ] Undo toast shows correct message ("Undo [category]" or "Undo rule (N transactions)")
- [ ] Clicking undo button reverts action and jumps to transaction
- [ ] Cmd+Z triggers undo for categorization and rule actions
- [ ] Cmd+Shift+Z triggers undo for skip actions
- [ ] New actions overwrite previous undo state
- [ ] Undo works even after toast disappears (keyboard only)
- [ ] Undo after categorization correctly re-adds transactions to queue
- [ ] Undo after skip correctly removes from skippedIds
- [ ] Navigation (goToNext) still works correctly after undo
- [ ] Inbox Zero state reached when all transactions categorized
- [ ] Multiple undos in a row work correctly (undo → undo again)

## Implementation Order

1. **Backend changes:**
   - Modify `CategorizeTransaction` to return transaction ID + affected IDs
   - Modify `SaveCategorizationRule` to return rule ID + affected IDs
   - Add `UndoCategorizationRule` method
   - Add database queries for getting affected transaction IDs

2. **Frontend state:**
   - Add `lastAction`, `showUndoToast` state
   - Define `UndoState` type

3. **Frontend action handling:**
   - Update `handleCategorize` to store undo state
   - Update `handleSkip` to store undo state
   - Implement `handleUndo`

4. **Frontend UI:**
   - Create `UndoToast` component
   - Add keyboard shortcut listeners

5. **Testing:**
   - Write unit tests for backend methods
   - Test full flow manually (or add e2e tests)

## Files to Modify

### Backend
- `app.go`: Modify `CategorizeTransaction`, `SaveCategorizationRule`, add `UndoCategorizationRule`
- `internal/database/rules.go`: Possibly add helper for getting affected transaction IDs

### Frontend
- `frontend/src/screens/CategorizationLoop/CategorizationLoop.tsx`: Add state, handlers, keyboard shortcuts
- `frontend/src/screens/CategorizationLoop/components/UndoToast.tsx`: New component (or integrate inline)
- `frontend/src/screens/CategorizationLoop/components/index.ts`: Export `UndoToast`

## References
- Existing categorization logic: `frontend/src/screens/CategorizationLoop/CategorizationLoop.tsx`
- Existing rule logic: `app.go` → `SaveCategorizationRule`
- Existing navigation: `goToNext` function in CategorizationLoop
