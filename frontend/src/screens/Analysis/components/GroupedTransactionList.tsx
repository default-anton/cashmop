import React, { useMemo, useState, useEffect, useRef } from 'react';
import { database } from '../../../../wailsjs/go/models';
import { User, Tag, Landmark, List, Calendar, FileText, DollarSign, Check } from 'lucide-react';
import { Card, CategoryFilterContent, FilterConfig } from '../../../components';
import Table from '../../../components/Table';
import { GroupSortField, SortOrder, TransactionSortField } from '../Analysis';
import CategoryGhostInput from './CategoryGhostInput';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrency } from '../../../contexts/CurrencyContext';

type GroupBy = 'All' | 'Category' | 'Owner' | 'Account';

type TransactionWithFx = database.TransactionModel & { main_amount: number | null };

interface GroupedTransactionListProps {
  transactions: TransactionWithFx[];
  categories: database.Category[];
  groupBy: GroupBy;
  showSummary?: boolean;
  groupSortField: GroupSortField;
  groupSortOrder: SortOrder;
  transactionSortField: TransactionSortField;
  transactionSortOrder: SortOrder;
  onSortTransaction: (field: TransactionSortField) => void;
  onCategorize: (txId: number, categoryName: string) => Promise<void>;
  selectedCategoryIds?: number[];
  onCategoryFilterChange?: (ids: number[]) => void;
}

