import { parseCents } from "../../utils/currency";
import type { ImportMapping } from "./components/ColumnMapperTypes";

export type ParsedFileBase = {
  file: File;
  kind: "csv" | "excel";
  headers: string[];
  rows: string[][];
  rawRows: string[][];
  hasHeader: boolean;
  detectedHasHeader: boolean;
  headerSource: "auto";
};

export function parseDateLoose(value: string): Date | null {
  const v = value.trim();
  if (!v) return null;

  // ISO-ish (YYYY-MM-DD ...)
  // NOTE: `new Date("YYYY-MM-DD")` is parsed as UTC by JS, which can shift the
  // local calendar date (e.g. 2025-12-01 becomes Nov 30 in America/Los_Angeles).
  // For imports we treat these as *date-only* values and parse them into a local
  // date to keep month bucketing stable.
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    const d = new Date(year, month - 1, day);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Common bank formats: MM/DD/YYYY or DD/MM/YYYY
  const slash = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
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
  keyFn: (row: T) => string = (row) => JSON.stringify(row),
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

  if (am.type === "single") {
    const invert = am.invertSign ?? false;
    const idx = colIdx(am.column);
    return (row: string[]) => {
      const val = idx >= 0 ? parseFloat(row[idx]?.replace(/[^0-9.-]/g, "") || "0") || 0 : 0;
      const cents = parseCents(val);
      return invert ? -cents : cents;
    };
  }

  if (am.type === "debitCredit") {
    const debitIdx = colIdx(am.debitColumn);
    const creditIdx = colIdx(am.creditColumn);
    return (row: string[]) => {
      const debit = debitIdx >= 0 ? parseFloat(row[debitIdx]?.replace(/[^0-9.-]/g, "") || "0") || 0 : 0;
      const credit = creditIdx >= 0 ? parseFloat(row[creditIdx]?.replace(/[^0-9.-]/g, "") || "0") || 0 : 0;
      const amount = Math.abs(credit) - Math.abs(debit);
      return parseCents(amount);
    };
  }

  if (am.type === "amountWithType") {
    const amountIdx = colIdx(am.amountColumn);
    const typeIdx = colIdx(am.typeColumn);
    const neg = (am.negativeValue ?? "debit").trim().toLowerCase();
    const pos = (am.positiveValue ?? "credit").trim().toLowerCase();

    return (row: string[]) => {
      const raw = amountIdx >= 0 ? row[amountIdx] : "";
      const val = parseFloat(raw?.replace(/[^0-9.-]/g, "") || "0") || 0;
      const typeVal = typeIdx >= 0 ? (row[typeIdx] ?? "").trim().toLowerCase() : "";
      const abs = Math.abs(val);

      let amount = abs;
      if (typeVal && neg && typeVal === neg) amount = -abs;
      else if (typeVal && pos && typeVal === pos) amount = abs;

      return parseCents(amount);
    };
  }

  return () => 0;
}

const HEADER_KEYWORDS = [
  "date",
  "amount",
  "description",
  "memo",
  "payee",
  "merchant",
  "account",
  "category",
  "debit",
  "credit",
  "type",
  "currency",
  "balance",
  "value",
];

const toColumnName = (index: number) => {
  let name = "";
  let n = index;

  while (n >= 0) {
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26) - 1;
  }

  return name;
};

const buildColumnHeaders = (count: number) => Array.from({ length: count }, (_, i) => `Column ${toColumnName(i)}`);

