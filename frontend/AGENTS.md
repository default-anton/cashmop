## Frontend Rules You MUST Follow

- Check types with `npx tsc --noEmit` in this directory after editing .ts, .tsx files.
- When rendering negative currency amounts, never show the minus sign. Use the absolute value and indicate the negative state using red text (e.g., `text-finance-expense`).
- Always read `tailwind.config.js` when creating or editing UI components to ensure consistency with the design system (colors, fonts, shadows, animations, etc.).
