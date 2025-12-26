import React, { useState, useEffect, useCallback } from 'react';
import {
  AnalysisMonthSelector,
  CategoryMultiSelect,
  GroupedTransactionList
} from './components';
import { database } from '../../../wailsjs/go/models';
import { Card } from '../../components';
import { BarChart3, ArrowUpDown } from 'lucide-react';

type GroupBy = 'All' | 'Category' | 'Owner' | 'Account';
export type SortOrder = 'asc' | 'desc';
export type GroupSortField = 'name' | 'amount';
export type TransactionSortField = 'date' | 'amount';

const Analysis: React.FC = () => {
  const [months, setMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [categories, setCategories] = useState<database.Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [groupBy, setGroupBy] = useState<GroupBy>('All');
  const [transactions, setTransactions] = useState<database.TransactionModel[]>([]);
  const [loading, setLoading] = useState(true);

  const [groupSortField, setGroupSortField] = useState<GroupSortField>('name');
  const [groupSortOrder, setGroupSortOrder] = useState<SortOrder>('asc');
  const [transactionSortField, setTransactionSortField] = useState<TransactionSortField>('date');
  const [transactionSortOrder, setTransactionSortOrder] = useState<SortOrder>('desc');

  const fetchData = useCallback(async () => {
    try {
      const monthList = await (window as any).go.main.App.GetMonthList();
      setMonths(monthList || []);

      if (monthList && monthList.length > 0 && !selectedMonth) {
        setSelectedMonth(monthList[0]);
      }

      const categoryList = await (window as any).go.main.App.GetCategories();
      setCategories(categoryList || []);
    } catch (e) {
      console.error('Failed to fetch initial analysis data', e);
    }
  }, [selectedMonth]);

  const fetchTransactions = useCallback(async () => {
    if (!selectedMonth) return;

    setLoading(true);
    try {
      // Create date range for the selected month
      const [year, month] = selectedMonth.split('-');
      const startDate = `${year}-${month}-01`;
      const endDate = `${year}-${month}-31`; // SQL handles this fine even if month has 30 days

      const txs = await (window as any).go.main.App.GetAnalysisTransactions(
        startDate,
        endDate,
        selectedCategoryIds
      );
      setTransactions(txs || []);
    } catch (e) {
      console.error('Failed to fetch transactions', e);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedCategoryIds]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleSortGroup = (field: GroupSortField) => {
    if (groupSortField === field) {
      setGroupSortOrder(groupSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setGroupSortField(field);
      setGroupSortOrder(field === 'amount' ? 'desc' : 'asc');
    }
  };

  const handleSortTransaction = (field: TransactionSortField) => {
    if (transactionSortField === field) {
      setTransactionSortOrder(transactionSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setTransactionSortField(field);
      setTransactionSortOrder(field === 'date' ? 'desc' : 'asc');
    }
  };

  const handleCategorize = async (txId: number, categoryName: string) => {
    try {
      await (window as any).go.main.App.CategorizeTransaction(txId, categoryName);
      fetchTransactions();
      fetchData();
    } catch (e) {
      console.error('Failed to categorize transaction', e);
    }
  };

  const groupingOptions: GroupBy[] = ['All', 'Category', 'Owner', 'Account'];

  return (
    <div className="min-h-screen bg-canvas-100 texture-delight pt-24 pb-12 px-8">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-brand/10 text-brand rounded-2xl shadow-brand/5 shadow-inner">
              <BarChart3 className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-canvas-800 tracking-tight">Financial Analysis</h1>
              <p className="text-canvas-600 font-medium">Deep dive into your cash flow and spending habits.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <AnalysisMonthSelector
              months={months}
              selectedMonth={selectedMonth}
              onChange={setSelectedMonth}
            />
            <CategoryMultiSelect
              categories={categories}
              selectedCategoryIds={selectedCategoryIds}
              onChange={setSelectedCategoryIds}
            />
          </div>
        </div>

        {/* Summary Cards */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Card key={i} variant="elevated" className="p-6 animate-pulse">
                <div className="h-3 w-20 bg-canvas-200 rounded mb-3"></div>
                <div className="h-8 w-32 bg-canvas-100 rounded"></div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card variant="elevated" className="p-6">
              <div className="text-[10px] font-bold text-canvas-600 uppercase tracking-widest mb-1">Total Income</div>
              <div className="text-2xl font-mono font-bold text-finance-income">
                {new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Math.abs(transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)))}
              </div>
            </Card>
            <Card variant="elevated" className="p-6">
              <div className="text-[10px] font-bold text-canvas-600 uppercase tracking-widest mb-1">Total Expenses</div>
              <div className="text-2xl font-mono font-bold text-finance-expense">
                {new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Math.abs(transactions.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0)))}
              </div>
            </Card>
            <Card variant="elevated" className="p-6 !border-brand/20 shadow-brand-glow">
              <div className="text-[10px] font-bold text-brand uppercase tracking-widest mb-1">Net Flow</div>
              <div className={`text-2xl font-mono font-bold ${transactions.reduce((s, t) => s + t.amount, 0) >= 0 ? 'text-finance-income' : 'text-finance-expense'}`}>
                {new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Math.abs(transactions.reduce((s, t) => s + t.amount, 0)))}
              </div>
            </Card>
          </div>
        )}

        {/* Grouping Toggle */}
        <div className="flex items-center justify-between pb-2 border-b border-canvas-200">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 bg-canvas-50 p-1.5 rounded-2xl border border-canvas-200 shadow-sm">
              {groupingOptions.map((option) => (
                <button
                  key={option}
                  onClick={() => setGroupBy(option)}
                  className={`
                    px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200
                    ${groupBy === option
                      ? 'bg-brand text-white shadow-brand-glow'
                      : 'text-canvas-600 hover:text-canvas-900 hover:bg-canvas-100'}
                  `}
                >
                  {option}
                </button>
              ))}
            </div>

            {groupBy !== 'All' && (
              <div className="flex items-center gap-1 bg-canvas-50 p-1.5 rounded-2xl border border-canvas-200 shadow-sm">
                <button
                  onClick={() => handleSortGroup('name')}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all
                    ${groupSortField === 'name' ? 'bg-brand text-white shadow-brand-glow' : 'text-canvas-600 hover:bg-canvas-100'}
                  `}
                >
                  Name
                  {groupSortField === 'name' && <ArrowUpDown className={`w-3.5 h-3.5 transition-transform ${groupSortOrder === 'desc' ? 'rotate-180' : ''}`} />}
                </button>
                <button
                  onClick={() => handleSortGroup('amount')}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all
                    ${groupSortField === 'amount' ? 'bg-brand text-white shadow-brand-glow' : 'text-canvas-600 hover:bg-canvas-100'}
                  `}
                >
                  Total
                  {groupSortField === 'amount' && <ArrowUpDown className={`w-3.5 h-3.5 transition-transform ${groupSortOrder === 'desc' ? 'rotate-180' : ''}`} />}
                </button>
              </div>
            )}
          </div>
          
          <div className="text-[10px] font-bold text-canvas-500 uppercase tracking-widest">
            {transactions.length} Transactions Found
          </div>
        </div>

        {/* Main Content */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 border-4 border-brand/20 border-t-brand rounded-full animate-spin"></div>
            <p className="text-canvas-600 font-medium animate-pulse">Analyzing your finances...</p>
          </div>
        ) : (
          <GroupedTransactionList
            transactions={transactions}
            categories={categories}
            groupBy={groupBy}
            showSummary={false}
            groupSortField={groupSortField}
            groupSortOrder={groupSortOrder}
            transactionSortField={transactionSortField}
            transactionSortOrder={transactionSortOrder}
            onSortTransaction={handleSortTransaction}
            onCategorize={handleCategorize}
          />
        )}
      </div>
    </div>
  );
};

export default Analysis;
