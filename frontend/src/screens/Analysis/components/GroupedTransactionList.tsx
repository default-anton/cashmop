import React, { useMemo, useState } from 'react';
import { database } from '../../../../wailsjs/go/models';
import { User, Tag, Landmark, List, Calendar, FileText, DollarSign, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Card } from '../../../components';
import Table from '../../../components/Table';
import { GroupSortField, SortOrder, TransactionSortField } from '../Analysis';
import CategoryGhostInput from './CategoryGhostInput';

type GroupBy = 'All' | 'Category' | 'Owner' | 'Account';

interface GroupedTransactionListProps {
  transactions: database.TransactionModel[];
  categories: database.Category[];
  groupBy: GroupBy;
  showSummary?: boolean;
  groupSortField: GroupSortField;
  groupSortOrder: SortOrder;
  transactionSortField: TransactionSortField;
  transactionSortOrder: SortOrder;
  onSortGroup: (field: GroupSortField) => void;
  onSortTransaction: (field: TransactionSortField) => void;
  onCategorize: (txId: number, categoryName: string) => Promise<void>;
}

const EditableCategoryCell: React.FC<{
  transaction: database.TransactionModel;
  categories: database.Category[];
  onSave: (txId: number, categoryName: string) => Promise<void>;
}> = ({ transaction, categories, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <CategoryGhostInput
        categories={categories}
        initialValue={transaction.category_name}
        onSave={async (val) => {
          if (val !== transaction.category_name) {
            await onSave(transaction.id, val);
          }
          setIsEditing(false);
        }}
        onCancel={() => setIsEditing(false)}
      />
    );
  }

  return (
    <span 
      onClick={() => setIsEditing(true)}
      className="inline-flex items-center px-2 py-0.5 rounded-md bg-brand/5 text-[10px] font-bold text-brand border border-brand/10 uppercase tracking-tight cursor-pointer hover:bg-brand/10 hover:border-brand/20 transition-all group/tag"
    >
      {transaction.category_name || 'Uncategorized'}
    </span>
  );
};

