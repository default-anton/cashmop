import React, { useMemo } from 'react';
import { database } from '../../../../wailsjs/go/models';
import { User, Tag, Landmark, ChevronRight, List } from 'lucide-react';

type GroupBy = 'All' | 'Category' | 'Owner' | 'Account';

interface GroupedTransactionListProps {
  transactions: database.TransactionModel[];
  groupBy: GroupBy;
}

const GroupedTransactionList: React.FC<GroupedTransactionListProps> = ({
  transactions,
  groupBy,
}) => {
  const groups = useMemo(() => {
    const grouped = new Map<string, { transactions: database.TransactionModel[]; total: number }>();

    transactions.forEach((tx) => {
      let key = '';
      if (groupBy === 'Owner') key = tx.owner_name || 'No Owner';
      else if (groupBy === 'Category') key = tx.category_name || 'Uncategorized';
      else if (groupBy === 'Account') key = tx.account_name;
      else if (groupBy === 'All') key = 'All Transactions';

      const group = grouped.get(key) || { transactions: [], total: 0 };
      group.transactions.push(tx);
      group.total += tx.amount;
      grouped.set(key, group);
    });

    // Sort groups by total amount (descending for expense-heavy groups, or just by name)
    return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [transactions, groupBy]);

  const getIcon = () => {
    if (groupBy === 'Owner') return <User className="w-4 h-4" />;
    if (groupBy === 'Category') return <Tag className="w-4 h-4" />;
    if (groupBy === 'All') return <List className="w-4 h-4" />;
    return <Landmark className="w-4 h-4" />;
  };

  const formatCurrency = (amount: number) => {
    const formatter = new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
    });
    return formatter.format(amount);
  };

  const netTotal = transactions.reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <div className="w-full space-y-6 animate-snap-in">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-canvas-50 p-6 rounded-3xl border border-canvas-200 shadow-sm">
          <div className="text-[10px] font-bold text-canvas-400 uppercase tracking-widest mb-1">Total Income</div>
          <div className="text-2xl font-mono font-bold text-finance-income">
            {formatCurrency(transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0))}
          </div>
        </div>
        <div className="bg-canvas-50 p-6 rounded-3xl border border-canvas-200 shadow-sm">
          <div className="text-[10px] font-bold text-canvas-400 uppercase tracking-widest mb-1">Total Expenses</div>
          <div className="text-2xl font-mono font-bold text-finance-expense">
            {formatCurrency(Math.abs(transactions.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0)))}
          </div>
        </div>
        <div className="bg-canvas-50 p-6 rounded-3xl border border-brand/20 shadow-brand-glow">
          <div className="text-[10px] font-bold text-brand uppercase tracking-widest mb-1">Net Flow</div>
          <div className={`text-2xl font-mono font-bold ${netTotal >= 0 ? 'text-finance-income' : 'text-finance-expense'}`}>
            {formatCurrency(netTotal)}
          </div>
        </div>
      </div>

      {/* Grouped Lists */}
      <div className="space-y-4">
        {groups.map(([name, data]) => (
          <div key={name} className="bg-canvas-50 rounded-3xl border border-canvas-200 overflow-hidden shadow-sm">
            <div className="px-6 py-4 bg-canvas-100/50 border-b border-canvas-200 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-xl shadow-sm text-canvas-400">
                  {getIcon()}
                </div>
                <h3 className="font-bold text-canvas-800">{name}</h3>
                <span className="text-xs font-mono text-canvas-400 bg-canvas-200/50 px-2 py-0.5 rounded-full">
                  {data.transactions.length} txns
                </span>
              </div>
              <div className={`font-mono font-bold ${data.total >= 0 ? 'text-finance-income' : 'text-finance-expense'}`}>
                {formatCurrency(data.total)}
              </div>
            </div>

            <div className="divide-y divide-canvas-100">
              {data.transactions.map((tx) => (
                <div key={tx.id} className="px-6 py-3 flex items-center justify-between hover:bg-canvas-100/30 transition-colors group">
                  <div className="flex flex-col">
                    <span className="text-sm text-canvas-800 font-medium">{tx.description}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-mono text-canvas-400">{tx.date}</span>
                      <span className="text-canvas-300">·</span>
                      <span className="text-[10px] text-canvas-500 uppercase tracking-tighter">{tx.account_name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`text-sm font-mono font-bold ${tx.amount >= 0 ? 'text-finance-income' : 'text-finance-expense'}`}>
                      {formatCurrency(tx.amount)}
                    </span>
                    <ChevronRight className="w-4 h-4 text-canvas-200 group-hover:text-canvas-400 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {groups.length === 0 && (
          <div className="py-20 text-center">
            <div className="inline-flex p-6 bg-canvas-100 rounded-full mb-4">
              <Tag className="w-8 h-8 text-canvas-300" />
            </div>
            <p className="text-canvas-500">No transactions found for this selection.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupedTransactionList;
