import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

import { Button, ScreenLayout } from '@/components';
import { useToast } from '@/contexts/ToastContext';
import { useCurrency } from '@/contexts/CurrencyContext';

import FileDropZone from './components/FileDropZone';
import { MappingPunchThrough } from './components/MappingPunchThrough';
import { type ImportMapping, type SavedMapping } from './components/ColumnMapperTypes';
import MonthSelector, { type MonthOption } from './components/MonthSelector';
import { createAmountParser, parseDateLoose } from './utils';
import { pickBestMapping, uniqueSortedNormalizedHeaders } from './mappingDetection';

export type ParsedFile = {
  file: File;
  kind: 'csv' | 'excel';
  headers: string[];
  rows: string[][]; // rows without header
  rawRows: string[][];
  hasHeader: boolean;
  detectedHasHeader: boolean;
  headerSource: 'auto' | 'manual';
  mapping?: ImportMapping;
  autoMatchedMappingId?: number;
  autoMatchedMappingName?: string;
  selectedMonths?: string[];
};

const HEADER_KEYWORDS = [
  'date',
  'amount',
  'description',
  'memo',
  'payee',
  'merchant',
  'account',
  'category',
  'debit',
  'credit',
  'type',
  'currency',
  'balance',
  'value',
];

const toColumnName = (index: number) => {
  let name = '';
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

      const cleaned = value.replace(/[^0-9.-]/g, '');
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
      trimmed.push(...Array(width - trimmed.length).fill(''));
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
    const raw = headerRow[i]?.trim() ?? '';
    return raw || `Column ${toColumnName(i)}`;
  });

  const rows = normalizeRows(rawRows.slice(1), headers.length);
  return { headers, rows };
};

function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
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

    if (ch === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
      continue;
    }

    cur += ch;
  }

  out.push(cur.trim());
  return out;
}

function parseCSV(
  text: string
): { headers: string[]; rows: string[][]; rawRows: string[][]; detectedHasHeader: boolean; hasHeader: boolean } {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const lines = normalized.split('\n');
  const rawRows = lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => parseCSVLine(line));

  if (rawRows.length === 0) {
    throw new Error('File appears to be empty or contains only whitespace.');
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
    throw new Error('No columns detected in the file. Ensure your CSV uses commas (,) as separators.');
  }

  return { headers, rows, rawRows, detectedHasHeader, hasHeader };
}

const readFileText = async (file: File) => {
  const withTimeout = <T,>(promise: Promise<T>, ms: number, label: string) =>
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

  const readWithFileReader = () => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });

  try {
    return await withTimeout(readWithFileReader(), 5000, 'FileReader');
  } catch (err) {
    console.warn('FileReader failed, falling back to file.text()', err);
  }

  return await withTimeout(file.text(), 5000, 'file.text');
};

// Validates file signature to detect file type mismatches
async function validateFileSignature(file: File, expectedExtension: string): Promise<void> {
  const reader = new FileReader();
  const signaturePromise = new Promise<Uint8Array>((resolve, reject) => {
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = reject;
    reader.readAsArrayBuffer(file.slice(0, 8));
  });

  const bytes = await signaturePromise;

  if (expectedExtension === '.xlsx') {
    // XLSX files are ZIP archives: signature is "PK\x03\x04"
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4B || bytes[2] !== 0x03 || bytes[3] !== 0x04) {
      throw new Error('This doesn\'t look like a valid Excel file. Please check the file format.');
    }
  } else if (expectedExtension === '.xls') {
    // XLS files use OLE2 compound document storage: signature is D0 CF 11 E0 A0 B1 1A E1
    const ole2Signature = [0xD0, 0xCF, 0x11, 0xE0, 0xA0, 0xB1, 0x1A, 0xE1];
    for (let i = 0; i < 8; i++) {
      if (bytes[i] !== ole2Signature[i]) {
        throw new Error('This doesn\'t look like a valid .xls file. Try saving it as .xlsx instead.');
      }
    }
  }
}