const EditableCategoryCell: React.FC<{
  transaction: database.TransactionModel;
  categories: database.Category[];
  onSave: (txId: number, categoryName: string) => Promise<void>;
}> = ({ transaction, categories, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (showSuccess) {
      const timer = setTimeout(() => setShowSuccess(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [showSuccess]);

  if (isEditing) {
    return (
      <CategoryGhostInput
        categories={categories}
        initialValue={transaction.category_name}
        onSave={async (val) => {
          if (val !== transaction.category_name) {
            await onSave(transaction.id, val);
            setShowSuccess(true);
          }
          setIsEditing(false);
        }}
        onCancel={() => setIsEditing(false)}
      />
    );
  }

  return (
    <div className="relative inline-flex">
      <span 
        onClick={() => setIsEditing(true)}
        className={`
          inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-tight cursor-pointer transition-all duration-300
          ${showSuccess 
            ? 'bg-finance-income/10 text-finance-income border border-finance-income/30' 
            : 'bg-brand/5 text-brand border border-brand/10 hover:bg-brand/10 hover:border-brand/20'
          }
        `}
      >
        {showSuccess && <Check className="w-2 h-2 mr-1" />}
        {transaction.category_name || 'Uncategorized'}
      </span>
    </div>
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
  onSortTransaction,
  onCategorize,
  selectedCategoryIds = [],
  onCategoryFilterChange,
}) => {
  const [categoryFilterOpen, setCategoryFilterOpen] = useState(false);
  const [categoryFilterSearch, setCategoryFilterSearch] = useState('');
  const categoryFilterInputRef = useRef<HTMLInputElement>(null);
  const { mainCurrency, showOriginalCurrency } = useCurrency();

  useEffect(() => {
    if (categoryFilterOpen && categoryFilterInputRef.current) {
      // Small delay to ensure the popover is rendered
      setTimeout(() => {
        categoryFilterInputRef.current?.focus();
      }, 50);
    }
  }, [categoryFilterOpen]);
  const formatCurrency = (amount: number) => {
    const formatter = new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: mainCurrency,
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
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-canvas-100 text-[10px] font-bold text-canvas-600 border border-canvas-200 tracking-tight">
            {val}
          </span>
        ),
      });
    }

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
      ...(onCategoryFilterChange && {
        filter: {
          config: {
            type: 'category',
            isActive: selectedCategoryIds.length > 0,
            label: selectedCategoryIds.length > 0
              ? `✓${selectedCategoryIds.length}`
              : undefined,
          } as FilterConfig,
          onClear: () => {
            onCategoryFilterChange([]);
            setCategoryFilterOpen(false);
          },
          isOpen: categoryFilterOpen,
          onToggle: () => setCategoryFilterOpen(!categoryFilterOpen),
          children: (
            <CategoryFilterContent
              categories={categories}
              selectedIds={selectedCategoryIds}
              onSelect={(id) => {
                const newSelection = selectedCategoryIds.includes(id)
                  ? selectedCategoryIds.filter((sid) => sid !== id)
                  : [...selectedCategoryIds, id];
                onCategoryFilterChange(newSelection);
              }}
              onSelectOnly={(id) => {
                onCategoryFilterChange([id]);
              }}
              onSelectAll={() => onCategoryFilterChange([0, ...categories.map(c => c.id)])}
              onClear={() => {
                onCategoryFilterChange([]);
                setCategoryFilterOpen(false);
              }}
              searchTerm={categoryFilterSearch}
              onSearchChange={setCategoryFilterSearch}
              inputRef={categoryFilterInputRef}
            />
          ),
        },
      }),
    });

    if (groupBy !== 'Owner') {
      cols.push({
        key: 'owner_name',
        header: renderHeader('Owner', User),
        className: 'w-32',
        render: (val: string) => (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-canvas-200 text-[10px] font-bold text-canvas-600 tracking-tight">
            {val || 'No Owner'}
          </span>
        ),
      });
    }

    cols.push({
      key: 'amount',
      header: (
        <div className="flex flex-col items-end">
          {renderHeader(`Amount (${mainCurrency})`, DollarSign, 'justify-end')}
          {showOriginalCurrency && (
            <span className="text-[9px] font-semibold text-canvas-400 mt-0.5">Original</span>
          )}
        </div>
      ),
      className: 'text-right font-mono font-bold w-32 whitespace-nowrap',
      sortable: true,
      render: (_amount: number, tx: TransactionWithFx) => {
        const amount = tx.main_amount;
        const formatted = amount === null ? '—' : formatCurrency(amount);
        const [symbol, value] = formatted !== '—' ? [formatted.slice(0, 1), formatted.slice(1)] : ['', '—'];
        return (
          <div className="flex flex-col items-end gap-0.5">
            <div className={`flex items-baseline justify-end gap-0.5 ${amount === null ? 'text-canvas-400' : amount >= 0 ? 'text-finance-income' : 'text-finance-expense'}`}>
              {symbol && <span className="text-[10px] opacity-40 font-sans tracking-tighter">{symbol}</span>}
              <span className="text-sm tracking-tight">{value}</span>
            </div>
            {showOriginalCurrency && (
              <span className={`text-[10px] font-sans ${tx.amount < 0 ? 'text-finance-expense/70' : 'text-finance-income/70'}`}>
                {tx.currency?.toUpperCase() || mainCurrency} {Math.abs(tx.amount).toFixed(2)}
              </span>
            )}
          </div>
        );
      },
    });

    return cols;
  }, [groupBy, categories, mainCurrency, onCategorize, onCategoryFilterChange, selectedCategoryIds, categoryFilterOpen, categoryFilterSearch, showOriginalCurrency]);

  const groups = useMemo(() => {
    const grouped = new Map<string, { transactions: TransactionWithFx[]; total: number }>();

    transactions.forEach((tx) => {
      let key = '';
      if (groupBy === 'Owner') key = tx.owner_name || 'No Owner';
      else if (groupBy === 'Category') key = tx.category_name || 'Uncategorized';
      else if (groupBy === 'Account') key = tx.account_name;
      else if (groupBy === 'All') key = 'All Transactions';

      const group = grouped.get(key) || { transactions: [], total: 0 };
      group.transactions.push(tx);
      if (tx.main_amount !== null) {
        group.total += tx.main_amount;
      }
      grouped.set(key, group);
    });

    grouped.forEach((data) => {
      data.transactions.sort((a, b) => {
        let comparison = 0;
        if (transactionSortField === 'date') {
          comparison = a.date.localeCompare(b.date);
        } else {
          const aAmount = a.main_amount;
          const bAmount = b.main_amount;
          if (aAmount === null && bAmount === null) comparison = 0;
          else if (aAmount === null) comparison = 1;
          else if (bAmount === null) comparison = -1;
          else comparison = Math.abs(aAmount) - Math.abs(bAmount);
        }
        return transactionSortOrder === 'asc' ? comparison : -comparison;
      });
    });

    const result = Array.from(grouped.entries());

    result.sort((a, b) => {
      let comparison = 0;
      if (groupSortField === 'name') {
        comparison = a[0].localeCompare(b[0]);
      } else {
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

  const netTotal = transactions.reduce((sum, tx) => sum + (tx.main_amount ?? 0), 0);

  return (
    <div className="w-full space-y-6">
      {showSummary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card variant="elevated" className="p-6">
            <div className="text-[10px] font-bold text-canvas-600 uppercase tracking-widest mb-1">Total Income</div>
            <div className="text-2xl font-mono font-bold text-finance-income">
              {formatCurrency(transactions.filter(t => (t.main_amount ?? 0) > 0).reduce((s, t) => s + (t.main_amount ?? 0), 0))}
            </div>
          </Card>
          <Card variant="elevated" className="p-6">
            <div className="text-[10px] font-bold text-canvas-600 uppercase tracking-widest mb-1">Total Expenses</div>
            <div className="text-2xl font-mono font-bold text-finance-expense">
              {formatCurrency(transactions.filter(t => (t.main_amount ?? 0) < 0).reduce((s, t) => s + (t.main_amount ?? 0), 0))}
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

      <div className="space-y-4 relative">
        <AnimatePresence mode="popLayout" initial={false}>
          {groups.map(([name, data]) => (
            <motion.div
              key={name}
              layout
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ 
                type: "spring",
                stiffness: 400,
                damping: 40,
                mass: 1,
                opacity: { duration: 0.15 },
                layout: { duration: 0.25 }
              }}
            >
              <Card variant="elevated" className="overflow-hidden">
                <div className="px-6 py-4 bg-canvas-100/50 border-b border-canvas-200 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-xl shadow-sm text-canvas-400">
                      {getIcon()}
                    </div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-canvas-800">{name}</h3>
                    </div>
                    <span className="text-xs font-mono text-canvas-600 bg-canvas-200 px-2 py-0.5 rounded-full">
                      {data.transactions.length} txns
                    </span>
                  </div>
                  <div>
                    <div className={`font-mono font-bold ${data.total >= 0 ? 'text-finance-income' : 'text-finance-expense'}`}>
                      {formatCurrency(data.total)}
                    </div>
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
            </motion.div>
          ))}
        </AnimatePresence>

        {groups.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Card variant="elevated" className="overflow-hidden">
              <div className="px-6 py-4 bg-canvas-100/50 border-b border-canvas-200 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-xl shadow-sm text-canvas-400">
                    {getIcon()}
                  </div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-canvas-800">
                      {groupBy === 'Owner' ? 'No Owner' :
                       groupBy === 'Category' ? 'Uncategorized' :
                       groupBy === 'Account' ? transactions[0]?.account_name || 'No Account' :
                       'All Transactions'}
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-canvas-600 bg-canvas-200 px-2 py-0.5 rounded-full">
                    0 txns
                  </span>
                </div>
                <div className="font-mono font-bold text-canvas-400">
                  {formatCurrency(0)}
                </div>
              </div>

              <Table
                columns={columns}
                data={[]}
                className="!border-none !rounded-none shadow-none"
                sortField={transactionSortField}
                sortOrder={transactionSortOrder}
                onSort={(field) => onSortTransaction(field as TransactionSortField)}
              />
            </Card>

            <div className="py-8 text-center">
              <p className="text-canvas-500 font-medium">No transactions found for this selection.</p>
              <p className="text-sm text-canvas-400 mt-1">Use the filter above to adjust your selection.</p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default GroupedTransactionList;
