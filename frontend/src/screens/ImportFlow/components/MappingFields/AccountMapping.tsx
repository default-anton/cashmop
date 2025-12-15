import React, { useState } from 'react';
import { FieldMeta, Select, Button, Input } from '../../../../components';
import { X } from 'lucide-react';

interface AccountMappingProps {
  account: string;
  availableAccounts: string[];
  isMissing: boolean;
  onSetAccount: (account: string) => void;
  onAddAccount: (account: string) => void;
}

export const AccountMapping: React.FC<AccountMappingProps> = ({
  account,
  availableAccounts,
  isMissing,
  onSetAccount,
  onAddAccount,
}) => {
  const [isAddingNewAccount, setIsAddingNewAccount] = useState(false);
  const [newAccountInput, setNewAccountInput] = useState('');

  return (
    <div
      className={
        'bg-canvas-200/50 border rounded-xl p-4 flex items-center justify-between group transition-colors ' +
        (isMissing ? 'border-finance-expense/60 bg-finance-expense/5' : 'border-canvas-300')
      }
    >
      <FieldMeta label="Account" required />
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
            options={[
              { value: '', label: 'Select account...' },
              ...availableAccounts.map(acc => ({ value: acc, label: acc })),
              { value: '', label: '---', disabled: true },
              { value: '__add_new', label: 'Add new account...' }
            ]}
            className="w-full"
          />
          {account && !isAddingNewAccount && (
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
        <p className="text-xs text-canvas-500">Pick an existing account or add a new one.</p>
      </div>
    </div>
  );
};
