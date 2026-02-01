# Import Flow V2 Spec: Column-Centric Mapping

**Status:** Draft  
**Replaces:** `docs/specs/import-flow.md` (punch-through wizard)  
**Scope:** `frontend/src/screens/ImportFlow/`

---

## Core Concept

The preview table is the UI. Above **each column** is a dropdown. User scans the table, selects the app field for each CSV column from the dropdown above it.

```
File preview (5 rows)
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ [ — ▼ ]      │ [ — ▼ ]      │ [Amount ▼]   │ [ — ▼ ]      │ ← Select app field
│  Date        │  Payee       │  Amount      │   Type       │   for each column
├──────────────┼──────────────┼──────────────┼──────────────┤
│  01/15/25    │  Starbucks   │   5.00       │   DEBIT      │
│  01/16/25    │  Amazon      │  45.00       │   CREDIT     │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

---

## Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Mapping: [Chase Checking ▼]  ✓ Auto-detected from file headers            │
├─────────────────────────────────────────────────────────────────────────────┤
│  File: chase_jan.csv                    [Has header row ▼]                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  PREVIEW TABLE (scrollable horizontally if many columns)                   │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐             │
│  │ [ Date   ▼ ] │ [Description▼]│ [ Amount  ▼ ]│ [  —     ▼ ] │             │
│  │  Date        │  Payee        │  Amount      │   Type       │             │
│  ├──────────────┼──────────────┼──────────────┼──────────────┤             │
│  │  01/15/25    │  Starbucks    │   -$5.00     │   DEBIT      │             │
│  │  01/16/25    │  Amazon       │  +$45.00     │   CREDIT     │             │
│  └──────────────┴──────────────┴──────────────┴──────────────┘             │
│                                                                             │
│  Amount: [Single column ▼]  [Flip sign ☑]                                  │
│                                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  Account:  [● Static value ○ From column]  [Chase Checking ▼]              │
│  Owner:    [○ Static value ● From column]  [ — ▼ ]                         │
│  Currency: [● Static value ○ From column]  [CAD ▼]                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  [Import 42 transactions]              [Cancel]                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Auto-Detected Mapping Selection

When a file is loaded, the app attempts to auto-match a saved mapping based on normalized headers (same logic as V1). Instead of applying silently, show the matched mapping in an autocomplete input:

```
Mapping: [Chase Checking ▼]  ✓ Auto-detected from file headers
```

### Behavior
- **Match found:** Autocomplete shows the mapping name with checkmark indicator. Dropdown contains all saved mappings plus "— Custom mapping —" at bottom.
- **No match:** Shows "— Custom mapping —" with subtle prompt text.
- **User selects different mapping:** Apply that mapping's column assignments immediately. Preview table updates.
- **User edits any column dropdown:** Switch autocomplete to "— Custom mapping —" (dirty state).

### Component
Reuse `AutocompleteInput.tsx` with `filterMode="none"` to show all options without filtering.

---

## Column Dropdowns

### Position
- Fixed directly above each table column header
- Width matches column width (min 140px)
- Sticky on horizontal scroll

### Options
```
[ — Unmapped — ]
────────────────
Date
Description      ← can select multiple times
Amount
Account
Owner
Currency
```

### Visual States

| State | Render |
|-------|--------|
| **Unmapped** | `[ — ▼ ]` gray text, subtle border |
| **Mapped** | `[ Date ▼ ]` blue text, blue border |
| **Description (2nd)** | `[ Description ▼ ]` with small "×2" badge |

### Behavior

**Date:** Only one column can be Date. Selecting Date on column B auto-clears Date from column A.

**Amount:** Only one column can be Amount. Selecting Amount shows amount config panel below table.

**Description:** Can map multiple columns. Description = concat of selected columns in user-defined order (see Description Order Panel below).

**Account/Owner/Currency:** Only one column each. Mutually exclusive with static value toggle (see Static Value Toggles below).

---

## Description Order Panel

When multiple columns are mapped as Description, a reorder panel appears below the preview table:

```
Description columns (drag to reorder):
┌─────────────────────────────────────┐
│ ≡  Payee           [×]             │
│ ≡  Memo            [×]             │
│ ≡  Reference #     [×]             │
└─────────────────────────────────────┘
Preview: "Starbucks - Coffee - Ref: 12345"
         └─ Joined with " - "
```

### Behavior
- **Drag handle (≡):** Drag to reorder. Use HTML5 drag-and-drop or mouse event handlers.
- **Remove (×):** Click to unmap this column from Description.
- **Preview:** Live preview of concatenated value using selected separator.
- **Default order:** CSV left-to-right order initially.

### Separator
Default separator is `" - "` (space-dash-space). No UI to change it for now; can add later if needed.

### Persistence
Order is stored in `ImportMapping.csv.descriptionOrder: string[]` where strings are column headers.

---

## Amount Config Panel

Appears below preview table when any column mapped as Amount.

```
Amount: [Single column ▼]  [Flip sign ☑]

Single column mode: (selected)
  Amount column: Transaction Amount (column 3)
  [Flip sign] if your bank shows expenses as positive

Debit/Credit mode:
  Debit column:  [ — ▼ ]   Credit column: [ — ▼ ]
  At least one required

Amount + Type mode:
  Amount: [ — ▼ ]   Type: [ — ▼ ]
  Negative when type = [debit____]   Positive when type = [credit___]
