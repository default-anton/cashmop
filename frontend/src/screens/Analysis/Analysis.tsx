import React, { useState, useEffect, useCallback } from 'react';
import {
  AnalysisMonthSelector,
  CategoryMultiSelect,
  GroupedTransactionList
} from './components';
import { database } from '../../../wailsjs/go/models';

type GroupBy = 'Owner' | 'Category' | 'Account';

const Analysis: React.FC = () => {
  const [months, setMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [categories, setCategories] = useState<database.Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [groupBy, setGroupBy] = useState<GroupBy>('Category');
  const [transactions, setTransactions] = useState<database.TransactionModel[]>([]);
  const [loading, setLoading] = useState(true);

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

  const groupingOptions: GroupBy[] = ['Category', 'Owner', 'Account'];

  return (
    <div className="min-h-screen bg-canvas-100 texture-delight pt-24 pb-12 px-8">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header & Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-canvas-900 tracking-tight">Financial Analysis</h1>
            <p className="text-canvas-500">Deep dive into your cash flow and spending habits.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
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

        {/* Grouping Toggle */}
        <div className="flex items-center justify-between bg-canvas-50 p-1.5 rounded-2xl border border-canvas-200 w-fit">
          {groupingOptions.map((option) => (
            <button
              key={option}
              onClick={() => setGroupBy(option)}
              className={`
                px-6 py-2 rounded-xl text-sm font-bold transition-all duration-200
                ${groupBy === option
                  ? 'bg-brand text-white shadow-brand-glow'
                  : 'text-canvas-500 hover:text-canvas-700 hover:bg-canvas-100'}
              `}
            >
              {option}
            </button>
          ))}
        </div>

        {/* Main Content */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 border-4 border-brand/20 border-t-brand rounded-full animate-spin"></div>
            <p className="text-canvas-500 font-medium animate-pulse">Analyzing your finances...</p>
          </div>
        ) : (
          <GroupedTransactionList
            transactions={transactions}
            groupBy={groupBy}
          />
        )}
      </div>
    </div>
  );
};

export default Analysis;