async function parseFile(file: File): Promise<ParsedFile> {
  const name = file.name.toLowerCase();
  if (file.size === 0) {
    throw new Error('File is empty (0 bytes). Please select a valid CSV or Excel export.');
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('File exceeds 10 MB limit. Please split large exports into smaller files.');
  }
  if (name.endsWith('.csv')) {
    const text = await readFileText(file);
    if (text.trim().length === 0) {
      throw new Error('File contains no readable text. Ensure it is a valid CSV file.');
    }
    const { headers, rows, rawRows, detectedHasHeader, hasHeader } = parseCSV(text);
    return {
      file,
      kind: 'csv',
      headers,
      rows,
      rawRows,
      hasHeader,
      detectedHasHeader,
      headerSource: 'auto',
    };
  }
  if (name.endsWith('.xlsx')) {
    await validateFileSignature(file, '.xlsx');
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
        throw new Error('The Excel file is empty. Please choose a file with data.');
      }

      const detectedHasHeader = detectHeaderRow(rawRows);
      const hasHeader = detectedHasHeader;
      const { headers, rows } = buildParsedRows(rawRows, hasHeader);

      return {
        file,
        kind: 'excel',
        headers,
        rows,
        rawRows,
        hasHeader,
        detectedHasHeader,
        headerSource: 'auto',
      };
    } catch (e) {
      throw new Error('Unable to read the Excel file. Please check if it\'s corrupted or password-protected.');
    }
  }
  if (name.endsWith('.xls')) {
    await validateFileSignature(file, '.xls');
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
        throw new Error('The Excel file is empty. Please choose a file with data.');
      }

      const detectedHasHeader = detectHeaderRow(rawRows);
      const hasHeader = detectedHasHeader;
      const { headers, rows } = buildParsedRows(rawRows, hasHeader);

      return {
        file,
        kind: 'excel',
        headers,
        rows,
        rawRows,
        hasHeader,
        detectedHasHeader,
        headerSource: 'auto',
      };
    } catch (e) {
      throw new Error('Unable to read the Excel file. Please check if it\'s corrupted or password-protected.');
    }
  }
  throw new Error('Unsupported file type. Please upload a .csv or .xlsx file.');
}

interface ImportFlowProps {
  onImportComplete?: () => void;
}

