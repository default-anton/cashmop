import React from 'react';
import { ArrowUpDown } from 'lucide-react';

import { Input } from '../../../../../components';
import type { MappingPunchThroughModel } from '../useMappingPunchThroughModel';

export const AmountStepPanel: React.FC<{ model: MappingPunchThroughModel }> = ({ model }) => {
  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          className={
            'px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ' +
            (model.amountMappingType === 'single'
              ? 'bg-brand text-white border-brand'
              : 'bg-canvas-50 text-canvas-700 border-canvas-300 hover:border-canvas-600')
          }
          onClick={() => model.handleAmountMappingTypeChange('single')}
          type="button"
        >
          Single column
        </button>
        <button
          className={
            'px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ' +
            (model.amountMappingType === 'debitCredit'
              ? 'bg-brand text-white border-brand'
              : 'bg-canvas-50 text-canvas-700 border-canvas-300 hover:border-canvas-600')
          }
          onClick={() => model.handleAmountMappingTypeChange('debitCredit')}
          type="button"
        >
          Debit / Credit
        </button>
        <button
          className={
            'px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ' +
            (model.amountMappingType === 'amountWithType'
              ? 'bg-brand text-white border-brand'
              : 'bg-canvas-50 text-canvas-700 border-canvas-300 hover:border-canvas-600')
          }
          onClick={() => model.handleAmountMappingTypeChange('amountWithType')}
          type="button"
        >
          Amount + Type
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={model.toggleInvertSign}
          className={
            'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ' +
            (model.invertSignEnabled
              ? 'bg-brand text-white border-brand'
              : 'bg-canvas-50 text-canvas-700 border-canvas-300 hover:border-canvas-600')
          }
        >
          <ArrowUpDown className="w-4 h-4" />
          {model.invertSignEnabled ? 'Flip sign: On' : 'Flip sign: Off'}
        </button>
        <span className="text-xs text-canvas-500 select-none">Turn on if your file shows expenses as positive numbers.</span>
      </div>

      {model.amountMappingType === 'debitCredit' && (
        <div className="grid gap-3 p-4 bg-canvas-100 rounded-xl border border-canvas-200">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => model.setAmountAssignTarget('debitColumn')}
              className={
                'px-3 py-1.5 rounded-lg border text-sm font-semibold transition-colors ' +
                (model.amountAssignTarget === 'debitColumn'
                  ? 'bg-brand/10 border-brand text-brand'
                  : 'bg-canvas-50 border-canvas-300 text-canvas-700 hover:border-canvas-600')
              }
            >
              Debit column
            </button>
            <span className="text-sm text-canvas-600 font-mono">
              {model.mapping.csv.amountMapping?.type === 'debitCredit'
                ? model.mapping.csv.amountMapping.debitColumn || '—'
                : '—'}
            </span>
            {model.mapping.csv.amountMapping?.type === 'debitCredit' && model.mapping.csv.amountMapping.debitColumn && (
              <button
                type="button"
                onClick={() =>
                  model.removeHeaderEverywhere(
                    model.mapping.csv.amountMapping?.type === 'debitCredit'
                      ? model.mapping.csv.amountMapping.debitColumn || ''
                      : ''
                  )
                }
                className="text-xs font-semibold text-canvas-500 hover:text-canvas-800"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => model.setAmountAssignTarget('creditColumn')}
              className={
                'px-3 py-1.5 rounded-lg border text-sm font-semibold transition-colors ' +
                (model.amountAssignTarget === 'creditColumn'
                  ? 'bg-brand/10 border-brand text-brand'
                  : 'bg-canvas-50 border-canvas-300 text-canvas-700 hover:border-canvas-600')
              }
            >
              Credit column
            </button>
            <span className="text-sm text-canvas-600 font-mono">
              {model.mapping.csv.amountMapping?.type === 'debitCredit'
                ? model.mapping.csv.amountMapping.creditColumn || '—'
                : '—'}
            </span>
            {model.mapping.csv.amountMapping?.type === 'debitCredit' && model.mapping.csv.amountMapping.creditColumn && (
              <button
                type="button"
                onClick={() =>
                  model.removeHeaderEverywhere(
                    model.mapping.csv.amountMapping?.type === 'debitCredit'
                      ? model.mapping.csv.amountMapping.creditColumn || ''
                      : ''
                  )
                }
                className="text-xs font-semibold text-canvas-500 hover:text-canvas-800"
              >
                Clear
              </button>
            )}
          </div>
          <div className="text-xs text-canvas-500 select-none">
            Tip: you can proceed with just one of these mapped. Use Next when you're happy.
          </div>
        </div>
      )}

      {model.amountMappingType === 'amountWithType' && (
        <div className="grid gap-3 p-4 bg-canvas-100 rounded-xl border border-canvas-200">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => model.setAmountAssignTarget('amountColumn')}
              className={
                'px-3 py-1.5 rounded-lg border text-sm font-semibold transition-colors ' +
                (model.amountAssignTarget === 'amountColumn'
                  ? 'bg-brand/10 border-brand text-brand'
                  : 'bg-canvas-50 border-canvas-300 text-canvas-700 hover:border-canvas-600')
              }
            >
              Amount column
            </button>
            <span className="text-sm text-canvas-600 font-mono">
              {model.mapping.csv.amountMapping?.type === 'amountWithType'
                ? (model.mapping.csv.amountMapping as any).amountColumn || '—'
                : '—'}
            </span>
            {model.mapping.csv.amountMapping?.type === 'amountWithType' && (model.mapping.csv.amountMapping as any).amountColumn && (
              <button
                type="button"
                onClick={() => model.removeHeaderEverywhere((model.mapping.csv.amountMapping as any).amountColumn)}
                className="text-xs font-semibold text-canvas-500 hover:text-canvas-800"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => model.setAmountAssignTarget('typeColumn')}
              className={
                'px-3 py-1.5 rounded-lg border text-sm font-semibold transition-colors ' +
                (model.amountAssignTarget === 'typeColumn'
                  ? 'bg-brand/10 border-brand text-brand'
                  : 'bg-canvas-50 border-canvas-300 text-canvas-700 hover:border-canvas-600')
              }
            >
              Type column
            </button>
            <span className="text-sm text-canvas-600 font-mono">
              {model.mapping.csv.amountMapping?.type === 'amountWithType'
                ? (model.mapping.csv.amountMapping as any).typeColumn || '—'
                : '—'}
            </span>
            {model.mapping.csv.amountMapping?.type === 'amountWithType' && (model.mapping.csv.amountMapping as any).typeColumn && (
              <button
                type="button"
                onClick={() => model.removeHeaderEverywhere((model.mapping.csv.amountMapping as any).typeColumn)}
                className="text-xs font-semibold text-canvas-500 hover:text-canvas-800"
              >
                Clear
              </button>
            )}
          </div>

          {model.mapping.csv.amountMapping?.type === 'amountWithType' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] font-bold text-canvas-500 uppercase tracking-wider mb-1 select-none">
                  Negative value
                </div>
                <Input
                  value={model.mapping.csv.amountMapping.negativeValue ?? 'debit'}
                  onChange={(e) => model.updateAmountWithTypeValues('negativeValue', e.target.value)}
                  placeholder="debit"
                />
              </div>
              <div>
                <div className="text-[10px] font-bold text-canvas-500 uppercase tracking-wider mb-1 select-none">
                  Positive value
                </div>
                <Input
                  value={model.mapping.csv.amountMapping.positiveValue ?? 'credit'}
                  onChange={(e) => model.updateAmountWithTypeValues('positiveValue', e.target.value)}
                  placeholder="credit"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
