## Frontend Rules You MUST Follow

- Check types with `npx tsc --noEmit` in this directory after editing .ts, .tsx files.
- When rendering negative currency amounts, never show the minus sign. Use the absolute value and indicate the negative state using red text (e.g., `text-finance-expense`).
- Always read `tailwind.config.js` when creating or editing UI components to ensure consistency with the design system (colors, fonts, shadows, animations, etc.).
- When using tables, add subtle icons (`opacity-70`, `w-3 h-3`) to headers for better scannability. For "Amount" columns, use `DollarSign` and ensure the header content is right-aligned (e.g., `justify-end`). The `Table` component supports `React.ReactNode` in its `header` property.
