# Categorization Loop Spec

UI Location: `frontend/src/screens/CategorizationLoop/`

## Core Experience
* "TikTok Style": One uncategorized transaction at a time.
* Rapid Flow: Categorizing a transaction automatically flips to the next item.
* Progress tracking with a progress bar and counter.
* "Inbox Zero" state when all transactions are processed.

## Rule Creation (Heuristics)
* Text Selection:
    * User selects a substring in the description (e.g., "Starbucks").
    * App detects if selection is at the start, end, or middle to suggest:
        * `Starts With`
        * `Ends With`
        * `Contains`
* Amount Logic:
    * Optional filters to refine rules.
    * Operators: `Greater than`, `Less than`, `Between`.
    * Smart handling of expenses vs. income for absolute values.
* Live Preview:
    * Displays the number of other transactions that would be matched by the current rule in real-time.

## Categorization Action
* Manual Categorization: If no text is selected, applies category to the single current transaction.
* Rule-based Categorization: If text is selected, creates a `CategorizationRule` and applies it to all matching uncategorized transactions.
* Category Suggestions: Search-as-you-type for existing categories to prevent duplicates (BM25 backed).

## Navigation
* Skip: Moves the current transaction to the end of the queue.
* Keyboard Focus: Input field remains focused for fast typing.