const detectHeaderRow = (rows: string[][]) => {
  if (rows.length === 0) return false;

  const first = rows[0] ?? [];
  const second = rows[1] ?? [];

  const firstNormalized = first.map((cell) => cell.trim().toLowerCase());
  const keywordHits = firstNormalized.filter((cell) => HEADER_KEYWORDS.some((k) => cell.includes(k))).length;
  if (keywordHits > 0) return true;

  if (rows.length < 2) return false;

  const statsFor = (row: string[]) => {
    let numericCount = 0;
    let dateCount = 0;
    let textCount = 0;

    for (const raw of row) {
      const value = raw.trim();
      if (!value) continue;
      if (parseDateLoose(value)) {
        dateCount++;
        continue;
      }

      const cleaned = value.replace(/[^0-9.-]/g, "");
      if (cleaned && !Number.isNaN(Number(cleaned))) {
        numericCount++;
        continue;
      }

      textCount++;
    }

    return { numericCount, dateCount, textCount };
  };

  const firstStats = statsFor(first);
  const secondStats = statsFor(second);

  const firstDataScore = firstStats.numericCount + firstStats.dateCount;
  const secondDataScore = secondStats.numericCount + secondStats.dateCount;

  if (firstDataScore >= 2 && secondDataScore >= 1) return false;
  if (firstDataScore >= 2 && firstStats.textCount === 0) return false;

  if (secondDataScore > firstDataScore && firstStats.textCount >= secondStats.textCount) return true;
  if (firstDataScore === 0 && secondDataScore >= 1) return true;

  return true;
};

const normalizeRows = (rows: string[][], width: number) =>
  rows.map((row) => {
    const trimmed = row.slice(0, width);
    if (trimmed.length < width) {
      trimmed.push(...Array(width - trimmed.length).fill(""));
    }
    return trimmed;
  });

const buildParsedRows = (rawRows: string[][], hasHeader: boolean) => {
  const maxColumns = rawRows.reduce((max, row) => Math.max(max, row.length), 0);
  if (maxColumns === 0) {
    return { headers: [], rows: [] as string[][] };
  }

  if (!hasHeader) {
    const headers = buildColumnHeaders(maxColumns);
    return { headers, rows: normalizeRows(rawRows, headers.length) };
  }

  const headerRow = rawRows[0] ?? [];
  const headerCount = Math.max(headerRow.length, maxColumns);
  const headers = Array.from({ length: headerCount }, (_, i) => {
    const raw = headerRow[i]?.trim() ?? "";
    return raw || `Column ${toColumnName(i)}`;
  });

  const rows = normalizeRows(rawRows.slice(1), headers.length);
  return { headers, rows };
};

function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }

    cur += ch;
  }

  out.push(cur.trim());
  return out;
}

function parseCSV(text: string): {
  headers: string[];
  rows: string[][];
  rawRows: string[][];
  detectedHasHeader: boolean;
  hasHeader: boolean;
} {
  const normalized = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  const lines = normalized.split("\n");
  const rawRows = lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => parseCSVLine(line));

  if (rawRows.length === 0) {
    throw new Error("File appears to be empty or contains only whitespace.");
  }

  const maxColumns = rawRows.reduce((max, row) => Math.max(max, row.length), 0);
  let detectedHasHeader = detectHeaderRow(rawRows);
  let hasHeader = detectedHasHeader;
  let { headers, rows } = buildParsedRows(rawRows, hasHeader);

  if (headers.length === 0 && maxColumns > 0) {
    headers = buildColumnHeaders(maxColumns);
    rows = normalizeRows(rawRows, headers.length);
    detectedHasHeader = false;
    hasHeader = false;
  }

  if (headers.length === 0) {
    throw new Error("No columns detected in the file. Ensure your CSV uses commas (,) as separators.");
  }

  return { headers, rows, rawRows, detectedHasHeader, hasHeader };
}

const readFileText = async (file: File) => {
  const withTimeout = <T>(promise: Promise<T>, ms: number, label: string) =>
    new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
      promise
        .then((val) => {
          clearTimeout(timer);
          resolve(val);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });

  const readWithFileReader = () =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });

  try {
    return await withTimeout(readWithFileReader(), 5000, "FileReader");
  } catch (err) {
    console.warn("FileReader failed, falling back to file.text()", err);
  }

  return await withTimeout(file.text(), 5000, "file.text");
};

// File type detection by content signature
type FileTypeByContent = "csv" | "xlsx" | "xls" | "binary" | "unknown";

