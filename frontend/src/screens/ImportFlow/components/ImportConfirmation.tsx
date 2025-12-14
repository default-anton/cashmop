import React from 'react';
import { CheckCircle2, FileText, ArrowLeft, Eye } from 'lucide-react';

import type { ImportMapping } from './ColumnMapper';
import type { MonthOption } from './MonthSelector';
import type { ParsedFile } from '../ImportFlow';

interface ImportConfirmationProps {
  fileName: string;
  totalTransactions: number;
  selectedMonths: MonthOption[];
  mapping: ImportMapping;
  parsed?: ParsedFile;
  onBack: () => void;
  onConfirm: () => void;
}

const ImportConfirmation: React.FC<ImportConfirmationProps> = ({
  fileName,
  totalTransactions,
  selectedMonths,
  mapping,
  parsed,
  onBack,
  onConfirm,
}) => {
  const [showPreview, setShowPreview] = React.useState(false);

  const previewRows = React.useMemo(() => {
    if (!parsed) return [];
    const { headers, rows } = parsed;
    const sample = rows.slice(0, 5); // first 5 rows

    // Helper to get column index, returns -1 if not found
    const colIdx = (col: string | undefined) => (col ? headers.indexOf(col) : -1);

    const dateIdx = colIdx(mapping.csv.date);
    const ownerIdx = colIdx(mapping.csv.owner);
    const currencyIdx = colIdx(mapping.csv.currency);
    const descIdxs = mapping.csv.description.map(h => headers.indexOf(h)).filter(i => i !== -1);
    
    // Amount mapping
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
        return credit - debit; // debit negative, credit positive
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
      // fallback to legacy amount column
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

  return (
    <div className="max-w-xl mx-auto animate-snap-in">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand/10 border border-brand/30 mb-4">
          <CheckCircle2 className="w-7 h-7 text-brand" />
        </div>
        <h2 className="text-2xl font-bold text-canvas-800 mb-2">Confirm Import</h2>
        <p className="text-canvas-500">Review the summary before importing.</p>
      </div>

      <div className="bg-canvas-50/40 border border-canvas-200 rounded-2xl p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-canvas-50 border border-canvas-200">
              <FileText className="w-5 h-5 text-canvas-600" />
            </div>
            <div>
              <div className="text-sm font-semibold text-canvas-800">{fileName}</div>
              <div className="text-xs text-canvas-500 font-mono">{totalTransactions} transactions detected</div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-canvas-500">Account</div>
            <div className="text-sm font-semibold text-canvas-800">{mapping.account}</div>
          </div>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs text-canvas-500">Months</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedMonths.map((m) => (
                <span
                  key={m.key}
                  className="text-xs font-mono bg-canvas-50 border border-canvas-200 px-3 py-1.5 rounded"
                >
                  {m.label} • {m.count}
                </span>
              ))}
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-canvas-500">Currency</div>
            <div className="text-sm font-semibold text-canvas-800">
              {mapping.csv.currency ? `From: ${mapping.csv.currency}` : mapping.currencyDefault}
            </div>
          </div>
        </div>

        {parsed && (
          <div className="pt-4 border-t border-canvas-200">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="inline-flex items-center gap-2 text-sm font-semibold text-canvas-600 hover:text-brand transition-colors"
            >
              <Eye className="w-4 h-4" />
              {showPreview ? 'Hide preview' : 'Show preview of mapped data'}
            </button>
            {showPreview && previewRows.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b border-canvas-200">
                      <th className="text-left py-2 px-3 text-canvas-500">Date</th>
                      <th className="text-left py-2 px-3 text-canvas-500">Description</th>
                      <th className="text-left py-2 px-3 text-canvas-500">Amount</th>
                      <th className="text-left py-2 px-3 text-canvas-500">Owner</th>
                      <th className="text-left py-2 px-3 text-canvas-500">Currency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, idx) => (
                      <tr key={idx} className="border-b border-canvas-50 hover:bg-canvas-200/30">
                        <td className="py-2 px-3">{row.date}</td>
                        <td className="py-2 px-3 max-w-xs truncate">{row.description}</td>
                        <td className={`py-2 px-3 ${row.amount < 0 ? 'text-finance-expense' : 'text-finance-income'}`}>
                          {row.amount < 0 ? '-' : ''}{Math.abs(row.amount).toFixed(2)}
                        </td>
                        <td className="py-2 px-3">{row.owner}</td>
                        <td className="py-2 px-3">{row.currency}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-canvas-500">Showing first {previewRows.length} rows</p>
              </div>
            )}
          </div>
        )}

        <div className="pt-2 border-t border-canvas-200 flex items-center justify-between">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg bg-canvas-200 border border-canvas-300 text-canvas-700 hover:border-canvas-500 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          <button
            onClick={onConfirm}
            className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2 rounded-lg bg-brand hover:bg-brand-hover text-white hover:shadow-brand-glow transition-colors"
          >
            Confirm Import
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportConfirmation;
