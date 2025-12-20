import React from 'react';
import { Card, Badge } from '../../../components';

interface Transaction {
  id: number;
  date: string;
  description: string;
  amount: number;
  account_id: number;
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
        className="p-12 mb-4 transform transition-all duration-500 hover:rotate-x-1 hover:shadow-2xl border-canvas-200/50"
        onMouseUp={onMouseUp}
      >
        <div className="text-center">
          <span className="text-xs font-bold text-canvas-500 uppercase tracking-widest mb-4 block">
            {new Date(transaction.date).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>

          <h2 className="text-4xl font-black text-canvas-800 mb-6 leading-tight select-text selection:bg-brand/20">
            {transaction.description}
          </h2>

          <div
            className={`text-5xl font-mono mb-8 ${transaction.amount < 0 ? 'text-finance-expense' : 'text-finance-income'
              }`}
          >
            {transaction.amount < 0 ? '-' : ''}${Math.abs(transaction.amount).toFixed(2)}
          </div>

          <div className="flex gap-2 justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <Badge variant="default" className="bg-canvas-200/50">
              ID: {transaction.id}
            </Badge>
            <Badge variant="default" className="bg-canvas-200/50">
              Acc: {transaction.account_id}
            </Badge>
          </div>
        </div>
      </Card>
    </div>
  );
};
