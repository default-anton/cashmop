import React, { useState } from 'react';
import { DropTarget, FieldMeta, SingleMappingPill, Select, Button, Input } from '../../../../components';
import { CsvFieldKey } from '../ColumnMapperTypes';
import { X } from 'lucide-react';

interface OwnerMappingProps {
  ownerValue: string | undefined;
  defaultOwner: string | undefined;
  availableOwners: string[];
  activeDropKey: CsvFieldKey | null;
  onDragOver: (key: CsvFieldKey) => void;
  onDragLeave: () => void;
  onDrop: (key: CsvFieldKey, header: string) => void;
  onClear: (header: string) => void;
  onSetDefaultOwner: (owner: string | undefined) => void;
  onAddOwner: (owner: string) => void;
}

export const OwnerMapping: React.FC<OwnerMappingProps> = ({
  ownerValue,
  defaultOwner,
  availableOwners,
  activeDropKey,
  onDragOver,
  onDragLeave,
  onDrop,
  onClear,
  onSetDefaultOwner,
  onAddOwner,
}) => {
  const [isAddingNewOwner, setIsAddingNewOwner] = useState(false);
  const [newOwnerInput, setNewOwnerInput] = useState('');

  return (
    <DropTarget
      isActive={activeDropKey === 'owner'}
      className="items-start"
      onDragOver={(e: React.DragEvent) => {
        e.preventDefault();
        onDragOver('owner');
      }}
      onDragLeave={onDragLeave}
      onDrop={(e: React.DragEvent) => {
        e.preventDefault();
        onDrop('owner', e.dataTransfer.getData('text/plain'));
      }}
    >
      <FieldMeta label="Owner" required={false} hint="Map column or select" />

      <div className="space-y-3">
        <SingleMappingPill
          value={ownerValue ?? ''}
          placeholder="Drop column here"
          onClear={() => (ownerValue ? onClear(ownerValue) : undefined)}
        />

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Select
              value={isAddingNewOwner ? '__add_new' : (defaultOwner || '')}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                if (e.target.value === '__add_new') {
                  setIsAddingNewOwner(true);
                } else {
                  onSetDefaultOwner(e.target.value);
                  setIsAddingNewOwner(false);
                }
              }}
              disabled={!!ownerValue}
              options={[
                { value: '', label: 'Select default owner...' },
                ...availableOwners.map(owner => ({ value: owner, label: owner })),
                { value: '__sep', label: '---', disabled: true },
                { value: '__add_new', label: 'Add new owner...' }
              ]}
              className="w-full"
            />
            {defaultOwner && !ownerValue && !isAddingNewOwner && (
              <button
                type="button"
                onClick={() => onSetDefaultOwner(undefined)}
                className="text-canvas-500 hover:text-brand"
                aria-label="Clear selection"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {isAddingNewOwner && (
            <div className="space-y-1 animate-in fade-in slide-in-from-top-1">
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  variant="mono"
                  value={newOwnerInput}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewOwnerInput(e.target.value)}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === 'Enter') {
                      const trimmed = newOwnerInput.trim().slice(0, 25);
                      if (trimmed) {
                        onAddOwner(trimmed);
                        onSetDefaultOwner(trimmed);
                        setNewOwnerInput('');
                        setIsAddingNewOwner(false);
                      }
                    }
                  }}
                  placeholder="New owner name"
                  maxLength={25}
                  className="flex-1"
                  autoFocus
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    const trimmed = newOwnerInput.trim().slice(0, 25);
                    if (trimmed) {
                      onAddOwner(trimmed);
                      onSetDefaultOwner(trimmed);
                      setNewOwnerInput('');
                      setIsAddingNewOwner(false);
                    }
                  }}
                >
                  Save
                </Button>
              </div>
              <div className="text-xs text-canvas-500 text-right font-mono">
                {newOwnerInput.length}/25
              </div>
            </div>
          )}
          <p className="text-xs text-canvas-500">
            {ownerValue
              ? 'Owner is mapped from CSV column.'
              : 'Pick a default owner or add a new one.'}
          </p>
        </div>
      </div>
    </DropTarget>
  );
};
