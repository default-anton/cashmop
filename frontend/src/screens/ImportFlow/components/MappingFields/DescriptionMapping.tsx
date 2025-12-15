import React from 'react';
import { DropTarget, FieldMeta, SingleMappingPill, DragReorderableList } from '../../../../components';
import { CsvFieldKey } from '../ColumnMapperTypes';

interface DescriptionMappingProps {
  values: string[];
  activeDropKey: CsvFieldKey | null;
  isMissing: boolean;
  onDragOver: (key: CsvFieldKey) => void;
  onDragLeave: () => void;
  onDrop: (key: CsvFieldKey, header: string) => void;
  onRemove: (index: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  csvHeaders: string[];
}

export const DescriptionMapping: React.FC<DescriptionMappingProps> = ({
  values,
  activeDropKey,
  isMissing,
  onDragOver,
  onDragLeave,
  onDrop,
  onRemove,
  onReorder,
  csvHeaders,
}) => {
  return (
    <DropTarget
      isActive={activeDropKey === 'description'}
      isMissing={isMissing}
      className="items-start"
      onDragOver={(e: React.DragEvent) => {
        e.preventDefault();
        onDragOver('description');
      }}
      onDragLeave={onDragLeave}
      onDrop={(e: React.DragEvent) => {
        e.preventDefault();
        const header = e.dataTransfer.getData('text/plain');
        if (!csvHeaders.includes(header)) {
          return;
        }
        onDrop('description', header);
      }}
    >
      <FieldMeta label="Description" required hint="Supports combining multiple columns" />
      <div className="flex flex-col gap-2">
        {values.length === 0 ? (
          <SingleMappingPill
            value=""
            placeholder="Drop column(s) here"
          />
        ) : (
          <DragReorderableList
            items={values}
            renderItem={(h: string, _index: number) => h}
            onReorder={onReorder}
            onRemove={onRemove}
            emptyPlaceholder={null}
          />
        )}
        {values.length >= 2 && (
          <div className="text-xs text-canvas-500 text-right">
            Drag columns to reorder
          </div>
        )}
      </div>
    </DropTarget>
  );
};
