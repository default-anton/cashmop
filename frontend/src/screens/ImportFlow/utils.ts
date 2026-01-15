import { ImportMapping } from './components/ColumnMapperTypes';
import { parseCents } from '../../utils/currency';

export function parseDateLoose(value: string): Date | null {
  const v = value.trim();
  if (!v) return null;

  // ISO-ish
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Common bank formats: MM/DD/YYYY or DD/MM/YYYY
  const slash = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (slash) {
    let a = Number(slash[1]);
    let b = Number(slash[2]);
    let year = Number(slash[3]);
    if (year < 100) year += 2000;

    // If the first component can't be a month, treat as DD/MM.
    if (a > 12 && b <= 12) {
      const tmp = a;
      a = b;
      b = tmp;
    }

    const d = new Date(year, a - 1, b);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Handle "MMM DD, YYYY" or "DD MMM YYYY"
  const parsed = new Date(v);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  return null;
}

export function sampleUniqueRows<T>(
  rows: T[],
  max: number,
  keyFn: (row: T) => string = (row) => JSON.stringify(row)
): T[] {
  if (max <= 0) return [];

  const out: T[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (out.length >= max) break;
    const key = keyFn(row);
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }

  return out;
}

export function createAmountParser(mapping: ImportMapping, headers: string[]) {
  const colIdx = (col?: string) => (col ? headers.indexOf(col) : -1);
  const am = mapping.csv.amountMapping;
  const invert = am.invertSign ?? false;

  if (am.type === 'single') {
    const idx = colIdx(am.column);
    return (row: string[]) => {
      const val = idx >= 0 ? parseFloat(row[idx]?.replace(/[^0-9.-]/g, '') || '0') || 0 : 0;
      const cents = parseCents(val);
      return invert ? -cents : cents;
    };
  }

  if (am.type === 'debitCredit') {
    const debitIdx = colIdx(am.debitColumn);
    const creditIdx = colIdx(am.creditColumn);
    return (row: string[]) => {
      const debit = debitIdx >= 0 ? parseFloat(row[debitIdx]?.replace(/[^0-9.-]/g, '') || '0') || 0 : 0;
      const credit = creditIdx >= 0 ? parseFloat(row[creditIdx]?.replace(/[^0-9.-]/g, '') || '0') || 0 : 0;
      const amount = Math.abs(credit) - Math.abs(debit);
      const cents = parseCents(amount);
      return invert ? -cents : cents;
    };
  }

  if (am.type === 'amountWithType') {
    const amountIdx = colIdx(am.amountColumn);
    const typeIdx = colIdx(am.typeColumn);
    const neg = (am.negativeValue ?? 'debit').trim().toLowerCase();
    const pos = (am.positiveValue ?? 'credit').trim().toLowerCase();

    return (row: string[]) => {
      const raw = amountIdx >= 0 ? row[amountIdx] : '';
      const val = parseFloat(raw?.replace(/[^0-9.-]/g, '') || '0') || 0;
      const typeVal = typeIdx >= 0 ? (row[typeIdx] ?? '').trim().toLowerCase() : '';
      const abs = Math.abs(val);

      let amount = val;
      if (typeVal && neg && typeVal === neg) amount = -abs;
      else if (typeVal && pos && typeVal === pos) amount = abs;

      const cents = parseCents(amount);
      return invert ? -cents : cents;
    };
  }

  return () => 0;
}
