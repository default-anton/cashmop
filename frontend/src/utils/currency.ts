/**
 * Formats integer cents as a localized currency string.
 * @param cents - Amount in cents (e.g., 2000 for $20.00)
 * @param currency - Currency code (default: 'CAD')
 * @returns Formatted currency string (e.g., "$20.00")
 */
export function formatCents(cents: number | null | undefined, currency: string = "CAD"): string {
  if (cents === null || cents === undefined) return "—";
  const dollars = cents / 100;
  return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(Math.abs(dollars));
}

/**
 * Parses a currency string or number and converts to integer cents.
 * Handles common formats: "20.00", "$20.00", "20,00", etc.
 * @param value - String or number to parse
 * @returns Amount in cents (e.g., "20.00" → 2000)
 */
export function parseCents(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") {
    return Math.round(value * 100);
  }
  // Remove non-numeric characters except minus, decimal point, and comma
  const cleaned = value
    .toString()
    .replace(/[^0-9.,-]/g, "")
    .replace(",", ".");
  const dollars = parseFloat(cleaned) || 0;
  return Math.round(dollars * 100);
}

/**
 * Formats integer cents as a decimal string without currency symbol.
 * @param cents - Amount in cents (e.g., 2000)
 * @returns Formatted string (e.g., "20.00")
 */
export function formatCentsDecimal(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return (cents / 100).toFixed(2);
}
