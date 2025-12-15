import React, { useState } from 'react';
import { FieldMeta, Select, Button, Input, DropTarget, SingleMappingPill } from '../../../../components';
import { X } from 'lucide-react';
import { CsvFieldKey } from '../ColumnMapperTypes';

interface AccountMappingProps {
  account: string;
  accountValue: string | undefined;
  availableAccounts: string[];
  isMissing: boolean;
  activeDropKey?: CsvFieldKey | null;
  onSetAccount: (account: string) => void;
  onAddAccount: (account: string) => void;
  onDragOver?: (key: CsvFieldKey) => void;
  onDragLeave?: () => void;
  onDrop?: (key: CsvFieldKey, header: string) => void;
  onClear?: (header: string) => void;
}

export const AccountMapping: React.FC<AccountMappingProps> = ({
  account,
  accountValue,
  availableAccounts,
  isMissing,
  activeDropKey,
  onSetAccount,
  onAddAccount,
  onDragOver,
  onDragLeave,
  onDrop,
  onClear,
}) => {
  const [isAddingNewAccount, setIsAddingNewAccount] = useState(false);
  const [newAccountInput, setNewAccountInput] = useState('');

  return (
    <DropTarget
      isActive={activeDropKey === 'account'}
      className={
        'transition-colors ' +
        (isMissing && !account && !accountValue ? 'border-finance-expense/60 bg-finance-expense/5' : '')
      }
      onDragOver={(e: React.DragEvent) => {
        if (onDragOver) {
          e.preventDefault();
          onDragOver('account');
        }
      }}
      onDragLeave={() => onDragLeave?.()}
      onDrop={(e: React.DragEvent) => {
        if (onDrop) {
          e.preventDefault();
          onDrop('account', e.dataTransfer.getData('text/plain'));
        }
      }}
    >
      <FieldMeta label="Account" required hint="Map column or select" />

      <div className="space-y-3">
        {/* Only show the drop zone / pill if drag & drop props are provided */}
        {(onDrop && onClear) && (
          <SingleMappingPill
            value={accountValue ?? ''}
            placeholder="Drop column here"
            onClear={() => (accountValue ? onClear(accountValue) : undefined)}
          />
        )}

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Select
              value={isAddingNewAccount ? '__add_new' : account}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                if (e.target.value === '__add_new') {
                  setIsAddingNewAccount(true);
                } else {
                  onSetAccount(e.target.value);
                  setIsAddingNewAccount(false);
                }
              }}
              disabled={!!accountValue}
              options={[
                { value: '', label: 'Select account...' },
                ...availableAccounts.map(acc => ({ value: acc, label: acc })),
                { value: '', label: '---', disabled: true },
                { value: '__add_new', label: 'Add new account...' }
              ]}
              className="w-full"
            />
            {account && !accountValue && !isAddingNewAccount && (
              <button
                type="button"
                onClick={() => onSetAccount('')}
                className="text-canvas-500 hover:text-brand"
                aria-label="Clear selection"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {isAddingNewAccount && (
            <div className="space-y-1 animate-in fade-in slide-in-from-top-1">
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  variant="mono"
                  value={newAccountInput}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewAccountInput(e.target.value)}
                  placeholder="New account name"
                  maxLength={25}
                  className="flex-1"
                  autoFocus
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    const trimmed = newAccountInput.trim().slice(0, 25);
                    if (trimmed) {
                      onAddAccount(trimmed);
                      onSetAccount(trimmed);
                      setNewAccountInput('');
                      setIsAddingNewAccount(false);
                    }
                  }}
                >
                  Save
                </Button>
              </div>
              <div className="text-xs text-canvas-500 text-right font-mono">
                {newAccountInput.length}/25
              </div>
            </div>
          )}
          <p className="text-xs text-canvas-500">
            {accountValue
              ? 'Account is mapped from CSV column.'
              : 'Pick an existing account or add a new one.'}
          </p>
        </div>
      </div>
    </DropTarget>
  );
};
