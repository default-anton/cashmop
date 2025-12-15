import React from 'react';
import { DropTarget, FieldMeta, SingleMappingPill } from '../../../../components';
import { CsvFieldKey } from '../ColumnMapperTypes';

interface DateMappingProps {
  value: string;
  activeDropKey: CsvFieldKey | null;
  isMissing: boolean;
  onDragOver: (key: CsvFieldKey) => void;
  onDragLeave: () => void;
  onDrop: (key: CsvFieldKey, header: string) => void;
  onClear: () => void;
}

export const DateMapping: React.FC<DateMappingProps> = ({
  value,
  activeDropKey,
  isMissing,
  onDragOver,
  onDragLeave,
  onDrop,
  onClear,
}) => {
  return (
    <DropTarget
      isActive={activeDropKey === 'date'}
      isMissing={isMissing}
      onDragOver={(e: React.DragEvent) => {
        e.preventDefault();
        onDragOver('date');
      }}
      onDragLeave={onDragLeave}
      onDrop={(e: React.DragEvent) => {
        e.preventDefault();
        onDrop('date', e.dataTransfer.getData('text/plain'));
      }}
    >
      <FieldMeta label="Date" required />
      <SingleMappingPill
        value={value}
        placeholder="Drop column here"
        onClear={onClear}
      />
    </DropTarget>
  );
};
