import React, { useMemo } from 'react';
import { database } from '../../../../wailsjs/go/models';
import { User, Tag, Landmark, List } from 'lucide-react';
import { Card } from '../../../components';
import Table from '../../../components/Table';

type GroupBy = 'All' | 'Category' | 'Owner' | 'Account';

interface GroupedTransactionListProps {
  transactions: database.TransactionModel[];
  groupBy: GroupBy;
  showSummary?: boolean;
}

const GroupedTransactionList: React.FC<GroupedTransactionListProps> = ({
  transactions,
  groupBy,
  showSummary = true,
}) => {
  const formatCurrency = (amount: number) => {
    const formatter = new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
    });
    return formatter.format(Math.abs(amount));
  };

  const columns = useMemo(() => {
    const cols: any[] = [
      {
        key: 'date',
        header: 'Date',
        className: 'w-32 whitespace-nowrap font-mono text-[10px] font-bold tracking-tight text-canvas-500',
      },
      {
        key: 'description',
        header: 'Description',
        className: 'font-medium text-canvas-800',
      },
    ];

    if (groupBy !== 'Account') {
      cols.push({
        key: 'account_name',
        header: 'Account',
        className: 'text-[10px] text-canvas-500 tracking-tight',
      });
    }

    if (groupBy !== 'Category') {
      cols.push({
        key: 'category_name',
        header: 'Category',
        render: (val: string) => val || 'Uncategorized',
        className: 'text-[10px] text-canvas-500 tracking-tight',
      });
    }

    if (groupBy !== 'Owner') {
      cols.push({
        key: 'owner_name',
        header: 'Owner',
        render: (val: string) => val || 'No Owner',
        className: 'text-[10px] text-canvas-500 tracking-tight',
      });
    }

    cols.push({
      key: 'amount',
      header: 'Amount',
      className: 'text-right font-mono font-bold w-40 whitespace-nowrap',
      render: (amount: number) => (
        <span className={amount >= 0 ? 'text-finance-income' : 'text-finance-expense'}>
          {formatCurrency(amount)}
        </span>
      ),
    });

    return cols;
  }, [groupBy]);

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

  const netTotal = transactions.reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <div className="w-full space-y-6 animate-snap-in">
      {/* Summary Cards */}
      {showSummary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card variant="elevated" className="p-6">
            <div className="text-[10px] font-bold text-canvas-400 uppercase tracking-widest mb-1">Total Income</div>
            <div className="text-2xl font-mono font-bold text-finance-income">
              {formatCurrency(transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0))}
            </div>
          </Card>
          <Card variant="elevated" className="p-6">
            <div className="text-[10px] font-bold text-canvas-400 uppercase tracking-widest mb-1">Total Expenses</div>
            <div className="text-2xl font-mono font-bold text-finance-expense">
              {formatCurrency(transactions.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0))}
            </div>
          </Card>
          <Card variant="elevated" className="p-6 !border-brand/20 shadow-brand-glow">
            <div className="text-[10px] font-bold text-brand uppercase tracking-widest mb-1">Net Flow</div>
            <div className={`text-2xl font-mono font-bold ${netTotal >= 0 ? 'text-finance-income' : 'text-finance-expense'}`}>
              {formatCurrency(netTotal)}
            </div>
          </Card>
        </div>
      )}

      {/* Grouped Lists */}
      <div className="space-y-4">
        {groups.map(([name, data]) => (
          <Card key={name} variant="elevated" className="overflow-hidden">
            <div className="px-6 py-4 bg-canvas-100/50 border-b border-canvas-200 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-xl shadow-sm text-canvas-400">
                  {getIcon()}
                </div>
                <h3 className="font-bold text-canvas-800">{name}</h3>
                <span className="text-xs font-mono text-canvas-600 bg-canvas-200 px-2 py-0.5 rounded-full">
                  {data.transactions.length} txns
                </span>
              </div>
              <div className={`font-mono font-bold ${data.total >= 0 ? 'text-finance-income' : 'text-finance-expense'}`}>
                {formatCurrency(data.total)}
              </div>
            </div>

            <Table
              columns={columns}
              data={data.transactions}
              className="!border-none !rounded-none shadow-none"
            />
          </Card>
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
