import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

import { Button } from '../../components';
import { useToast } from '../../contexts/ToastContext';
import { useCurrency } from '../../contexts/CurrencyContext';

import FileDropZone from './components/FileDropZone';
import { MappingPunchThrough } from './components/MappingPunchThrough';
import { type ImportMapping } from './components/ColumnMapperTypes';
import MonthSelector, { type MonthOption } from './components/MonthSelector';
import { createAmountParser, parseDateLoose } from './utils';

export type ParsedFile = {
  file: File;
  kind: 'csv' | 'excel';
  headers: string[];
  rows: string[][]; // rows without header
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

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const lines = normalized.split('\n');

  let firstLineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().length > 0) {
      firstLineIdx = i;
      break;
    }
  }

  if (firstLineIdx === -1) {
    throw new Error('File appears to be empty or contains only whitespace.');
  }

  const headers = parseCSVLine(lines[firstLineIdx]).filter(Boolean);
  if (headers.length === 0) {
    throw new Error('No columns detected in the first non-empty row. Ensure your CSV uses commas (,) as separators.');
  }

  const rows: string[][] = [];
  let maxColumns = headers.length;
  let skippedEmpty = 0;
  let inconsistentColumns = 0;

  for (let i = firstLineIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().length === 0) {
      skippedEmpty++;
      continue;
    }

    const row = parseCSVLine(line);
    if (row.length > maxColumns) {
      maxColumns = row.length;
      inconsistentColumns++;
    }

    const padded = row.slice(0, headers.length);
    if (padded.length < headers.length) {
      padded.push(...Array(headers.length - padded.length).fill(''));
    }

    rows.push(padded);
  }

  return { headers, rows };
}

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
    const text = await file.text();
    if (text.trim().length === 0) {
      throw new Error('File contains no readable text. Ensure it is a valid CSV file.');
    }
    const { headers, rows } = parseCSV(text);
    if (headers.length === 0) {
      throw new Error('No columns detected. Ensure your CSV uses commas (,) as separators and has a header row.');
    }
    return { file, kind: 'csv', headers, rows };
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
      return {
        file,
        kind: 'excel',
        headers: result.headers,
        rows: result.rows,
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
      return {
        file,
        kind: 'excel',
        headers: result.headers,
        rows: result.rows,
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
  const { warning } = useCurrency();
  const [step, setStep] = useState(1); // 1: Choose file(s), 2: Map, 3: Month Select, 4: Done

  const [parseBusy, setParseBusy] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [parsedFiles, setParsedFiles] = useState<ParsedFile[]>([]);
  const [fileErrors, setFileErrors] = useState<Map<string, string>>(new Map());
  const [parsed, setParsed] = useState<ParsedFile | null>(null);

  const [mapping, setMapping] = useState<ImportMapping | null>(null);
  const [months, setMonths] = useState<MonthOption[]>([]);

  const handleFilesSelected = async (files: File[]) => {
    setParseError(null);
    setParseBusy(true);
    setFileErrors(new Map());

    const parsedResults: ParsedFile[] = [];
    const errors = new Map<string, string>();

    for (const file of files) {
      try {
        const parsed = await parseFile(file);
        parsedResults.push(parsed);
      } catch (e) {
        errors.set(file.name, e instanceof Error ? e.message : 'Failed to parse file');
      }
    }

    setParsedFiles(parsedResults);
    setFileErrors(errors);

    if (parsedResults.length === 0) {
      setParseError('No files could be parsed. Check errors above.');
      setParseBusy(false);
      return;
    }

    const firstFile = parsedResults[0];
    setParsed(firstFile);

    try {
      const dbMappings: any[] = await (window as any).go.main.App.GetColumnMappings();
      const savedMappings = dbMappings.map(m => ({
        id: m.id,
        name: m.name,
        mapping: JSON.parse(m.mapping_json) as ImportMapping,
      }));

      let bestMapping: any = null;
      let maxScore = -1;

      for (const sm of savedMappings) {
        let score = 0;
        const m = sm.mapping;
        const h = firstFile.headers;

        if (h.includes(m.csv.date)) score++;
        for (const d of m.csv.description) if (h.includes(d)) score++;

        if (m.csv.amountMapping) {
          if (m.csv.amountMapping.type === 'single' && h.includes(m.csv.amountMapping.column)) score++;
          else if (m.csv.amountMapping.type === 'debitCredit') {
            if (m.csv.amountMapping.debitColumn && h.includes(m.csv.amountMapping.debitColumn)) score++;
            if (m.csv.amountMapping.creditColumn && h.includes(m.csv.amountMapping.creditColumn)) score++;
          } else if (m.csv.amountMapping.type === 'amountWithType') {
            if (h.includes(m.csv.amountMapping.amountColumn)) score++;
            if (h.includes(m.csv.amountMapping.typeColumn)) score++;
          }
        } else if (h.includes(m.csv.amount)) score++;

        if (score > maxScore) {
          maxScore = score;
          bestMapping = sm;
        }
      }

      if (bestMapping && maxScore >= 3) { // Threshold for confidence
        setMapping(bestMapping.mapping);
      }
    } catch (e) {
      console.error('Failed to auto-select mapping', e);
    }

    setStep(2);
    setParseBusy(false);
  };

  const computeMonthsFromMappingAll = (m: ImportMapping): MonthOption[] => {
    const buckets = new Map<string, { year: number; month: number; count: number }>();

    for (const pf of parsedFiles) {
      const dateHeader = m.csv.date;
      const idx = pf.headers.indexOf(dateHeader);
      if (idx === -1) continue;

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
    }

    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => {
        const label = new Date(v.year, v.month - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
        return { key, label, count: v.count };
      });
  };

  const handleMappingComplete = (m: ImportMapping) => {
    if (parsedFiles.length === 0) return;
    setMapping(m);
    const computed = computeMonthsFromMappingAll(m);
    setMonths(computed);

    setStep(3);
  };

  const normalizeTransactions = (
    mapping: ImportMapping,
    parsedFiles: ParsedFile[],
    selectedKeys: string[]
  ): any[] => {
    const out: any[] = [];
    const selectedSet = new Set(selectedKeys);

    for (const pf of parsedFiles) {
      const headers = pf.headers;
      const dateIdx = headers.indexOf(mapping.csv.date);
      const descIdxs = mapping.csv.description.map(d => headers.indexOf(d)).filter(i => i !== -1);

      const amountFn = createAmountParser(mapping, headers);

      const ownerIdx = mapping.csv.owner ? headers.indexOf(mapping.csv.owner) : -1;
      const accountIdx = mapping.csv.account ? headers.indexOf(mapping.csv.account) : -1;
      const currencyIdx = mapping.csv.currency ? headers.indexOf(mapping.csv.currency) : -1;

      for (const row of pf.rows) {
        const dStr = row[dateIdx];
        const dateObj = parseDateLoose(dStr);
        if (!dateObj) continue;

        const year = dateObj.getFullYear();
        const month = dateObj.getMonth() + 1;
        const key = `${year}-${String(month).padStart(2, '0')}`;
        if (!selectedSet.has(key)) continue;

        const desc = descIdxs.map(i => row[i]).filter(Boolean).join(' ');

        const amount = amountFn(row);

        const rawCurrency = currencyIdx !== -1 ? row[currencyIdx] : '';
        const currency = (rawCurrency || mapping.currencyDefault || '').trim().toUpperCase();

        out.push({
          date: dateObj.toISOString().split('T')[0], // YYYY-MM-DD
          description: desc,
          amount: amount,
          category: '',
          account: accountIdx !== -1 ? row[accountIdx] : mapping.account,
          owner: ownerIdx !== -1 ? row[ownerIdx] : (mapping.defaultOwner || 'Unassigned'),
          currency: currency || mapping.currencyDefault,
        });
      }
    }
    return out;
  };

  const handleMonthsComplete = async (keys: string[]) => {
    if (!mapping) return;

    const txs = normalizeTransactions(mapping, parsedFiles, keys);

    try {
      await (window as any).go.main.App.ImportTransactions(txs);

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

  return (
    <div className="min-h-screen flex flex-col items-center pt-24 pb-12 px-8 bg-canvas-100 font-sans text-canvas-800">
      <div className="w-full max-w-5xl">
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
            <FileDropZone busy={parseBusy} error={parseError} multiple={true} onFilesSelected={handleFilesSelected} />
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

        {step === 2 && (
          <MappingPunchThrough
            csvHeaders={parsed?.headers ?? []}
            rows={parsed?.rows ?? []}
            fileCount={parsedFiles.length}
            initialMapping={mapping}
            onComplete={handleMappingComplete}
          />
        )}

        {step === 3 && (
          <MonthSelector
            months={months}
            onComplete={handleMonthsComplete}
            onBack={() => setStep(2)}
            parsed={parsed}
            mapping={mapping}
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
    </div>
  );
}