async function detectFileTypeByContent(file: File): Promise<FileTypeByContent> {
  const reader = new FileReader();
  const signaturePromise = new Promise<Uint8Array>((resolve, reject) => {
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = reject;
    reader.readAsArrayBuffer(file.slice(0, 8));
  });

  const bytes = await signaturePromise;

  // XLSX: ZIP signature "PK\x03\x04"
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return "xlsx";
  }

  // XLS: OLE2 signature D0 CF 11 E0
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) {
    return "xls";
  }

  // Check if it's text (printable ASCII/UTF-8) - likely CSV
  let printableCount = 0;
  for (let i = 0; i < Math.min(bytes.length, 8); i++) {
    const b = bytes[i];
    // printable ASCII, tab, newline, carriage return, or UTF-8 continuation byte
    if ((b >= 0x20 && b < 0x7f) || b === 0x09 || b === 0x0a || b === 0x0d || b >= 0x80) {
      printableCount++;
    }
  }

  // If mostly printable, likely CSV/TXT
  if (printableCount >= 6) {
    return "csv";
  }

  return "binary";
}

// Parses Excel file (XLSX or XLS) by reading as base64 and calling backend parser
async function parseExcelFile(file: File): Promise<ParsedFileBase> {
  const reader = new FileReader();
  const base64Promise = new Promise<string>((resolve, reject) => {
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  try {
    const base64Data = await base64Promise;
    const result = await (window as any).go.main.App.ParseExcel(base64Data);
    const rawRows: string[][] = Array.isArray(result?.allRows)
      ? result.allRows
      : [result?.headers ?? [], ...(result?.rows ?? [])];
    if (rawRows.length === 0) {
      throw new Error("The Excel file is empty. Please choose a file with data.");
    }

    const detectedHasHeader = detectHeaderRow(rawRows);
    const hasHeader = detectedHasHeader;
    const { headers, rows } = buildParsedRows(rawRows, hasHeader);

    return {
      file,
      kind: "excel",
      headers,
      rows,
      rawRows,
      hasHeader,
      detectedHasHeader,
      headerSource: "auto",
    };
  } catch {
    throw new Error("Unable to read the Excel file. Please check if it's corrupted or password-protected.");
  }
}

export async function parseFile(file: File): Promise<ParsedFileBase> {
  const name = file.name.toLowerCase();
  if (file.size === 0) {
    throw new Error("File is empty (0 bytes). Please select a valid CSV or Excel export.");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("File exceeds 10 MB limit. Please split large exports into smaller files.");
  }

  const contentType = await detectFileTypeByContent(file);
  const ext = name.endsWith(".csv") ? ".csv" : name.endsWith(".xlsx") ? ".xlsx" : name.endsWith(".xls") ? ".xls" : null;

  // CSV path - by extension OR by content
  if (ext === ".csv" || contentType === "csv") {
    const text = await readFileText(file);
    if (text.trim().length === 0) {
      throw new Error("File contains no readable text. Ensure it is a valid CSV file.");
    }
    const { headers, rows, rawRows, detectedHasHeader, hasHeader } = parseCSV(text);
    return {
      file,
      kind: "csv",
      headers,
      rows,
      rawRows,
      hasHeader,
      detectedHasHeader,
      headerSource: "auto",
    };
  }

  // XLSX path - only if content matches
  if (ext === ".xlsx" || contentType === "xlsx") {
    if (contentType !== "xlsx") {
      throw new Error("This doesn't look like a valid Excel file. Please check the file format.");
    }
    return parseExcelFile(file);
  }

  // XLS path - only if content matches
  if (ext === ".xls" || contentType === "xls") {
    if (contentType !== "xls") {
      throw new Error("This doesn't look like a valid .xls file. Try saving it as .xlsx instead.");
    }
    return parseExcelFile(file);
  }

  throw new Error("Unsupported file type. Please upload a .csv, .xlsx, or .xls file.");
}
