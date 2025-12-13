import React from 'react';
import { CheckCircle2, FileText, ArrowLeft } from 'lucide-react';

import type { ImportMapping } from './ColumnMapper';
import type { MonthOption } from './MonthSelector';

interface ImportConfirmationProps {
  fileName: string;
  totalTransactions: number;
  selectedMonths: MonthOption[];
  mapping: ImportMapping;
  onBack: () => void;
  onConfirm: () => void;
}

const ImportConfirmation: React.FC<ImportConfirmationProps> = ({
  fileName,
  totalTransactions,
  selectedMonths,
  mapping,
  onBack,
  onConfirm,
}) => {
  return (
    <div className="max-w-xl mx-auto animate-snap-in">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand/10 border border-brand/30 mb-4">
          <CheckCircle2 className="w-7 h-7 text-brand" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Confirm Import</h2>
        <p className="text-obsidian-400">Review the summary before importing.</p>
      </div>

      <div className="bg-obsidian-900/40 border border-obsidian-800 rounded-2xl p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-obsidian-900 border border-obsidian-800">
              <FileText className="w-5 h-5 text-obsidian-300" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">{fileName}</div>
              <div className="text-xs text-obsidian-500 font-mono">{totalTransactions} transactions detected</div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-obsidian-500">Account</div>
            <div className="text-sm font-semibold text-white">{mapping.account}</div>
          </div>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs text-obsidian-500">Months</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedMonths.map((m) => (
                <span
                  key={m.key}
                  className="text-xs font-mono bg-obsidian-900 border border-obsidian-800 px-3 py-1.5 rounded"
                >
                  {m.label} • {m.count}
                </span>
              ))}
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-obsidian-500">Currency</div>
            <div className="text-sm font-semibold text-white">
              {mapping.csv.currency ? `From: ${mapping.csv.currency}` : mapping.currencyDefault}
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-obsidian-800 flex items-center justify-between">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg bg-obsidian-800 border border-obsidian-700 text-obsidian-200 hover:border-obsidian-500 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          <button
            onClick={onConfirm}
            className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2 rounded-lg bg-brand hover:bg-brand-hover text-white transition-colors"
          >
            Confirm Import
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportConfirmation;
