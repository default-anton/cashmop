import React from 'react';
import { Card } from '../../../components';

import { Wand2 } from 'lucide-react';

interface Transaction {
  id: number;
  date: string;
  description: string;
  amount: number;
  account_id: number;
  account_name: string;
  owner_name?: string;
}

interface SelectionRule {
  text: string;
  mode: 'contains' | 'starts_with' | 'ends_with';
}

interface TransactionCardProps {
  transaction: Transaction;
  onMouseUp: () => void;
  selectionRule?: SelectionRule | null;
  showOnboardingHint?: boolean;
}

export const TransactionCard: React.FC<TransactionCardProps> = ({
  transaction,
  onMouseUp,
  selectionRule,
  showOnboardingHint,
}) => {
  const renderDescription = () => {
    if (!selectionRule || !transaction.description.toLowerCase().includes(selectionRule.text.toLowerCase())) {
      return transaction.description;
    }

    const { text, mode } = selectionRule;
    const desc = transaction.description;

    // Find the actual index regardless of case
    const index = desc.toLowerCase().indexOf(text.toLowerCase());
    if (index === -1) return desc;

    // Check if the match follows the mode rules
    const matchesMode =
      (mode === 'starts_with' && index === 0) ||
      (mode === 'ends_with' && index + text.length === desc.length) ||
      mode === 'contains';

    if (!matchesMode) return desc;

    const before = desc.substring(0, index);
    const match = desc.substring(index, index + text.length);
    const after = desc.substring(index + text.length);

    return (
      <>
        {before}
        <span className="bg-brand/20 text-brand rounded-sm px-0.5">{match}</span>
        {after}
      </>
    );
  };
  return (
    <div className="relative group perspective-1000">
      <Card
        variant="glass"
        className="p-6 mb-4 transform transition-all duration-500 hover:rotate-x-1 hover:shadow-2xl border-canvas-200/50"
        onMouseUp={onMouseUp}
      >
        <div className="text-center">
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-canvas-200/30">
            <div className="flex flex-col items-start text-left">
              <span className="text-[10px] font-black text-canvas-400 uppercase tracking-[0.2em] mb-1">
                Date
              </span>
              <span className="text-sm font-bold text-canvas-700">
                {new Date(transaction.date).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>

            <div className="flex flex-col items-center">
              <span className={`text-[9px] font-black uppercase tracking-[0.2em] mb-0.5 ${transaction.amount < 0 ? 'text-finance-expense/60' : 'text-finance-income/60'}`}>
                {transaction.amount < 0 ? 'Expense' : 'Income'}
              </span>
              <span className={`text-xl font-mono font-black tracking-tight ${transaction.amount < 0 ? 'text-finance-expense' : 'text-finance-income'}`}>
                ${Math.abs(transaction.amount).toFixed(2)}
              </span>
            </div>

            <div className="flex gap-6">
              <div className="flex flex-col items-end text-right">
                <span className="text-[9px] font-black text-canvas-400 uppercase tracking-[0.2em] mb-0.5">
                  Account
                </span>
                <span className="text-sm font-black text-brand tracking-tight">
                  {transaction.account_name}
                </span>
              </div>
              {transaction.owner_name && (
                <div className="flex flex-col items-end text-right border-l border-canvas-200/50 pl-6">
                  <span className="text-[9px] font-black text-canvas-400 uppercase tracking-[0.2em] mb-0.5">
                    Owner
                  </span>
                  <span className="text-sm font-black text-canvas-800 tracking-tight">
                    {transaction.owner_name}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="mb-4 flex flex-col items-center">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[9px] font-black text-canvas-400 uppercase tracking-[0.2em]">
                Description
              </span>
            </div>
            <div className="relative group/desc w-full">
              {showOnboardingHint && !selectionRule && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center animate-snap-in pointer-events-none">
                  <div className="bg-brand text-white text-[9px] font-black px-2.5 py-1.5 rounded-lg shadow-brand-glow uppercase tracking-widest flex items-center gap-2 border border-brand/20 backdrop-blur-sm">
                    <Wand2 className="w-3 h-3" />
                    Select text to create rule
                  </div>
                  <div className="w-2 h-2 bg-brand rotate-45 -mt-1 shadow-brand-glow"></div>
                </div>
              )}
              <h2 className="text-xl font-black text-canvas-800 leading-tight select-text selection:bg-brand/20 cursor-text hover:bg-brand/[0.03] rounded-2xl transition-all duration-300 p-3 -m-3">
                {renderDescription()}
              </h2>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
