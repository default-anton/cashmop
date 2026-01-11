import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useFuzzySearch } from '../../hooks/useFuzzySearch';
import {
  GroupedTransactionList
} from './components';
import { database } from '../../../wailsjs/go/models';
import { Card, ScreenLayout } from '../../components';
import { useToast } from '../../components';
import { BarChart3, ArrowUpDown, Download, AlertTriangle } from 'lucide-react';
import TransactionSearch from './components/TransactionSearch';
import { useCurrency } from '../../contexts/CurrencyContext';

type GroupBy = 'All' | 'Category' | 'Owner' | 'Account';
export type SortOrder = 'asc' | 'desc';
export type GroupSortField = 'name' | 'amount';
export type TransactionSortField = 'date' | 'amount' | 'account_name' | 'category_name' | 'owner_name';
type ExportFormat = 'csv' | 'xlsx';

const Analysis: React.FC = () => {
  const toast = useToast();
  const [months, setMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [categories, setCategories] = useState<database.Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [groupBy, setGroupBy] = useState<GroupBy>('All');
  const [transactions, setTransactions] = useState<database.TransactionModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const [exporting, setExporting] = useState(false);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const { warning, mainCurrency, updateSettings, convertAmount, settings } = useCurrency();
  const [fxAmounts, setFxAmounts] = useState<Map<number, number | null>>(new Map());
  const [hasMissingRates, setHasMissingRates] = useState(false);
  const [transactionSearch, setTransactionSearch] = useState('');
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

  const fetchTransactions = useCallback(async (silent = false) => {
    if (!selectedMonth) return;

    if (!silent) setLoading(true);
    try {
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
      if (!silent) setLoading(false);
    }
  }, [selectedMonth, selectedCategoryIds]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    let cancelled = false;
    const compute = async () => {
      if (transactions.length === 0) {
        setFxAmounts(new Map());
        setHasMissingRates(false);
        return;
      }
      const next = new Map<number, number | null>();
      let missing = false;
      await Promise.all(transactions.map(async (tx) => {
        const converted = await convertAmount(tx.amount, tx.currency || mainCurrency, tx.date);
        if (converted === null) missing = true;
        next.set(tx.id, converted);
      }));
      if (!cancelled) {
        setFxAmounts(next);
        setHasMissingRates(missing);
      }
    };
    compute();
    return () => {
      cancelled = true;
    };
  }, [convertAmount, mainCurrency, transactions]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setExportDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
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
    setTransactions(prev => prev.map(tx =>
      tx.id === txId ? { ...tx, category_name: categoryName } : tx
    ));

    try {
      await (window as any).go.main.App.CategorizeTransaction(txId, categoryName);
      fetchTransactions(true);
      fetchData();
    } catch (e) {
      console.error('Failed to categorize transaction', e);
      fetchTransactions(true);
    }
  };
  const handleExport = async (format?: ExportFormat) => {
    const targetFormat = format || exportFormat;

    if (!selectedMonth) {
      toast.showToast('Please select a month first', 'error');
      return;
    }

    setExporting(true);
    setExportDropdownOpen(false);
    try {
      const [year, month] = selectedMonth.split('-');
      const startDate = `${year}-${month}-01`;
      const endDate = `${year}-${month}-31`;

      const rowsExported = await (window as any).go.main.App.ExportTransactionsWithDialog(
        startDate,
        endDate,
        selectedCategoryIds,
        targetFormat
      );

      toast.showToast(
        `Successfully exported ${rowsExported} transaction${rowsExported !== 1 ? 's' : ''} to ${targetFormat.toUpperCase()}`,
        'success'
      );
    } catch (e) {
      console.error('Export failed', e);
      toast.showToast(
        e instanceof Error ? e.message : 'Export failed. Please try again.',
        'error'
      );
    } finally {
      setExporting(false);
    }
  };

  const displayWarning = hasMissingRates
    ? {
        tone: 'error' as const,
        title: 'Exchange rates missing',
        detail: 'Some transactions are missing rates. Converted totals exclude those items.',
      }
    : warning;
  const buildTransactionSearchLabel = useCallback((tx: database.TransactionModel) => {
    const parts = [
      tx.description || '',
      tx.account_name || '',
      tx.category_name || 'Uncategorized',
      tx.owner_name || 'No Owner',
      tx.date,
      Math.abs(tx.amount).toFixed(2),
      tx.currency || mainCurrency,
    ];
    return `${parts.join(' | ')} ::${tx.id}`;
  }, [mainCurrency]);

  const filteredTransactions = useFuzzySearch(
    transactions,
    buildTransactionSearchLabel,
    transactionSearch
  );
  const searchActive = transactionSearch.trim().length > 0;
  const displayedTransactions = useMemo(() => (
    searchActive ? filteredTransactions : transactions
  ), [filteredTransactions, searchActive, transactions]);
  const displayedTransactionsWithFx = useMemo(() => (
    displayedTransactions.map((tx) => ({
      ...tx,
      main_amount: fxAmounts.get(tx.id) ?? null,
    }))
  ), [displayedTransactions, fxAmounts]);

  const formatMonthLabel = useCallback((monthStr: string) => {
    if (!monthStr) return '';
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1);
    return date.toLocaleDateString('default', { month: 'short', year: 'numeric' });
  }, []);

  const monthOptions = useMemo(() => (
    months.map((month) => ({ value: month, label: formatMonthLabel(month) }))
  ), [months, formatMonthLabel]);
  const formatCurrency = useCallback((amount: number) => (
    new Intl.NumberFormat('en-CA', { style: 'currency', currency: mainCurrency }).format(Math.abs(amount))
  ), [mainCurrency]);

  const hasForeignCurrency = useMemo(() => {
    const main = mainCurrency.toUpperCase();
    return transactions.some((tx) => (tx.currency || mainCurrency).toUpperCase() !== main);
  }, [mainCurrency, transactions]);

  const totals = useMemo(() => {
    const amounts = displayedTransactionsWithFx
      .map((tx) => tx.main_amount)
      .filter((val): val is number => typeof val === 'number');
    const income = amounts.filter((val) => val > 0).reduce((sum, val) => sum + val, 0);
    const expenses = amounts.filter((val) => val < 0).reduce((sum, val) => sum + val, 0);
    const net = amounts.reduce((sum, val) => sum + val, 0);
    return { income, expenses, net };
  }, [displayedTransactionsWithFx]);

  const uniqueGroups = useMemo(() => {
    if (transactions.length === 0) {
      return { category: false, owner: false, account: false };
    }
    const categories = new Set(transactions.map(tx => tx.category_name));
    const owners = new Set(transactions.map(tx => tx.owner_name));
    const accounts = new Set(transactions.map(tx => tx.account_name));
    return {
      category: categories.size > 1,
      owner: owners.size > 1,
      account: accounts.size > 1,
    };
  }, [transactions]);

  const groupingOptions: GroupBy[] = useMemo(() => {
    const options: GroupBy[] = ['All'];
    if (uniqueGroups.category) options.push('Category');
    if (uniqueGroups.owner) options.push('Owner');
    if (uniqueGroups.account) options.push('Account');
    return options;
  }, [uniqueGroups]);

  useEffect(() => {
    if (!groupingOptions.includes(groupBy)) {
      setGroupBy('All');
    }
  }, [groupingOptions, groupBy]);

  return (
    <ScreenLayout size="wide">
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-brand/10 text-brand rounded-2xl shadow-brand/5 shadow-inner">
              <BarChart3 className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-canvas-800 tracking-tight select-none">Financial Analysis</h1>
              <p className="text-canvas-600 font-medium select-none">Deep dive into your cash flow and spending habits.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative" ref={exportDropdownRef}>
              <button
                onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
                disabled={exporting}
                className={`
                  p-2 rounded-lg transition-all
                  ${exporting
                    ? 'bg-canvas-100 text-canvas-400 cursor-not-allowed'
                    : 'text-canvas-500 hover:text-canvas-700 hover:bg-canvas-200'
                  }
                `}
                title="Export transactions"
              >
                {exporting ? (
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Download className="w-5 h-5" />
                )}
              </button>

              {exportDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 w-36 bg-canvas-50 rounded-lg border border-canvas-200 shadow-card overflow-hidden z-10">
                  <button
                    onClick={() => handleExport('csv')}
                    disabled={!selectedMonth}
                    className="w-full px-3 py-2 text-left text-sm font-medium text-canvas-700 hover:bg-brand/5 hover:text-brand disabled:text-canvas-400 disabled:cursor-not-allowed transition-colors select-none"
                  >
                    CSV
                  </button>
                  <button
                    onClick={() => handleExport('xlsx')}
                    disabled={!selectedMonth}
                    className="w-full px-3 py-2 text-left text-sm font-medium text-canvas-700 hover:bg-brand/5 hover:text-brand disabled:text-canvas-400 disabled:cursor-not-allowed transition-colors select-none"
                  >
                    Excel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {displayWarning && (
          <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
            displayWarning.tone === 'error'
              ? 'bg-finance-expense/10 border-finance-expense/20 text-finance-expense'
              : 'bg-yellow-100 border-yellow-300 text-yellow-800'
          }`}>
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 select-none" />
            <div>
              <p className="text-sm font-semibold select-none">{displayWarning.title}</p>
              <p className="text-sm select-none">{displayWarning.detail}</p>
            </div>
          </div>
        )}

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
              <div className="text-[10px] font-bold text-canvas-600 uppercase tracking-widest mb-1 select-none">Total Income</div>
              <div className="text-2xl font-mono font-bold text-finance-income">
                {formatCurrency(totals.income)}
              </div>
            </Card>
            <Card variant="elevated" className="p-6">
              <div className="text-[10px] font-bold text-canvas-600 uppercase tracking-widest mb-1 select-none">Total Expenses</div>
              <div className="text-2xl font-mono font-bold text-finance-expense">
                {formatCurrency(totals.expenses)}
              </div>
            </Card>
            <Card variant="elevated" className="p-6 !border-brand/20 shadow-brand-glow">
              <div className="text-[10px] font-bold text-brand uppercase tracking-widest mb-1 select-none">Net Flow</div>
              <div className={`text-2xl font-mono font-bold ${totals.net >= 0 ? 'text-finance-income' : 'text-finance-expense'}`}>
                {formatCurrency(totals.net)}
              </div>
            </Card>
          </div>
        )}

        <div className="flex items-center justify-between pb-2 border-b border-canvas-200">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 bg-canvas-50 p-1.5 rounded-2xl border border-canvas-200 shadow-sm">
              {groupingOptions.map((option) => (
                <button
                  key={option}
                  onClick={() => setGroupBy(option)}
                  className={`
                    px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 select-none
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
                    flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all select-none
                    ${groupSortField === 'name' ? 'bg-brand text-white shadow-brand-glow' : 'text-canvas-600 hover:bg-canvas-100'}
                  `}
                >
                  Name
                  {groupSortField === 'name' && <ArrowUpDown className={`w-3.5 h-3.5 transition-transform ${groupSortOrder === 'desc' ? 'rotate-180' : ''}`} />}
                </button>
                <button
                  onClick={() => handleSortGroup('amount')}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all select-none
                    ${groupSortField === 'amount' ? 'bg-brand text-white shadow-brand-glow' : 'text-canvas-600 hover:bg-canvas-100'}
                  `}
                >
                  Total
                  {groupSortField === 'amount' && <ArrowUpDown className={`w-3.5 h-3.5 transition-transform ${groupSortOrder === 'desc' ? 'rotate-180' : ''}`} />}
                </button>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <TransactionSearch
              value={transactionSearch}
              onChange={setTransactionSearch}
              onClear={() => setTransactionSearch('')}
            />
            <div className="text-[10px] font-bold text-canvas-500 uppercase tracking-widest select-none">
              {searchActive
                ? `${displayedTransactions.length} of ${transactions.length} Transactions`
                : `${transactions.length} Transactions Found`}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 border-4 border-brand/20 border-t-brand rounded-full animate-spin"></div>
            <p className="text-canvas-600 font-medium animate-pulse select-none">Analyzing your finances...</p>
          </div>
        ) : (
          <GroupedTransactionList
            transactions={displayedTransactionsWithFx}
            categories={categories}
            groupBy={groupBy}
            showSummary={false}
            groupSortField={groupSortField}
            groupSortOrder={groupSortOrder}
            transactionSortField={transactionSortField}
            transactionSortOrder={transactionSortOrder}
            onSortTransaction={handleSortTransaction}
            onCategorize={handleCategorize}
            selectedCategoryIds={selectedCategoryIds}
            onCategoryFilterChange={setSelectedCategoryIds}
            monthOptions={monthOptions}
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
          />
        )}
      </div>
    </ScreenLayout>
  );
};

export default Analysis;
