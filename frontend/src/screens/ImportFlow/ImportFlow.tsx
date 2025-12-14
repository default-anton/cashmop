import React, { useMemo, useState } from 'react';
import { Upload, Table, Calendar, Check, CheckCircle2 } from 'lucide-react';

import FileDropZone from './components/FileDropZone';
import ColumnMapper, { type ImportMapping } from './components/ColumnMapper';
import MonthSelector, { type MonthOption } from './components/MonthSelector';
import ImportConfirmation from './components/ImportConfirmation';

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
  // Remove BOM and normalize line endings
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Split lines, preserving empty lines for error detection
  const lines = normalized.split('\n');
  
  // Find first non-empty line for header detection (skip leading empty lines)
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
  
  // Parse headers from first non-empty line
  const headers = parseCSVLine(lines[firstLineIdx]).filter(Boolean);
  if (headers.length === 0) {
    throw new Error('No columns detected in the first non-empty row. Ensure your CSV uses commas (,) as separators.');
  }
  
  // Process remaining lines (skip empty lines but keep track)
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
    
    // Ensure each row has exactly headers.length columns (pad or truncate)
    const padded = row.slice(0, headers.length);
    if (padded.length < headers.length) {
      padded.push(...Array(headers.length - padded.length).fill(''));
    }
    
    rows.push(padded);
  }
  
  // Warn about inconsistencies (could be logged)
  if (inconsistentColumns > 0) {
    console.warn(`${inconsistentColumns} rows have more columns than headers. Extra columns were truncated.`);
  }
  if (skippedEmpty > 0) {
    console.warn(`Skipped ${skippedEmpty} empty lines.`);
  }
  
  // Ensure we have at least one data row (optional)
  if (rows.length === 0) {
    console.warn('No data rows found after header.');
  }
  
  return { headers, rows };
}

function parseDateLoose(value: string): Date | null {
  const v = value.trim();
  if (!v) return null;

  // ISO-ish
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Common bank formats: MM/DD/YYYY or DD/MM/YYYY
  const slash = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    let a = Number(slash[1]);
    let b = Number(slash[2]);
    const year = Number(slash[3]);

    // If the first component can't be a month, treat as DD/MM.
    if (a > 12 && b <= 12) {
      const tmp = a;
      a = b;
      b = tmp;
    }

    const d = new Date(year, a - 1, b);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const parsed = new Date(v);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function parseFile(file: File): Promise<ParsedFile> {
  const name = file.name.toLowerCase();
  // Basic file validation
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
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    // Placeholder: Excel parsing will be added later.
    const headers = ['Transaction Date', 'Posting Date', 'Description 1', 'Debit', 'Credit', 'Card Member'];
    const rows: string[][] = [];
    return { file, kind: 'excel', headers, rows };
  }
  throw new Error('Unsupported file type. Please upload a .csv or .xlsx file.');
}

