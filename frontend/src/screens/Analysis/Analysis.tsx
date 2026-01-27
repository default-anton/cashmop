import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { EventsOn } from '../../../wailsjs/runtime/runtime';
import { useFuzzySearch } from '../../hooks/useFuzzySearch';
import {
  GroupedTransactionList
} from './components';
import { database } from '../../../wailsjs/go/models';
import { Button, Modal, ScreenLayout } from '../../components';
import { useToast } from '../../components';
import { BarChart3, ArrowUpDown, Download, AlertTriangle, Trash2 } from 'lucide-react';
import TransactionSearch from './components/TransactionSearch';
import { useCurrency } from '@/contexts/CurrencyContext';
import { formatCents, formatCentsDecimal } from '../../utils/currency';

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
  const [owners, setOwners] = useState<database.User[]>([]);
  const [selectedOwnerIds, setSelectedOwnerIds] = useState<number[]>([]);
  const [groupBy, setGroupBy] = useState<GroupBy>('All');
  const [transactions, setTransactions] = useState<database.TransactionModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const [exporting, setExporting] = useState(false);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const { warning, mainCurrency, updateSettings, settings } = useCurrency();
  const [hasMissingRates, setHasMissingRates] = useState(false);
  const [transactionSearch, setTransactionSearch] = useState('');
  const [groupSortField, setGroupSortField] = useState<GroupSortField>('name');
  const [groupSortOrder, setGroupSortOrder] = useState<SortOrder>('asc');
  const [transactionSortField, setTransactionSortField] = useState<TransactionSortField>('date');
  const [transactionSortOrder, setTransactionSortOrder] = useState<SortOrder>('desc');
  const [selectedTxIds, setSelectedTxIds] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const fetchData = useCallback(async () => {
    try {
      const monthList = await (window as any).go.main.App.GetMonthList();
      setMonths(monthList || []);

      if (monthList && monthList.length > 0 && !selectedMonth) {
        setSelectedMonth(monthList[0]);
      }

      const categoryList = await (window as any).go.main.App.GetCategories();
      setCategories(categoryList || []);

      const ownerList = await (window as any).go.main.App.GetAllUsers();
      setOwners(ownerList || []);
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
        selectedCategoryIds,
        selectedOwnerIds
      );
      setTransactions(txs || []);
    } catch (e) {
      console.error('Failed to fetch transactions', e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [selectedMonth, selectedCategoryIds, selectedOwnerIds]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    if (transactions.length === 0) {
      setHasMissingRates(false);
      return;
    }
    const missing = transactions.some(tx => tx.amount_in_main_currency === null);
    setHasMissingRates(missing);
  }, [transactions]);

  // Reload transactions when FX rates are updated (to get converted amounts)
  useEffect(() => {
    const off = EventsOn('fx-rates-updated', () => {
      fetchTransactions(true); // silent refresh
    });
    return () => off?.();
  }, [fetchTransactions]);

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
        selectedOwnerIds,
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

  const handleSelectionChange = useCallback((id: string | number, selected: boolean) => {
    setSelectedTxIds(prev => {
      const next = new Set(prev);
      if (selected) {
        next.add(Number(id));
      } else {
        next.delete(Number(id));
      }
      return next;
    });
  }, []);

  const handleDeleteSelected = () => {
    if (selectedTxIds.size === 0) return;
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    setDeleteConfirmOpen(false);
    setDeleting(true);
    const count = selectedTxIds.size;
    try {
      const ids = Array.from(selectedTxIds);
      await (window as any).go.main.App.DeleteTransactions(ids);
      setSelectedTxIds(new Set());
      toast.showToast(
        `Deleted ${count} transaction${count !== 1 ? 's' : ''}`,
        'success'
      );
      await fetchTransactions();
    } catch (e) {
      console.error('Delete failed', e);
      toast.showToast(
        e instanceof Error ? e.message : 'Failed to delete transactions. Please try again.',
        'error'
      );
    } finally {
      setDeleting(false);
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
      formatCentsDecimal(tx.amount),
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
      main_amount: tx.amount_in_main_currency ?? null,
    }))
  ), [displayedTransactions]);

  const formatMonthLabel = useCallback((monthStr: string) => {
    if (!monthStr) return '';
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1);
    return date.toLocaleDateString('default', { month: 'short', year: 'numeric' });
  }, []);

  const monthOptions = useMemo(() => (
    months.map((month) => ({ value: month, label: formatMonthLabel(month) }))
  ), [months, formatMonthLabel]);

  const hasForeignCurrency = useMemo(() => {
    const main = mainCurrency.toUpperCase();
    return transactions.some((tx) => (tx.currency || mainCurrency).toUpperCase() !== main);
  }, [mainCurrency, transactions]);

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
            owners={owners}
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
            selectedOwnerIds={selectedOwnerIds}
            onOwnerFilterChange={setSelectedOwnerIds}
            monthOptions={monthOptions}
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            selectedTxIds={selectedTxIds}
            onSelectionChange={handleSelectionChange}
            onDeleteSelected={handleDeleteSelected}
          />
        )}
      </div>

      <Modal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title="Delete Transactions"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-canvas-600 select-none">
            Delete {selectedTxIds.size} transaction{selectedTxIds.size !== 1 ? 's' : ''}? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-finance-expense hover:bg-finance-expense/90 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </ScreenLayout>
  );
};

export default Analysis;
