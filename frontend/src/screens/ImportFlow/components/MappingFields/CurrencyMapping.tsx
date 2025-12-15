import React from 'react';
import { DropTarget, FieldMeta, SingleMappingPill, Select } from '../../../../components';
import { CsvFieldKey } from '../ColumnMapperTypes';

interface CurrencyMappingProps {
  currencyValue: string | undefined;
  currencyDefault: string;
  activeDropKey: CsvFieldKey | null;
  onDragOver: (key: CsvFieldKey) => void;
  onDragLeave: () => void;
  onDrop: (key: CsvFieldKey, header: string) => void;
  onClear: (header: string) => void;
  onSetCurrencyDefault: (currency: string) => void;
}

export const CurrencyMapping: React.FC<CurrencyMappingProps> = ({
  currencyValue,
  currencyDefault,
  activeDropKey,
  onDragOver,
  onDragLeave,
  onDrop,
  onClear,
  onSetCurrencyDefault,
}) => {
  return (
    <DropTarget
      isActive={activeDropKey === 'currency'}
      onDragOver={(e: React.DragEvent) => {
        e.preventDefault();
        onDragOver('currency');
      }}
      onDragLeave={onDragLeave}
      onDrop={(e: React.DragEvent) => {
        e.preventDefault();
        onDrop('currency', e.dataTransfer.getData('text/plain'));
      }}
    >
      <FieldMeta label="Currency" required={false} />

      <div className="space-y-3">
        <SingleMappingPill
          value={currencyValue ?? ''}
          placeholder="Drop column here"
          onClear={() => (currencyValue ? onClear(currencyValue) : undefined)}
        />

        <div className="flex flex-col gap-2">
          <Select
            value={currencyDefault}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onSetCurrencyDefault(e.target.value)}
            disabled={!!currencyValue}
            options={[
              { value: 'CAD', label: 'CAD' },
              { value: 'USD', label: 'USD' },
              { value: 'EUR', label: 'EUR' }
            ]}
            className="w-full"
          />
          <p className="text-xs text-canvas-500">
            {currencyValue
              ? 'Currency is mapped from CSV column.'
              : 'Pick a currency.'}
          </p>
        </div>
      </div>
    </DropTarget>
  );
};