export default function ImportFlow({ onImportComplete }: ImportFlowProps) {
  const toast = useToast();
  const { warning, refresh } = useCurrency();
  const [step, setStep] = useState(1); // 1: Choose file(s), 2: Map, 3: Month Select, 4: Done

  const [parseBusy, setParseBusy] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [parsedFiles, setParsedFiles] = useState<ParsedFile[]>([]);
  const [fileErrors, setFileErrors] = useState<Map<string, string>>(new Map());
  const [currentFileIdx, setCurrentFileIdx] = useState(0);

  const [mapping, setMapping] = useState<ImportMapping | null>(null);
  const [months, setMonths] = useState<MonthOption[]>([]);
  const [savedMappings, setSavedMappings] = useState<SavedMapping[]>([]);

  const currentFile = parsedFiles[currentFileIdx] ?? null;
  const isLastFile = currentFileIdx >= parsedFiles.length - 1;

  useEffect(() => {
    if (step !== 1) return;
    if (parsedFiles.length === 0) return;
    setStep(2);
  }, [parsedFiles.length, step]);


  const resolveMappingForFile = (file: ParsedFile | null, entries: SavedMapping[]) => {
    if (!file) return null;
    if (file.mapping) return file.mapping;
    const picked = pickBestMapping(file, entries);
    return picked?.mapping ?? null;
  };

  useEffect(() => {
    if (!currentFile) {
      setMapping(null);
      return;
    }

    const nextMapping = resolveMappingForFile(currentFile, savedMappings);
    setMapping(nextMapping);
  }, [currentFileIdx, currentFile?.headers, currentFile?.hasHeader, currentFile?.headerSource, savedMappings]);


  const loadMappings = async (): Promise<SavedMapping[]> => {
    try {
      const dbMappings: any[] = await (window as any).go.main.App.GetColumnMappings();

      const loaded: SavedMapping[] = [];
      for (const m of dbMappings) {
        try {
          const parsed = JSON.parse(m.mapping_json);
          if (!parsed?.csv?.amountMapping) continue;
          loaded.push({
            id: m.id,
            name: m.name,
            mapping: parsed as ImportMapping,
          });
        } catch (e) {
          console.warn(`Skipping invalid saved mapping: ${m?.name ?? m?.id ?? 'unknown'}`, e);
        }
      }

      setSavedMappings(loaded);
      return loaded;
    } catch (e) {
      console.error('Failed to load saved mappings', e);
      return [];
    }
  };

  const applyAutoMappings = (files: ParsedFile[], entries: SavedMapping[]) =>
    files.map((pf) => {
      if (pf.mapping) return pf;
      const picked = pickBestMapping(pf, entries);
      if (!picked) return pf;
      return {
        ...pf,
        mapping: picked.mapping,
        autoMatchedMappingId: picked.id,
        autoMatchedMappingName: picked.name,
      };
    });

  const suggestMappingName = (file: ParsedFile) => {
    const base = file.file.name.replace(/\.[^.]+$/, '');
    const cleaned = base
      .replace(/[_-]+/g, ' ')
      .replace(/\b\d{4}[-_]\d{2}([-_]\d{2})?\b/g, '')
      .replace(/\b\d{1,2}[-_]\d{1,2}[-_]\d{2,4}\b/g, '')
      .replace(/\b\d{4}\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned || base.trim() || 'Import mapping';
  };

  const saveMapping = async (name: string, m: ImportMapping, source: { headers: string[]; hasHeader: boolean }) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const mappingWithMeta: ImportMapping = {
      ...m,
      meta: {
        ...(m.meta ?? {}),
        headers: uniqueSortedNormalizedHeaders(source.headers),
        hasHeader: source.hasHeader,
      },
    };

    await (window as any).go.main.App.SaveColumnMapping(trimmed, mappingWithMeta);

    const loaded = await loadMappings();
    setParsedFiles((prev) => applyAutoMappings(prev, loaded));
  };

  const handleFilesSelected = async (files: File[]) => {
    setParseError(null);
    setParseBusy(true);
    setFileErrors(new Map());

    const parsedResults: ParsedFile[] = [];
    const errors = new Map<string, string>();

    try {
      for (const file of files) {
        try {
          const parsed = await parseFile(file);
          parsedResults.push(parsed);
        } catch (e) {
          errors.set(file.name, e instanceof Error ? e.message : 'Failed to parse file');
        }
      }

      setFileErrors(errors);

      if (parsedResults.length === 0) {
        setParsedFiles([]);
        setParseError('No files could be parsed. Check errors above.');
        return [] as ParsedFile[];
      }

      setCurrentFileIdx(0);
      setMonths([]);

      const loadedMappings = await loadMappings();
      const withAuto = applyAutoMappings(parsedResults, loadedMappings);
      setParsedFiles(withAuto);

      return withAuto;
    } finally {
      setParseBusy(false);
    }
  };

  const computeMonthsFromMapping = (m: ImportMapping, pf: ParsedFile): MonthOption[] => {
    const buckets = new Map<string, { year: number; month: number; count: number }>();

    const dateHeader = m.csv.date;
    const idx = pf.headers.indexOf(dateHeader);
    if (idx === -1) return [];

    for (const row of pf.rows) {
      const d = parseDateLoose(row[idx] ?? '');
      if (!d) continue;

      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const key = `${year}-${String(month).padStart(2, '0')}`;

      const cur = buckets.get(key);
      if (cur) cur.count += 1;
      else buckets.set(key, { year, month, count: 1 });
    }

    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => {
        const label = new Date(v.year, v.month - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
        return { key, label, count: v.count };
      });
  };

  const handleMappingComplete = (m: ImportMapping) => {
    if (!currentFile) return;

    setParsedFiles((prev) => {
      const next = [...prev];
      next[currentFileIdx] = { ...next[currentFileIdx], mapping: m };
      return next;
    });

    setMapping(m);
    const computed = computeMonthsFromMapping(m, currentFile);
    setMonths(computed);

    setStep(3);
  };

  const rebuildFileHeaders = (file: ParsedFile, hasHeader: boolean, source: 'auto' | 'manual') => {
    const { headers, rows } = buildParsedRows(file.rawRows, hasHeader);
    return {
      ...file,
      headers,
      rows,
      hasHeader,
      headerSource: source,
      mapping: undefined,
      autoMatchedMappingId: undefined,
      autoMatchedMappingName: undefined,
      selectedMonths: undefined,
    };
  };

  const handleHeaderSettingChange = (hasHeader: boolean) => {
    if (!currentFile || currentFile.hasHeader === hasHeader) return;

    setParsedFiles((prev) => {
      const next = [...prev];
      next[currentFileIdx] = rebuildFileHeaders(next[currentFileIdx], hasHeader, 'manual');
      return next;
    });

    setMapping(null);
  };

  const normalizeTransactions = (files: ParsedFile[]): any[] => {
    const out: any[] = [];

    for (const pf of files) {
      const activeMapping = pf.mapping;
      if (!activeMapping || !pf.selectedMonths || pf.selectedMonths.length === 0) continue;

      const selectedSet = new Set(pf.selectedMonths);
      const headers = pf.headers;
      const dateIdx = headers.indexOf(activeMapping.csv.date);
      const descIdxs = activeMapping.csv.description.map((d) => headers.indexOf(d)).filter((i) => i !== -1);

      const amountFn = createAmountParser(activeMapping, headers);

      const ownerIdx = activeMapping.csv.owner ? headers.indexOf(activeMapping.csv.owner) : -1;
      const accountIdx = activeMapping.csv.account ? headers.indexOf(activeMapping.csv.account) : -1;
      const currencyIdx = activeMapping.csv.currency ? headers.indexOf(activeMapping.csv.currency) : -1;

      for (const row of pf.rows) {
        const dStr = row[dateIdx];
        const dateObj = parseDateLoose(dStr ?? '');
        if (!dateObj) continue;

        const year = dateObj.getFullYear();
        const month = dateObj.getMonth() + 1;
        const key = `${year}-${String(month).padStart(2, '0')}`;
        if (!selectedSet.has(key)) continue;

        const desc = descIdxs.map((i) => row[i]).filter(Boolean).join(' ');

        const amount = amountFn(row);

        const rawCurrency = currencyIdx !== -1 ? row[currencyIdx] : '';
        const currency = (rawCurrency || activeMapping.currencyDefault || '').trim().toUpperCase();

        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');

        out.push({
          date: `${y}-${m}-${day}`, // YYYY-MM-DD (local date)
          description: desc,
          amount: amount,
          category: '',
          account: accountIdx !== -1 ? row[accountIdx] : activeMapping.account,
          owner: ownerIdx !== -1 ? row[ownerIdx] : (activeMapping.defaultOwner || 'Unassigned'),
          currency: currency || activeMapping.currencyDefault,
        });
      }
    }

    return out;
  };

  const handleMonthsComplete = async (keys: string[]) => {
    if (!currentFile) return;

    const updatedFiles = parsedFiles.map((pf, idx) => {
      if (idx !== currentFileIdx) return pf;
      return {
        ...pf,
        selectedMonths: keys,
        mapping: mapping ?? pf.mapping,
      };
    });

    if (!isLastFile) {
      setParsedFiles(updatedFiles);
      const nextIdx = currentFileIdx + 1;
      setCurrentFileIdx(nextIdx);
      setMonths([]);
      setStep(2);
      return;
    }

    setParsedFiles(updatedFiles);
    if (!mapping) return;

    const txs = normalizeTransactions(updatedFiles);

    try {
      await (window as any).go.main.App.ImportTransactions(txs);
      await refresh();

      setStep(4);
      if (onImportComplete) {
        onImportComplete();
      }
    } catch (e) {
      console.error(e);
      const errorMsg = e instanceof Error ? e.message : String(e);
      toast.showToast(`Unable to import transactions: ${errorMsg}. Please check your file format and try again.`, 'error');
    }
  };

  const primaryActionLabel = isLastFile ? 'Start Import' : 'Map Next File';

  return (
    <ScreenLayout size="wide">
      <div className="font-sans text-canvas-800">
        {warning && (
          <div className={`mb-6 flex items-start gap-3 rounded-xl border px-4 py-3 ${
            warning.tone === 'error'
              ? 'bg-finance-expense/10 border-finance-expense/20 text-finance-expense'
              : 'bg-yellow-100 border-yellow-300 text-yellow-800'
          }`}>
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div className="select-none">
              <p className="text-sm font-semibold select-none">{warning.title}</p>
              <p className="text-sm select-none">{warning.detail}</p>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="bg-canvas-50/30 border border-canvas-200/50 rounded-2xl p-8 backdrop-blur-sm shadow-card">
            <h2 className="text-2xl font-bold mb-6 text-center select-none">Import Transactions</h2>
            <FileDropZone
              busy={parseBusy}
              error={parseError}
              multiple={true}
              onFileSelected={(file) => handleFilesSelected([file])}
              onFilesSelected={handleFilesSelected}
            />
            {fileErrors.size > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-semibold text-finance-expense mb-2 select-none">File Errors</h4>
                <div className="space-y-2">
                  {Array.from(fileErrors.entries()).map(([fileName, error]) => (
                    <div key={fileName} className="text-xs text-canvas-600 bg-canvas-300/60 border border-canvas-400 rounded-lg px-3 py-2 select-none">
                      <span className="font-mono select-none">{fileName}</span>: {error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && currentFile && (
          <MappingPunchThrough
            csvHeaders={currentFile.headers}
            rows={currentFile.rows}
            fileCount={parsedFiles.length}
            fileIndex={currentFileIdx}
            hasHeader={currentFile.hasHeader}
            detectedHasHeader={currentFile.detectedHasHeader}
            headerSource={currentFile.headerSource}
            onHeaderChange={handleHeaderSettingChange}
            initialMapping={mapping}
            detectedMappingName={currentFile.autoMatchedMappingName}
            suggestedSaveName={suggestMappingName(currentFile)}
            onSaveMapping={saveMapping}
            onComplete={handleMappingComplete}
          />
        )}

        {step === 2 && !currentFile && (
          <div className="bg-canvas-50/30 border border-canvas-200/50 rounded-2xl p-8 backdrop-blur-sm shadow-card flex flex-col items-center justify-center py-12 animate-snap-in">
            <div className="w-12 h-12 bg-brand/10 rounded-full flex items-center justify-center mb-4 text-brand animate-pulse">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-canvas-800 mb-2 select-none">Preparing your file</h2>
            <p className="text-canvas-500 text-center max-w-md select-none">
              Parsing columns and sample rows...
            </p>
          </div>
        )}

        {step === 3 && (
          <MonthSelector
            months={months}
            onComplete={handleMonthsComplete}
            onBack={() => setStep(2)}
            parsed={currentFile}
            mapping={mapping}
            fileIndex={currentFileIdx}
            fileCount={parsedFiles.length}
            primaryActionLabel={primaryActionLabel}
          />
        )}

        {step === 4 && (
          <div className="bg-canvas-50/30 border border-canvas-200/50 rounded-2xl p-8 backdrop-blur-sm shadow-card flex flex-col items-center justify-center py-12 animate-snap-in">
            <div className="w-20 h-20 bg-finance-income/10 rounded-full flex items-center justify-center mb-6 text-finance-income">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-3xl font-bold text-canvas-800 mb-2 select-none">Import Complete!</h2>
            <p className="text-canvas-500 text-center max-w-md select-none">
              Your transactions have been successfully imported.
            </p>
            <Button
              onClick={() => setStep(1)}
              variant="primary"
              className="mt-8"
            >
              Import More
            </Button>
          </div>
        )}
      </div>
    </ScreenLayout>
  );
}