```

### Flip Sign Persistence
The flip sign checkbox state is persisted in the mapping:

```typescript
interface AmountMapping {
  type: "single" | "debitCredit" | "amountWithType";
  // ... other fields
  invertSign: boolean;  // ← persisted per mapping
}
```

When a mapping is auto-detected or selected from the dropdown, the flip sign state restores with it. This is bank-specific—some banks consistently show expenses as positive.

### Mode Switching
- Segmented control: `[Single] [Debit/Credit] [Amount + Type]`
- Switching modes preserves column selections where applicable
- Preview table updates immediately with computed amounts

---

## Static Value Toggles

Each of Account, Owner, and Currency uses an explicit toggle pattern:

```
Account:  [● Static value ○ From column]  [Chase Checking ▼]
Owner:    [○ Static value ● From column]  [ — ▼ ]
Currency: [● Static value ○ From column]  [CAD ▼]
```

### Toggle Behavior
- **Radio-style toggle:** Two options side by side. Selected mode is filled circle (●), unselected is empty (○).
- **Static value mode:** Show `AutocompleteInput` for account/owner/currency selection. Allows creating new values on type.
- **From column mode:** Show `Select` dropdown listing CSV column headers.
- **Switching modes:** Clear the other mode's value. No silent auto-clearing—explicit toggle makes intent clear.

### Component Reuse
- Static value: `AutocompleteInput.tsx` with `onSubmit` to create new accounts/owners
- From column: `Select.tsx` with `options={csvHeaders}`

---

## Preview Table (Live Preview)

### Content
- Up to 5 unique sample rows (same logic as V1)
- Columns filtered: show if has data OR is mapped
- Resizable column widths (drag column border)

### Cell Values
| Column Type | Display |
|-------------|---------|
| **Date** | Parsed date (MM/DD/YY) or "Invalid" in red |
| **Amount** | **Computed amount**: `-$5.00` (red) or `+$45.00` (green). Raw CSV value shown as small gray text below if different. |
| **Description** | Concatenated value in user-defined order |
| **Other** | Original CSV value |

### Column Width Persistence
Column widths are persisted in the mapping metadata:

```typescript
interface ImportMapping {
  // ... existing fields
  meta?: {
    headers?: string[];
    hasHeader?: boolean;
    columnWidths?: Record<string, number>;  // ← header → width in px
  };
}
```

- On resize, store width per column header
- When mapping is applied, restore column widths if available
- Minimum width: 100px
- Maximum width: 400px

---

## Validation

### Required
- Date: exactly one column mapped
- Amount: valid config (single col, or debit/credit with ≥1, or amount+type with both)
- Description: at least one column mapped
- Account: static value entered OR column mapped

### Error Display
```
Missing: Date, Account
Mapped: 2/6 columns
```

Above Import button. Import disabled until valid.

---

## Saved Mappings

```
[☑ Save this mapping]  [Chase Checking________]
```

Auto-detection same as V1: match on normalized headers. When saving, persist:
- `meta.headers`: normalized headers for matching
- `meta.hasHeader`: whether file had header row
- `meta.columnWidths`: user-adjusted column widths
- `csv.amountMapping.invertSign`: flip sign preference

---

## Component Structure

```
ImportFlow/
├── ImportFlow.tsx
├── components/
│   ├── ColumnMapperTypes.ts
│   ├── useColumnMapping.ts
│   ├── mappingTable/
│   │   ├── MappingTable.tsx
│   │   ├── useMappingTableModel.ts
│   │   ├── components/
│   │   │   ├── MappingSelector.tsx       # auto-detected mapping autocomplete
│   │   │   ├── ColumnHeaderSelect.tsx    # dropdown above column
│   │   │   ├── PreviewTable.tsx          # table with resizeable columns
│   │   │   ├── AmountConfigPanel.tsx     # amount mode + flip sign
│   │   │   ├── DescriptionOrderPanel.tsx # reorder description columns
│   │   │   ├── StaticFieldToggle.tsx     # account/owner/currency toggles
│   │   │   └── ValidationBar.tsx
│   │   └── utils.ts
```

---

## Edge Cases

1. **No header row:** Columns labeled "Column 1", "Column 2". Dropdowns work normally. Auto-mapping disabled.

2. **Duplicate CSV headers:** "Amount" appears twice. Disambiguate as "Amount (col 3)", "Amount (col 5)" in dropdown subtitle.

3. **Many columns:** Horizontal scroll. Dropdowns stick to column positions.

4. **Amount mode switch:** User switches Single → Debit/Credit. The single Amount column becomes the Debit column selection.

5. **Description single column:** Hide Description Order Panel when only one column selected.

6. **All description columns removed:** Description field shows as "Missing" in validation.

---

## Data Model Updates

### ImportMapping (frontend/src/screens/ImportFlow/components/ColumnMapperTypes.ts)

```typescript
export type ImportMapping = {
  csv: {
    date: string;
    description: string[];
    descriptionOrder?: string[];  // ← NEW: order of description columns
    amountMapping: AmountMapping;
    account?: string;
    currency?: string;
  };
  account: string;
  owner?: string;
  currencyDefault: string;

  meta?: {
    headers?: string[];
    hasHeader?: boolean;
    columnWidths?: Record<string, number>;  // ← NEW: persisted column widths
  };
};

export type AmountMapping =
  | { type: "single"; column: string; invertSign?: boolean }
  | { type: "debitCredit"; debitColumn?: string; creditColumn?: string }
  | {
      type: "amountWithType";
      amountColumn: string;
      typeColumn: string;
      negativeValue?: string;
      positiveValue?: string;
      invertSign?: boolean;  // ← persist flip sign for this mode too
    };
```

---

## Success Criteria

1. Map 5-column CSV in <10 seconds
2. All configuration visible without scrolling (on 13" laptop)
3. No icons/emojis — text only
4. Preview table shows computed amounts (live preview)
5. No appearing/disappearing elements (except dropdown menus)
6. Auto-detected mapping is visible and changeable via autocomplete
7. Description column order can be rearranged when multiple selected
8. Flip sign state persists per mapping
9. Column widths persist per mapping