const GroupedTransactionList: React.FC<GroupedTransactionListProps> = ({
  transactions,
  categories,
  groupBy,
  showSummary = true,
  groupSortField,
  groupSortOrder,
  transactionSortField,
  transactionSortOrder,
  onSortGroup,
  onSortTransaction,
  onCategorize,
}) => {
  const formatCurrency = (amount: number) => {
    const formatter = new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
    });
    return formatter.format(Math.abs(amount));
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00'); // Ensure local timezone
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString('default', { month: 'short' }).toUpperCase();
    return { day, month };
  };

  const columns = useMemo(() => {
    const renderHeader = (label: string, Icon: React.ElementType, alignment: string = 'justify-start') => (
      <div className={`flex items-center gap-1.5 ${alignment}`}>
        <Icon className="w-3 h-3 opacity-90 text-canvas-500" />
        <span className="text-canvas-600">{label}</span>
      </div>
    );

    const cols: any[] = [
      {
        key: 'date',
        header: renderHeader('Date', Calendar),
        className: 'w-24',
        sortable: true,
        render: (dateStr: string) => {
          const { day, month } = formatDate(dateStr);
          return (
            <div className="flex items-center gap-2 group/date">
              <div className="flex flex-col items-center justify-center min-w-[36px] h-[38px] rounded-lg bg-canvas-100 border border-canvas-200 group-hover/date:border-brand/30 group-hover/date:bg-brand/[0.02] transition-colors">
                <span className="text-[10px] font-bold text-canvas-600 leading-none mb-0.5">{month}</span>
                <span className="text-sm font-black text-canvas-700 leading-none">{day}</span>
              </div>
            </div>
          );
        }
      },
      {
        key: 'description',
        header: renderHeader('Description', FileText),
      },
    ];

    if (groupBy !== 'Account') {
      cols.push({
        key: 'account_name',
        header: renderHeader('Account', Landmark),
        className: 'w-40',
        render: (val: string) => (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-canvas-100 text-[10px] font-bold text-canvas-600 border border-canvas-200 uppercase tracking-tight">
            {val}
          </span>
        ),
      });
    }

    if (groupBy !== 'Category') {
      cols.push({
        key: 'category_name',
        header: renderHeader('Category', Tag),
        className: 'w-40',
        render: (_val: string, tx: database.TransactionModel) => (
          <EditableCategoryCell 
            transaction={tx} 
            categories={categories} 
            onSave={onCategorize} 
          />
        ),
      });
    }

    if (groupBy !== 'Owner') {
      cols.push({
        key: 'owner_name',
        header: renderHeader('Owner', User),
        className: 'w-32',
        render: (val: string) => (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-canvas-200 text-[10px] font-bold text-canvas-600 uppercase tracking-tight">
            {val || 'No Owner'}
          </span>
        ),
      });
    }

    cols.push({
      key: 'amount',
      header: renderHeader('Amount', DollarSign, 'justify-end'),
      className: 'text-right font-mono font-bold w-32 whitespace-nowrap',
      sortable: true,
      render: (amount: number) => {
        const formatted = formatCurrency(amount);
        const [symbol, value] = [formatted.slice(0, 1), formatted.slice(1)];
        return (
          <div className={`flex items-baseline justify-end gap-0.5 ${amount >= 0 ? 'text-finance-income' : 'text-finance-expense'}`}>
            <span className="text-[10px] opacity-40 font-sans tracking-tighter">{symbol}</span>
            <span className="text-sm tracking-tight">{value}</span>
          </div>
        );
      },
    });

    return cols;
  }, [groupBy, categories, onCategorize]);

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

    // Sort transactions within each group
    grouped.forEach((data) => {
      data.transactions.sort((a, b) => {
        let comparison = 0;
        if (transactionSortField === 'date') {
          comparison = a.date.localeCompare(b.date);
        } else {
          comparison = Math.abs(a.amount) - Math.abs(b.amount);
        }
        return transactionSortOrder === 'asc' ? comparison : -comparison;
      });
    });

    // Convert to array and sort groups
    const result = Array.from(grouped.entries());

    result.sort((a, b) => {
      let comparison = 0;
      if (groupSortField === 'name') {
        comparison = a[0].localeCompare(b[0]);
      } else {
        // Sort by absolute total amount (usually what people want for expenses)
        comparison = Math.abs(a[1].total) - Math.abs(b[1].total);
      }
      return groupSortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [transactions, groupBy, groupSortField, groupSortOrder, transactionSortField, transactionSortOrder]);

  const getIcon = () => {
    if (groupBy === 'Owner') return <User className="w-4 h-4" />;
    if (groupBy === 'Category') return <Tag className="w-4 h-4" />;
    if (groupBy === 'All') return <List className="w-4 h-4" />;
    return <Landmark className="w-4 h-4" />;
  };

  const netTotal = transactions.reduce((sum, tx) => sum + tx.amount, 0);

  const SortAffordance = ({ active, order }: { active: boolean, order: SortOrder }) => {
    if (active) {
      return order === 'asc' ? <ArrowUp className="w-3 h-3 text-brand" /> : <ArrowDown className="w-3 h-3 text-brand" />;
    }
    return <ArrowUpDown className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />;
  };

  return (
    <div className="w-full space-y-6 animate-snap-in">
      {/* Summary Cards */}
      {showSummary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card variant="elevated" className="p-6">
            <div className="text-[10px] font-bold text-canvas-600 uppercase tracking-widest mb-1">Total Income</div>
            <div className="text-2xl font-mono font-bold text-finance-income">
              {formatCurrency(transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0))}
            </div>
          </Card>
          <Card variant="elevated" className="p-6">
            <div className="text-[10px] font-bold text-canvas-600 uppercase tracking-widest mb-1">Total Expenses</div>
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
              <div 
                className={`flex items-center gap-3 ${groupBy !== 'All' ? 'cursor-pointer group' : ''}`}
                onClick={() => groupBy !== 'All' && onSortGroup('name')}
                title={groupBy !== 'All' ? "Sort by Group Name" : undefined}
              >
                <div className="p-2 bg-white rounded-xl shadow-sm text-canvas-400">
                  {getIcon()}
                </div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-canvas-800">{name}</h3>
                  {groupBy !== 'All' && (
                    <SortAffordance active={groupSortField === 'name'} order={groupSortOrder} />
                  )}
                </div>
                <span className="text-xs font-mono text-canvas-600 bg-canvas-200 px-2 py-0.5 rounded-full">
                  {data.transactions.length} txns
                </span>
              </div>
              <div 
                className={`flex items-center gap-3 cursor-pointer group`}
                onClick={() => onSortGroup('amount')}
                title="Sort by Group Total"
              >
                <div className={`font-mono font-bold ${data.total >= 0 ? 'text-finance-income' : 'text-finance-expense'}`}>
                  {formatCurrency(data.total)}
                </div>
                <SortAffordance active={groupSortField === 'amount'} order={groupSortOrder} />
              </div>
            </div>

            <Table
              columns={columns}
              data={data.transactions}
              className="!border-none !rounded-none shadow-none"
              sortField={transactionSortField}
              sortOrder={transactionSortOrder}
              onSort={(field) => onSortTransaction(field as TransactionSortField)}
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