export default function ImportFlow() {
  const [step, setStep] = useState(1); // 1: Upload, 2: Map, 3: Month Select, 4: Confirm

  const [parseBusy, setParseBusy] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [parsedFiles, setParsedFiles] = useState<ParsedFile[]>([]);
  const [fileErrors, setFileErrors] = useState<Map<string, string>>(new Map());
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [excelMock, setExcelMock] = useState(false);

  const [mapping, setMapping] = useState<ImportMapping | null>(null);
  const [months, setMonths] = useState<MonthOption[]>([]);
  const [selectedMonthKeys, setSelectedMonthKeys] = useState<string[]>([]);

  const selectedMonths = useMemo(() => {
    const selected = new Set(selectedMonthKeys);
    return months.filter((m) => selected.has(m.key));
  }, [months, selectedMonthKeys]);

  const totalTransactionsAllFiles = useMemo(() => {
    return parsedFiles.reduce((acc, pf) => acc + pf.rows.length, 0);
  }, [parsedFiles]);

  const totalSelectedTxns = useMemo(() => {
    return selectedMonths.reduce((acc, m) => acc + m.count, 0);
  }, [selectedMonths]);

  const steps = [
    { id: 1, label: 'Upload File', icon: Upload },
    { id: 2, label: 'Map Columns', icon: Table },
    { id: 3, label: 'Select Range', icon: Calendar },
    { id: 4, label: 'Confirm', icon: CheckCircle2 },
  ];

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

    // Use first file for mapping
    setParsed(parsedResults[0]);
    setExcelMock(parsedResults[0].kind === 'excel');
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
    setSelectedMonthKeys([]);
    setStep(3);
  };

  const handleMonthsComplete = (keys: string[]) => {
    setSelectedMonthKeys(keys);
    setStep(4);
  };

  const handleConfirm = () => {
    if (parsedFiles.length === 0 || !mapping) return;

    console.log('Import Started', {
      files: parsedFiles.map(pf => pf.file.name),
      mapping,
      months: selectedMonths,
      totalSelectedTxns,
      totalTransactionsAllFiles,
    });
  };

  return (
    <div className="min-h-screen bg-canvas-100 texture-delight flex items-center justify-center p-8 font-sans text-canvas-800">
      <div className="w-full max-w-4xl">
        <div className="mb-12">
          <div className="flex items-center justify-between relative px-8">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-canvas-200 rounded-full -z-10" />
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-brand transition-all duration-500 rounded-full -z-10"
              style={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }}
            />

            {steps.map((s) => {
              const isActive = step === s.id;
              const isCompleted = step > s.id;
              const Icon = isCompleted ? Check : s.icon;

              return (
                <div key={s.id} className="flex flex-col items-center gap-2 bg-canvas-100 px-2">
                  <div
                    className={
                      'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ' +
                      (isActive
                        ? 'border-brand bg-brand/10 text-brand shadow-[0_0_15px_rgba(13,148,136,0.5)] scale-110'
                        : isCompleted
                          ? 'border-finance-income bg-finance-income text-canvas-800 scale-100'
                          : 'border-canvas-200 bg-canvas-50 text-canvas-600')
                    }
                  >
                    <Icon className="w-5 h-5" strokeWidth={isCompleted ? 3 : 2} />
                  </div>

                  <span
                    className={
                      'text-xs font-bold tracking-wider uppercase transition-colors duration-300 absolute -bottom-8 ' +
                      (isActive ? 'text-canvas-800' : 'text-canvas-600')
                    }
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-canvas-50/30 border border-canvas-200/50 rounded-2xl p-8 backdrop-blur-sm shadow-card hover:scale-[1.01] hover:shadow-card-hover transition-all duration-200">
          {step === 1 && (
            <>
              <FileDropZone busy={parseBusy} error={parseError} multiple={true} onFilesSelected={handleFilesSelected} />
              {fileErrors.size > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-semibold text-finance-expense mb-2">File Errors</h4>
                  <div className="space-y-2">
                    {Array.from(fileErrors.entries()).map(([fileName, error]) => (
                      <div key={fileName} className="text-xs text-canvas-600 bg-canvas-300/60 border border-canvas-400 rounded-lg px-3 py-2">
                        <span className="font-mono">{fileName}</span>: {error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <ColumnMapper
              csvHeaders={parsed?.headers ?? []}
              excelMock={excelMock}
              fileCount={parsedFiles.length}
              onComplete={handleMappingComplete}
            />
          )}

          {step === 3 && <MonthSelector months={months} onComplete={handleMonthsComplete} />}

          {step === 4 && parsed && mapping && (
            <ImportConfirmation
              fileName={parsedFiles.length === 1 ? parsedFiles[0].file.name : `${parsedFiles.length} files`}
              totalTransactions={totalTransactionsAllFiles}
              selectedMonths={selectedMonths}
              mapping={mapping}
              parsed={parsed}
              onBack={() => setStep(3)}
              onConfirm={handleConfirm}
            />
          )}
        </div>
      </div>
    </div>
  );
}
