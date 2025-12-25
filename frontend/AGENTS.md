## Frontend Rules You MUST Follow

- Check types with `npx tsc --noEmit` in this directory after editing .ts, .tsx files.
- When rendering negative currency amounts, never show the minus sign. Use the absolute value and indicate the negative state using red text (e.g., `text-finance-expense`).
- Always read `tailwind.config.js` when creating or editing UI components to ensure consistency with the design system (colors, fonts, shadows, animations, etc.).
- When using tables, add icons (`opacity-90`, `w-3 h-3`) to headers for better scannability. Use `text-canvas-600` for small uppercase labels/metadata to ensure readability. For "Amount" columns, use `DollarSign` and ensure the header content is right-aligned (e.g., `justify-end`). The `Table` component supports `React.ReactNode` in its `header` property.
- **Snappy Multi-selects**: All dropdown filters with >5 items MUST include:
    - Search input (auto-focused on open)
    - "Select All" / "Deselect All" bulk toggles
    - "ONLY" button on item hover to quickly isolate a single selection
    - Clear typography showing current selection count (or "All selected")
    - Reference: `frontend/src/screens/Analysis/components/CategoryMultiSelect.tsx`
- **Master-Detail Sorting**: Use interactive headers (tables, card groups) instead of dedicated control rows to save space. Sortable labels must provide visual affordance (e.g., hover effects, ghost icons) to signal clickability. Reference: `frontend/src/screens/Analysis/components/GroupedTransactionList.tsx`.
