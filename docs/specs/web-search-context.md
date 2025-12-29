# Web Search Context Spec

UI Location: frontend/src/screens/CategorizationLoop/components/

## Goal
Help users identify forgotten transactions by searching the web with transaction descriptions. Often a merchant or business will be found, giving the user an "aha moment" to recall where they spent or received money.

## Trigger
Manual only. User clicks "Search Web" button when stumped.
Keyboard shortcut: Cmd+K (Mac) or Ctrl+K (Windows/Linux)

## Search Query
Use raw transaction description as-is (no cleaning or stripping of banking prefixes).
Search entire description string.

## Results Display
Location: Collapsible section below TransactionCard
Count: Top 5 results
Layout per result:
- Title (bold, clickable link)
- Snippet (lighter text, truncated)
- Domain (subtle gray)

## States
- Loading: "Searching web..." with spinner
- Success: 5 result cards in collapsible section
- Empty: "No results found for this transaction"
- Error: "Web search unavailable. Try again later"

## Technical
Backend: Expose internal/brave.Search via Wails binding
Frontend: New WebSearchResults component
Cache: In-memory map of description hash to results (per session)
Timeout: 15s

## Non-Goals
- Not automatic: Must be manual trigger to preserve rapid flow
- Not auto-categorization: Just show clues, user decides category
- Not persistent: Cache is session-only, no database storage
