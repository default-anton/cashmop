import React from 'react';
import { DropTarget, FieldMeta, SingleMappingPill, Select, Input } from '../../../../components';
import { CsvFieldKey, AmountMapping as AmountMappingType } from '../ColumnMapperTypes';

interface AmountMappingProps {
  amountMapping: AmountMappingType | undefined;
  legacyAmount: string;
  activeDropKey: CsvFieldKey | null;
  isMissing: boolean;
  onDragOver: (key: CsvFieldKey) => void;
  onDragLeave: () => void;
  onDrop: (key: CsvFieldKey, header: string) => void;
  onClear: (header: string) => void;
  onTypeChange: (type: AmountMappingType['type']) => void;
  onAssignAmountColumn: (field: 'column' | 'debitColumn' | 'creditColumn' | 'amountColumn' | 'typeColumn', header: string) => void;
  onUpdateAmountWithTypeValues: (field: 'negativeValue' | 'positiveValue', value: string) => void;
}

export const AmountMapping: React.FC<AmountMappingProps> = ({
  amountMapping,
  legacyAmount,
  activeDropKey,
  isMissing,
  onDragOver,
  onDragLeave,
  onDrop,
  onClear,
  onTypeChange,
  onAssignAmountColumn,
  onUpdateAmountWithTypeValues,
}) => {
  const amountMappingType = amountMapping?.type ?? 'single';

  return (
    <div className="bg-canvas-200/50 border border-canvas-300 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <FieldMeta label="Amount" required />
        <Select
          value={amountMappingType}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onTypeChange(e.target.value as AmountMappingType['type'])}
          options={[
            { value: 'single', label: 'Single column' },
            { value: 'debitCredit', label: 'Separate Debit/Credit columns' },
            { value: 'amountWithType', label: 'Amount + Type column' }
          ]}
          className="bg-canvas-50"
        />
      </div>

      {amountMappingType === 'single' && (
        <DropTarget
          isActive={activeDropKey === 'amount'}
          isMissing={isMissing}
          className="border-dashed rounded-lg p-3"
          onDragOver={(e: React.DragEvent) => {
            e.preventDefault();
            onDragOver('amount');
          }}
          onDragLeave={onDragLeave}
          onDrop={(e: React.DragEvent) => {
            e.preventDefault();
            onDrop('amount', e.dataTransfer.getData('text/plain'));
          }}
        >
          <SingleMappingPill
            value={amountMapping?.type === 'single' ? amountMapping.column : legacyAmount}
            placeholder="Drop column here"
            onClear={() => {
              const col = amountMapping?.type === 'single' ? amountMapping.column : legacyAmount;
              if (col) onClear(col);
            }}
          />
        </DropTarget>
      )}

      {amountMappingType === 'debitCredit' && (
        <div className="space-y-3">
          <DropTarget
            isActive={activeDropKey === 'debit'}
            className="border-dashed rounded-lg p-3"
            onDragOver={(e: React.DragEvent) => {
              e.preventDefault();
              onDragOver('debit');
            }}
            onDragLeave={onDragLeave}
            onDrop={(e: React.DragEvent) => {
              e.preventDefault();
              onAssignAmountColumn('debitColumn', e.dataTransfer.getData('text/plain'));
            }}
          >
            <div className="text-xs font-semibold text-canvas-600 mb-1">Debit (negative)</div>
            <SingleMappingPill
              value={amountMapping?.type === 'debitCredit' ? amountMapping.debitColumn ?? '' : ''}
              placeholder="Drop debit column here"
              onClear={() => {
                const col = amountMapping?.type === 'debitCredit' ? amountMapping.debitColumn : undefined;
                if (col) onClear(col);
              }}
            />
          </DropTarget>
          <DropTarget
            isActive={activeDropKey === 'credit'}
            className="border-dashed rounded-lg p-3"
            onDragOver={(e: React.DragEvent) => {
              e.preventDefault();
              onDragOver('credit');
            }}
            onDragLeave={onDragLeave}
            onDrop={(e: React.DragEvent) => {
              e.preventDefault();
              onAssignAmountColumn('creditColumn', e.dataTransfer.getData('text/plain'));
            }}
          >
            <div className="text-xs font-semibold text-canvas-600 mb-1">Credit (positive)</div>
            <SingleMappingPill
              value={amountMapping?.type === 'debitCredit' ? amountMapping.creditColumn ?? '' : ''}
              placeholder="Drop credit column here"
              onClear={() => {
                const col = amountMapping?.type === 'debitCredit' ? amountMapping.creditColumn : undefined;
                if (col) onClear(col);
              }}
            />
          </DropTarget>
          <p className="text-xs text-canvas-500">Map at least one column. Debits are treated as negative amounts.</p>
        </div>
      )}

      {amountMappingType === 'amountWithType' && (
        <div className="space-y-3">
          <DropTarget
            isActive={activeDropKey === 'amountColumn'}
            className="border-dashed rounded-lg p-3"
            onDragOver={(e: React.DragEvent) => {
              e.preventDefault();
              onDragOver('amountColumn');
            }}
            onDragLeave={onDragLeave}
            onDrop={(e: React.DragEvent) => {
              e.preventDefault();
              onAssignAmountColumn('amountColumn', e.dataTransfer.getData('text/plain'));
            }}
          >
            <div className="text-xs font-semibold text-canvas-600 mb-1">Amount column</div>
            <SingleMappingPill
              value={amountMapping?.type === 'amountWithType' ? amountMapping.amountColumn : ''}
              placeholder="Drop amount column here"
              onClear={() => {
                const col = amountMapping?.type === 'amountWithType' ? amountMapping.amountColumn : undefined;
                if (col) onClear(col);
              }}
            />
          </DropTarget>
          <DropTarget
            isActive={activeDropKey === 'typeColumn'}
            className="border-dashed rounded-lg p-3"
            onDragOver={(e: React.DragEvent) => {
              e.preventDefault();
              onDragOver('typeColumn');
            }}
            onDragLeave={onDragLeave}
            onDrop={(e: React.DragEvent) => {
              e.preventDefault();
              onAssignAmountColumn('typeColumn', e.dataTransfer.getData('text/plain'));
            }}
          >
            <div className="text-xs font-semibold text-canvas-600 mb-1">Type column</div>
            <SingleMappingPill
              value={amountMapping?.type === 'amountWithType' ? amountMapping.typeColumn : ''}
              placeholder="Drop type column here"
              onClear={() => {
                const col = amountMapping?.type === 'amountWithType' ? amountMapping.typeColumn : undefined;
                if (col) onClear(col);
              }}
            />
          </DropTarget>
          <div className="space-y-2">
            <p className="text-xs text-canvas-500">Map both columns. Type column values:</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-canvas-600 mb-1">Negative amount value</label>
                <Input
                  type="text"
                  variant="mono"
                  value={amountMapping?.type === 'amountWithType' ? amountMapping.negativeValue ?? 'debit' : 'debit'}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdateAmountWithTypeValues('negativeValue', e.target.value)}
                  className="w-full"
                  placeholder="debit"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-canvas-600 mb-1">Positive amount value</label>
                <Input
                  type="text"
                  variant="mono"
                  value={amountMapping?.type === 'amountWithType' ? amountMapping.positiveValue ?? 'credit' : 'credit'}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdateAmountWithTypeValues('positiveValue', e.target.value)}
                  className="w-full"
                  placeholder="credit"
                />
              </div>
            </div>
            <p className="text-xs text-canvas-500">Values are matched case‑insensitively.</p>
          </div>
        </div>
      )}
    </div>
  );
};
