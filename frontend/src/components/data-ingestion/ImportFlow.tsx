import React, { useMemo, useState } from 'react';
import { Upload, Table, Calendar, Check, CheckCircle2 } from 'lucide-react';

import FileDropZone from './FileDropZone';
import ColumnMapper, { type ImportMapping } from './ColumnMapper';
import MonthSelector, { type MonthOption } from './MonthSelector';
import ImportConfirmation from './ImportConfirmation';

type ParsedFile = {
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
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseCSVLine(lines[0]).filter(Boolean);
  const rows = lines.slice(1).map(parseCSVLine).map((r) => {
    if (headers.length === 0) return r;
    if (r.length < headers.length) return [...r, ...Array(headers.length - r.length).fill('')];
    return r.slice(0, headers.length);
  });

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

function computeMonthsFromMapping(parsed: ParsedFile, mapping: ImportMapping): MonthOption[] {
  const dateHeader = mapping.csv.date;
  const idx = parsed.headers.indexOf(dateHeader);
  if (idx === -1) return [];

  const buckets = new Map<string, { year: number; month: number; count: number }>();

  for (const row of parsed.rows) {
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
}

export default function ImportFlow() {
  const [step, setStep] = useState(1); // 1: Upload, 2: Map, 3: Month Select, 4: Confirm

  const [parseBusy, setParseBusy] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [excelMock, setExcelMock] = useState(false);

  const [mapping, setMapping] = useState<ImportMapping | null>(null);
  const [months, setMonths] = useState<MonthOption[]>([]);
  const [selectedMonthKeys, setSelectedMonthKeys] = useState<string[]>([]);

  const selectedMonths = useMemo(() => {
    const selected = new Set(selectedMonthKeys);
    return months.filter((m) => selected.has(m.key));
  }, [months, selectedMonthKeys]);

  const totalSelectedTxns = useMemo(() => {
    return selectedMonths.reduce((acc, m) => acc + m.count, 0);
  }, [selectedMonths]);

  const steps = [
    { id: 1, label: 'Upload File', icon: Upload },
    { id: 2, label: 'Map Columns', icon: Table },
    { id: 3, label: 'Select Range', icon: Calendar },
    { id: 4, label: 'Confirm', icon: CheckCircle2 },
  ];

  const handleFileSelected = async (file: File) => {
    setParseError(null);
    setParseBusy(true);

    try {
      const name = file.name.toLowerCase();

      if (name.endsWith('.csv')) {
        const text = await file.text();
        const { headers, rows } = parseCSV(text);
        if (headers.length === 0) throw new Error('No headers detected. Is this a valid CSV export?');

        setParsed({ file, kind: 'csv', headers, rows });
        setExcelMock(false);
        setStep(2);
        return;
      }

      if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        // Placeholder: Excel parsing will be added later.
        const headers = ['Transaction Date', 'Posting Date', 'Description 1', 'Debit', 'Credit', 'Card Member'];
        const rows: string[][] = [];

        setParsed({ file, kind: 'excel', headers, rows });
        setExcelMock(true);
        setStep(2);
        return;
      }

      throw new Error('Unsupported file type. Please upload a .csv or .xlsx file.');
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Failed to parse file');
    } finally {
      setParseBusy(false);
    }
  };

  const handleMappingComplete = (m: ImportMapping) => {
    if (!parsed) return;
    setMapping(m);
    const computed = computeMonthsFromMapping(parsed, m);
    setMonths(computed);
    setSelectedMonthKeys([]);
    setStep(3);
  };

  const handleMonthsComplete = (keys: string[]) => {
    setSelectedMonthKeys(keys);
    setStep(4);
  };

  const handleConfirm = () => {
    if (!parsed || !mapping) return;

    console.log('Import Started', {
      file: parsed.file.name,
      mapping,
      months: selectedMonths,
      totalSelectedTxns,
    });
  };

  return (
    <div className="min-h-screen bg-obsidian-950 flex items-center justify-center p-8 font-sans text-obsidian-100">
      <div className="w-full max-w-4xl">
        <div className="mb-12">
          <div className="flex items-center justify-between relative px-8">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-obsidian-800 rounded-full -z-10" />
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-brand transition-all duration-500 rounded-full -z-10"
              style={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }}
            />

            {steps.map((s) => {
              const isActive = step === s.id;
              const isCompleted = step > s.id;
              const Icon = isCompleted ? Check : s.icon;

              return (
                <div key={s.id} className="flex flex-col items-center gap-2 bg-obsidian-950 px-2">
                  <div
                    className={
                      'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ' +
                      (isActive
                        ? 'border-brand bg-brand/10 text-brand shadow-[0_0_15px_rgba(99,102,241,0.5)] scale-110'
                        : isCompleted
                          ? 'border-finance-income bg-finance-income text-obsidian-950 scale-100'
                          : 'border-obsidian-800 bg-obsidian-900 text-obsidian-600')
                    }
                  >
                    <Icon className="w-5 h-5" strokeWidth={isCompleted ? 3 : 2} />
                  </div>

                  <span
                    className={
                      'text-xs font-bold tracking-wider uppercase transition-colors duration-300 absolute -bottom-8 ' +
                      (isActive ? 'text-white' : 'text-obsidian-600')
                    }
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-obsidian-900/30 border border-obsidian-800/50 rounded-2xl p-8 backdrop-blur-sm">
          {step === 1 && (
            <FileDropZone busy={parseBusy} error={parseError} onFileSelected={handleFileSelected} />
          )}

          {step === 2 && (
            <ColumnMapper
              csvHeaders={parsed?.headers ?? []}
              excelMock={excelMock}
              onComplete={handleMappingComplete}
            />
          )}

          {step === 3 && <MonthSelector months={months} onComplete={handleMonthsComplete} />}

          {step === 4 && parsed && mapping && (
            <ImportConfirmation
              fileName={parsed.file.name}
              totalTransactions={parsed.rows.length}
              selectedMonths={selectedMonths}
              mapping={mapping}
              onBack={() => setStep(3)}
              onConfirm={handleConfirm}
            />
          )}
        </div>
      </div>
    </div>
  );
}
