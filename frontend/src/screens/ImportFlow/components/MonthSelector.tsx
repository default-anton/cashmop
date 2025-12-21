import React, { useMemo, useState } from 'react';
import { Calendar, Check, ArrowLeft, ArrowRight, Table as TableIcon } from 'lucide-react';
import { Button, Card, Table } from '../../../components';
import { type ImportMapping } from './ColumnMapperTypes';
import { type ParsedFile } from '../ImportFlow';
import { parseDateLoose, sampleUniqueRows } from '../utils';

export type MonthOption = {
  key: string;
  label: string;
  count: number;
};

interface MonthSelectorProps {
  months: MonthOption[];
  onComplete: (selectedMonthKeys: string[]) => void;
  onBack: () => void;
  parsed: ParsedFile | null;
  mapping: ImportMapping | null;
}

const MonthSelector: React.FC<MonthSelectorProps> = ({ months, onComplete, onBack, parsed, mapping }) => {
  const defaultSelected = useMemo(() => {
    if (months.length === 0) return new Set<string>();
    return new Set<string>([months[months.length - 1].key]);
  }, [months]);

  const [selected, setSelected] = useState<Set<string>>(defaultSelected);

  React.useEffect(() => {
    setSelected(defaultSelected);
  }, [defaultSelected]);

  const totalSelectedTxns = useMemo(() => {
    const byKey = new Map(months.map((m) => [m.key, m.count] as const));
    let total = 0;
    selected.forEach((k) => (total += byKey.get(k) ?? 0));
    return total;
  }, [months, selected]);

  const toggleMonth = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) {
          next.delete(key);
        }
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(months.map((m) => m.key)));

  const deselectAll = () => {
    if (months.length > 0) {
      setSelected(new Set([months[months.length - 1].key]));
    }
  };

  const canStart = selected.size > 0;

  const previewRows = useMemo(() => {
    if (!parsed || !mapping) return [];
    const { headers, rows } = parsed;

    const dateColIdx = headers.indexOf(mapping.csv.date);

    const filteredRows = rows.filter(row => {
      const dStr = row[dateColIdx];
      const d = parseDateLoose(dStr || '');
      if (!d) return false;

      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const key = `${year}-${String(month).padStart(2, '0')}`;

      return selected.has(key);
    });

    const sample = sampleUniqueRows(filteredRows, 5, (r) => r.join('\u0000'));
    const colIdx = (col: string | undefined) => (col ? headers.indexOf(col) : -1);

    const dateIdx = colIdx(mapping.csv.date);
    const ownerIdx = colIdx(mapping.csv.owner);
    const accountIdx = colIdx(mapping.csv.account);
    const currencyIdx = colIdx(mapping.csv.currency);
    const descIdxs = mapping.csv.description.map((h: string) => headers.indexOf(h)).filter((i: number) => i !== -1);

    const am = mapping.csv.amountMapping;
    let amountFn: (row: string[]) => number;

    if (am?.type === 'single') {
      const idx = colIdx(am.column);
      amountFn = (row) => idx >= 0 ? parseFloat(row[idx]?.replace(/[^0-9.-]/g, '') || '0') || 0 : 0;
    } else if (am?.type === 'debitCredit') {
      const debitIdx = colIdx(am.debitColumn);
      const creditIdx = colIdx(am.creditColumn);
      amountFn = (row) => {
        const debit = debitIdx >= 0 ? parseFloat(row[debitIdx]?.replace(/[^0-9.-]/g, '') || '0') || 0 : 0;
        const credit = creditIdx >= 0 ? parseFloat(row[creditIdx]?.replace(/[^0-9.-]/g, '') || '0') || 0 : 0;
        return Math.abs(credit) - Math.abs(debit);
      };
    } else if (am?.type === 'amountWithType') {
      const amountIdx = colIdx(am.amountColumn);
      const typeIdx = colIdx(am.typeColumn);
      const neg = (am.negativeValue ?? 'debit').trim().toLowerCase();
      const pos = (am.positiveValue ?? 'credit').trim().toLowerCase();

      amountFn = (row) => {
        const raw = amountIdx >= 0 ? row[amountIdx] : '';
        const val = parseFloat(raw?.replace(/[^0-9.-]/g, '') || '0') || 0;
        const typeVal = typeIdx >= 0 ? (row[typeIdx] ?? '').trim().toLowerCase() : '';
        const abs = Math.abs(val);

        if (typeVal && neg && typeVal === neg) return -abs;
        if (typeVal && pos && typeVal === pos) return abs;

        return val;
      };
    } else {
      const idx = colIdx(mapping.csv.amount);
      amountFn = (row) => idx >= 0 ? parseFloat(row[idx]?.replace(/[^0-9.-]/g, '') || '0') || 0 : 0;
    }

    return sample.map(row => ({
      date: dateIdx >= 0 ? row[dateIdx] : '',
      description: descIdxs.map(i => row[i]).filter(Boolean).join(' '),
      amount: amountFn(row),
      owner: ownerIdx >= 0 ? row[ownerIdx] : (mapping.defaultOwner || ''),
      account: accountIdx >= 0 ? row[accountIdx] : (mapping.account || ''),
      currency: currencyIdx >= 0 ? row[currencyIdx] : mapping.currencyDefault,
    }));
  }, [parsed, mapping, selected]);

  const previewColumns = useMemo(() => [
    { key: 'date', header: 'Date', className: 'whitespace-nowrap font-mono text-xs' },
    { key: 'description', header: 'Description', className: 'whitespace-nowrap text-xs' },
    {
      key: 'amount',
      header: 'Amount',
      className: 'whitespace-nowrap text-right font-mono text-xs',
      render: (val: number) => (
        <span className={val < 0 ? 'text-finance-expense' : 'text-finance-income'}>
          {val.toFixed(2)}
        </span>
      )
    },
    { key: 'account', header: 'Account', className: 'whitespace-nowrap text-xs' },
  ], []);

  return (
    <div className="flex flex-col gap-8 animate-snap-in">
      <Card variant="glass" className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-brand/10 text-brand rounded-xl">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-canvas-800">Select Range</h2>
              <p className="text-canvas-500">
                Found transactions spanning {months.length} month{months.length === 1 ? '' : 's'}.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <Button 
              variant="primary" 
              size="sm" 
              onClick={() => onComplete(Array.from(selected))} 
              disabled={!canStart}
            >
              Start Import <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-bold text-canvas-500 uppercase tracking-widest">
            Selected: <span className="font-mono text-brand">{totalSelectedTxns}</span> transactions
          </div>
          <div className="flex gap-2">
            <button onClick={selectAll} className="text-[10px] font-bold text-brand uppercase hover:underline">Select All</button>
            <span className="text-canvas-300">|</span>
            <button onClick={deselectAll} className="text-[10px] font-bold text-canvas-500 uppercase hover:underline">Deselect All</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {months.map((m) => {
            const isSelected = selected.has(m.key);
            return (
              <button
                key={m.key}
                onClick={() => toggleMonth(m.key)}
                className={
                  'flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-200 group ' +
                  (isSelected
                    ? 'bg-brand/5 border-brand text-canvas-800 shadow-sm'
                    : 'bg-canvas-100 border-transparent text-canvas-500 hover:bg-canvas-200')
                }
              >
                <div className="flex flex-col items-start">
                  <span className={`text-sm font-bold ${isSelected ? 'text-canvas-800' : 'text-canvas-600'}`}>{m.label}</span>
                  <span className="text-[10px] font-mono text-canvas-400">{m.count} items</span>
                </div>
                <div className={`
                  w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all
                  ${isSelected ? 'bg-brand border-brand text-white' : 'border-canvas-300 bg-white group-hover:border-canvas-400'}
                `}>
                  {isSelected && <Check className="w-3.5 h-3.5" strokeWidth={4} />}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <div className="bg-canvas-50 rounded-2xl border border-canvas-200 overflow-hidden shadow-sm">
        <div className="px-6 py-3 bg-canvas-100 border-b border-canvas-200 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <TableIcon className="w-4 h-4 text-canvas-400" />
            <span className="text-xs font-bold text-canvas-500 uppercase tracking-widest">Mapped Data Preview</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table
            columns={previewColumns as any}
            data={previewRows}
            className="border-none rounded-none"
          />
        </div>
      </div>
    </div>
  );
};

export default MonthSelector;
