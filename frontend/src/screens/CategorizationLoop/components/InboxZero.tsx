import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '../../../components';

interface InboxZeroProps {
  onRefresh: () => void;
}

export const InboxZero: React.FC<InboxZeroProps> = ({ onRefresh }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center animate-snap-in">
      <div className="w-20 h-20 bg-finance-income/10 rounded-full flex items-center justify-center mb-6 text-finance-income">
        <CheckCircle2 className="w-10 h-10" />
      </div>
      <h2 className="text-3xl font-bold text-canvas-800 mb-2">Inbox Zero!</h2>
      <p className="text-canvas-500 max-w-md">
        All your transactions are categorized. You're a financial wizard!
      </p>
      <Button onClick={onRefresh} variant="primary" className="mt-8">
        Refresh
      </Button>
    </div>
  );
};
