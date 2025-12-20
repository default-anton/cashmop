import React from 'react';
import { Card } from '../../../components';

interface Transaction {
  id: number;
  date: string;
  description: string;
  amount: number;
  account_id: number;
  account_name: string;
  owner_name?: string;
}

interface TransactionCardProps {
  transaction: Transaction;
  onMouseUp: () => void;
}

export const TransactionCard: React.FC<TransactionCardProps> = ({ transaction, onMouseUp }) => {
  return (
    <div className="relative group perspective-1000">
      <Card
        variant="glass"
        className="p-10 mb-6 transform transition-all duration-500 hover:rotate-x-1 hover:shadow-2xl border-canvas-200/50"
        onMouseUp={onMouseUp}
      >
        <div className="text-center">
          <div className="flex items-center justify-between mb-10 pb-6 border-b border-canvas-200/30">
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

            <div className="flex gap-10">
              <div className="flex flex-col items-end text-right">
                <span className="text-[10px] font-black text-canvas-400 uppercase tracking-[0.2em] mb-1">
                  Account
                </span>
                <span className="text-base font-black text-brand tracking-tight">
                  {transaction.account_name}
                </span>
              </div>
              {transaction.owner_name && (
                <div className="flex flex-col items-end text-right border-l border-canvas-200/50 pl-10">
                  <span className="text-[10px] font-black text-canvas-400 uppercase tracking-[0.2em] mb-1">
                    Owner
                  </span>
                  <span className="text-base font-black text-canvas-800 tracking-tight">
                    {transaction.owner_name}
                  </span>
                </div>
              )}
            </div>
          </div>

          <h2 className="text-4xl font-black text-canvas-800 mb-8 leading-tight select-text selection:bg-brand/20">
            {transaction.description}
          </h2>

          <div
            className={`text-6xl font-mono mb-4 ${transaction.amount < 0 ? 'text-finance-expense' : 'text-finance-income'
              }`}
          >
            {transaction.amount < 0 ? '-' : ''}${Math.abs(transaction.amount).toFixed(2)}
          </div>

          <div className={`inline-flex items-center px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] ${transaction.amount < 0
            ? 'bg-finance-expense/10 text-finance-expense'
            : 'bg-finance-income/10 text-finance-income'
            }`}>
            {transaction.amount < 0 ? 'Expense' : 'Income'}
          </div>
        </div>
      </Card>
    </div>
  );
};
