import React, { useMemo, useState } from 'react';
import { Calendar, Check, ArrowLeft } from 'lucide-react';
import { Button, Card, Table } from '../../../components';
import { type ImportMapping } from './ColumnMapperTypes';
import { type ParsedFile } from '../ImportFlow';

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
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(months.map((m) => m.key)));
  const deselectAll = () => setSelected(new Set());

  const canStart = selected.size > 0;

  const previewRows = useMemo(() => {
    if (!parsed || !mapping) return [];
    const { headers, rows } = parsed;
    const sample = rows.slice(0, 5);

    const colIdx = (col: string | undefined) => (col ? headers.indexOf(col) : -1);

    const dateIdx = colIdx(mapping.csv.date);
    const ownerIdx = colIdx(mapping.csv.owner);
    const currencyIdx = colIdx(mapping.csv.currency);
    const descIdxs = mapping.csv.description.map((h: string) => headers.indexOf(h)).filter((i: number) => i !== -1);

    const am = mapping.csv.amountMapping;
    let amountFn: (row: string[]) => number;
    if (am?.type === 'single') {
      const idx = colIdx(am.column);
      amountFn = (row) => idx >= 0 ? parseFloat(row[idx] || '0') || 0 : 0;
    } else if (am?.type === 'debitCredit') {
      const debitIdx = colIdx(am.debitColumn);
      const creditIdx = colIdx(am.creditColumn);
      amountFn = (row) => {
        const debit = debitIdx >= 0 ? parseFloat(row[debitIdx] || '0') || 0 : 0;
        const credit = creditIdx >= 0 ? parseFloat(row[creditIdx] || '0') || 0 : 0;
        return credit - debit;
      };
    } else if (am?.type === 'amountWithType') {
      const amountIdx = colIdx(am.amountColumn);
      const typeIdx = colIdx(am.typeColumn);
      amountFn = (row) => {
        const amount = amountIdx >= 0 ? parseFloat(row[amountIdx] || '0') || 0 : 0;
        const type = typeIdx >= 0 ? row[typeIdx]?.toLowerCase() : '';
        return type.includes('debit') ? -amount : amount;
      };
    } else {
      const idx = colIdx(mapping.csv.amount);
      amountFn = (row) => idx >= 0 ? parseFloat(row[idx] || '0') || 0 : 0;
    }

    return sample.map(row => ({
      date: dateIdx >= 0 ? row[dateIdx] : '',
      description: descIdxs.map(i => row[i]).filter(Boolean).join(' '),
      amount: amountFn(row),
      owner: ownerIdx >= 0 ? row[ownerIdx] : '',
      currency: currencyIdx >= 0 ? row[currencyIdx] : mapping.currencyDefault,
    }));
  }, [parsed, mapping]);

  const previewColumns = useMemo(() => [
    { key: 'date', header: 'Date', className: 'whitespace-nowrap' },
    { key: 'description', header: 'Description', className: 'whitespace-nowrap' },
    {
      key: 'amount',
      header: 'Amount',
      className: 'whitespace-nowrap text-right',
      render: (val: number) => (
        <span className={val < 0 ? 'text-finance-expense' : 'text-finance-income'}>
          {val < 0 ? '-' : ''}{Math.abs(val).toFixed(2)}
        </span>
      )
    },
    { key: 'owner', header: 'Owner', className: 'whitespace-nowrap' },
    { key: 'currency', header: 'Currency', className: 'whitespace-nowrap' },
  ], []);

  return (
    <div className="max-w-4xl mx-auto animate-snap-in flex flex-col gap-6">
      <div className="text-center mb-2">
        <h2 className="text-2xl font-bold text-canvas-800 mb-2">Select Range</h2>
        <p className="text-canvas-500">
          We found transactions spanning {months.length} month{months.length === 1 ? '' : 's'}.
        </p>
      </div>

      <Card variant="elevated" className="overflow-hidden">
        <div className="px-6 py-4 border-b border-canvas-200 bg-canvas-50/50">
          <h3 className="text-xs font-semibold text-canvas-500 uppercase tracking-wider mb-3">Mapped Data Preview</h3>
          <Table
            columns={previewColumns as any}
            data={previewRows}
            className="bg-white"
          />
        </div>
      </Card>

      <Card variant="elevated" className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-canvas-500">
            Selected: <span className="font-mono text-canvas-700">{totalSelectedTxns}</span> txns
          </div>
          <div className="flex gap-2">
            <Button
              onClick={selectAll}
              variant="secondary"
              size="sm"
            >
              Select All
            </Button>
            <Button
              onClick={deselectAll}
              variant="secondary"
              size="sm"
            >
              Deselect All
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-8 max-h-[400px] overflow-y-auto pr-2">
          {months.map((m) => {
            const isSelected = selected.has(m.key);
            return (
              <button
                key={m.key}
                onClick={() => toggleMonth(m.key)}
                className={
                  'flex items-center justify-between p-4 rounded-xl border transition-all duration-200 ' +
                  (isSelected
                    ? 'bg-brand text-white border-brand shadow-focus-ring'
                    : 'bg-canvas-200 text-canvas-600 border-canvas-300 hover:border-canvas-500')
                }
              >
                <div className="flex items-center gap-3">
                  <div className={
                    'p-2 rounded-lg ' + (isSelected ? 'bg-white/20' : 'bg-canvas-50')
                  }>
                    <Calendar className="w-5 h-5" />
                  </div>
                  <span className="font-semibold">{m.label}</span>
                </div>

                <div className="flex items-center gap-4">
                  <span className={
                    'text-sm font-mono ' + (isSelected ? 'text-white/80' : 'text-canvas-500')
                  }>
                    {m.count}
                  </span>
                  {isSelected && <Check className="w-5 h-5" />}
                </div>
              </button>
            );
          })}

          {months.length === 0 && (
            <div className="col-span-full text-sm text-canvas-500 bg-canvas-50/50 border border-canvas-200 rounded-xl p-4 text-center">
              No months detected. Check that your Date mapping is correct.
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-canvas-200">
          <Button
            onClick={onBack}
            variant="secondary"
            size="lg"
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" /> Back
          </Button>

          <Button
            onClick={() => onComplete(Array.from(selected))}
            disabled={!canStart}
            variant="primary"
            size="lg"
            className="min-w-[120px]"
          >
            Import
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default MonthSelector;
