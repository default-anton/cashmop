import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, BarChart3, Download } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { EVENT_CATEGORIES_UPDATED, EVENT_OWNERS_UPDATED, EVENT_TRANSACTIONS_UPDATED } from "@/utils/events";
import { MISSING_FILTER_ID } from "@/utils/filterIds";
import { database } from "../../../wailsjs/go/models";
import { EventsOn } from "../../../wailsjs/runtime/runtime";
import { Button, Modal, ScreenLayout, useToast } from "../../components";
import { useFuzzySearch } from "../../hooks/useFuzzySearch";
import { formatCentsDecimal } from "../../utils/currency";
import { GroupedTransactionList } from "./components";
import TransactionSearch from "./components/TransactionSearch";

type GroupBy = "All" | "Category" | "Owner" | "Account";
export type SortOrder = "asc" | "desc";
export type GroupSortField = "name" | "amount";
export type TransactionSortField = "date" | "amount" | "account_name" | "category_name" | "owner_name";
type ExportFormat = "csv" | "xlsx";

const Analysis: React.FC = () => {
  const toast = useToast();
  const [months, setMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [categories, setCategories] = useState<database.Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [owners, setOwners] = useState<database.User[]>([]);
  const [selectedOwnerIds, setSelectedOwnerIds] = useState<number[]>([]);
  const [groupBy, setGroupBy] = useState<GroupBy>("All");
  const [transactions, setTransactions] = useState<database.TransactionModel[]>([]);
  const [analysisFacets, setAnalysisFacets] = useState<database.AnalysisFacets | null>(null);

  const [loading, setLoading] = useState(true);
  const [exportFormat, _setExportFormat] = useState<ExportFormat>("csv");
  const [exporting, setExporting] = useState(false);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const { warning, mainCurrency } = useCurrency();
  const [hasMissingRates, setHasMissingRates] = useState(false);
  const [transactionSearch, setTransactionSearch] = useState("");
  const groupSortField: GroupSortField = "amount";
  const groupSortOrder: SortOrder = "desc";
  const [transactionSortField, setTransactionSortField] = useState<TransactionSortField>("date");
  const [transactionSortOrder, setTransactionSortOrder] = useState<SortOrder>("desc");
  const [selectedTxIds, setSelectedTxIds] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const fetchData = useCallback(async () => {
    try {
      const monthList = await (window as any).go.main.App.GetMonthList();
      const nextMonths = monthList || [];
      setMonths(nextMonths);
      setSelectedMonth((prev) => {
        if (nextMonths.length === 0) return "";
        if (!prev || !nextMonths.includes(prev)) return nextMonths[0];
        return prev;
      });

      const categoryList = await (window as any).go.main.App.GetCategories();
      setCategories(categoryList || []);

      const ownerList = await (window as any).go.main.App.GetAllUsers();
      setOwners(ownerList || []);
    } catch (e) {
      console.error("Failed to fetch initial analysis data", e);
    }
  }, []);

  const fetchAnalysisView = useCallback(
    async (silent = false) => {
      if (!selectedMonth) return;

      if (!silent) {
        setLoading(true);
        setAnalysisFacets(null);
      }
      try {
        const [year, month] = selectedMonth.split("-");
        const startDate = `${year}-${month}-01`;
        const endDate = `${year}-${month}-31`; // SQL handles this fine even if month has 30 days

        const raw = await (window as any).go.main.App.GetAnalysisView(
          startDate,
          endDate,
          selectedCategoryIds,
          selectedOwnerIds,
        );
        const view = database.AnalysisView.createFrom(raw || {});
        setTransactions(view.transactions || []);
        setAnalysisFacets(
          view.facets ||
            database.AnalysisFacets.createFrom({
              categories: [],
              owners: [],
              has_uncategorized: false,
              has_no_owner: false,
            }),
        );
      } catch (e) {
        console.error("Failed to fetch analysis view", e);
        setTransactions([]);
        setAnalysisFacets(
          database.AnalysisFacets.createFrom({
            categories: [],
            owners: [],
            has_uncategorized: false,
            has_no_owner: false,
          }),
        );
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [selectedMonth, selectedCategoryIds, selectedOwnerIds],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  useEffect(() => {
    fetchAnalysisView();
  }, [fetchAnalysisView]);

  useEffect(() => {
    setSelectedTxIds(new Set());
  }, [selectedMonth]);

  useEffect(() => {
    if (transactions.length === 0) {
      setHasMissingRates(false);
      return;
    }
    const missing = transactions.some((tx) => tx.amount_in_main_currency === null);
    setHasMissingRates(missing);
  }, [transactions]);

  // Reload transactions when FX rates are updated (to get converted amounts)
  useEffect(() => {
    const off = EventsOn("fx-rates-updated", () => {
      fetchAnalysisView(true); // silent refresh
    });
    return () => off?.();
  }, [fetchAnalysisView]);

  const refreshDebounceRef = useRef<number | null>(null);
  const scheduleRefresh = useCallback(() => {
    if (refreshDebounceRef.current) {
      window.clearTimeout(refreshDebounceRef.current);
    }
    refreshDebounceRef.current = window.setTimeout(async () => {
      await fetchData();
      fetchAnalysisView(true);
    }, 50);
  }, [fetchAnalysisView, fetchData]);

  useEffect(() => {
    const offs = [
      EventsOn(EVENT_TRANSACTIONS_UPDATED, scheduleRefresh),
      EventsOn(EVENT_CATEGORIES_UPDATED, scheduleRefresh),
      EventsOn(EVENT_OWNERS_UPDATED, scheduleRefresh),
    ];

    return () => {
      offs.forEach((off) => {
        off?.();
      });
      if (refreshDebounceRef.current) {
        window.clearTimeout(refreshDebounceRef.current);
      }
    };
  }, [scheduleRefresh]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setExportDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const handleSortTransaction = (field: TransactionSortField) => {
    if (transactionSortField === field) {
      setTransactionSortOrder(transactionSortOrder === "asc" ? "desc" : "asc");
    } else {
      setTransactionSortField(field);
      setTransactionSortOrder(field === "date" ? "desc" : "asc");
    }
  };
  const handleCategorize = async (txId: number, categoryName: string) => {
    setTransactions((prev) => prev.map((tx) => (tx.id === txId ? { ...tx, category_name: categoryName } : tx)));

    try {
      await (window as any).go.main.App.CategorizeTransaction(txId, categoryName);
      fetchAnalysisView(true);
      fetchData();
    } catch (e) {
      console.error("Failed to categorize transaction", e);
      fetchAnalysisView(true);
    }
  };
  const handleExport = async (format?: ExportFormat) => {
    const targetFormat = format || exportFormat;

    if (!selectedMonth) {
      toast.showToast("Please select a month first", "error");
      return;
    }

    setExporting(true);
    setExportDropdownOpen(false);
    try {
      const [year, month] = selectedMonth.split("-");
      const startDate = `${year}-${month}-01`;
      const endDate = `${year}-${month}-31`;

      const rowsExported = await (window as any).go.main.App.ExportTransactionsWithDialog(
        startDate,
        endDate,
        selectedCategoryIds,
        selectedOwnerIds,
        targetFormat,
      );

      toast.showToast(
        `Successfully exported ${rowsExported} transaction${rowsExported !== 1 ? "s" : ""} to ${targetFormat.toUpperCase()}`,
        "success",
      );
    } catch (e) {
      console.error("Export failed", e);
      toast.showToast(e instanceof Error ? e.message : "Export failed. Please try again.", "error");
    } finally {
      setExporting(false);
    }
  };

  const handleSelectionChange = useCallback((id: string | number, selected: boolean) => {
    setSelectedTxIds((prev) => {
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
      toast.showToast(`Deleted ${count} transaction${count !== 1 ? "s" : ""}`, "success");
      await fetchAnalysisView();
      fetchData();
    } catch (e) {
      console.error("Delete failed", e);
      toast.showToast(e instanceof Error ? e.message : "Failed to delete transactions. Please try again.", "error");
    } finally {
      setDeleting(false);
    }
  };

  const displayWarning = hasMissingRates
    ? {
        tone: "error" as const,
        title: "Exchange rates missing",
        detail: "Some transactions are missing rates. Converted totals exclude those items.",
      }
    : warning;
  const buildTransactionSearchLabel = useCallback(
    (tx: database.TransactionModel) => {
      const parts = [
        tx.description || "",
        tx.account_name || "",
        tx.category_name || "Uncategorized",
        tx.owner_name || "No Owner",
        tx.date,
        formatCentsDecimal(tx.amount),
        tx.currency || mainCurrency,
      ];
      return `${parts.join(" | ")} ::${tx.id}`;
    },
    [mainCurrency],
  );

  const filteredTransactions = useFuzzySearch(transactions, buildTransactionSearchLabel, transactionSearch);
  const searchActive = transactionSearch.trim().length > 0;
  const displayedTransactions = useMemo(
    () => (searchActive ? filteredTransactions : transactions),
    [filteredTransactions, searchActive, transactions],
  );
  const displayedTransactionsWithFx = useMemo(
    () =>
      displayedTransactions.map((tx) => ({
        ...tx,
        main_amount: tx.amount_in_main_currency ?? null,
      })),
    [displayedTransactions],
  );

  const formatMonthLabel = useCallback((monthStr: string) => {
    if (!monthStr) return "";
    const [year, month] = monthStr.split("-");
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1);
    return date.toLocaleDateString("default", { month: "short", year: "numeric" });
  }, []);

  const monthOptions = useMemo(
    () => months.map((month) => ({ value: month, label: formatMonthLabel(month) })),
    [months, formatMonthLabel],
  );

  const filterCategories = useMemo(() => analysisFacets?.categories || [], [analysisFacets]);

  const filterOwners = useMemo(() => analysisFacets?.owners || [], [analysisFacets]);

  const includeUncategorizedInFilter = analysisFacets?.has_uncategorized || false;
  const includeNoOwnerInFilter = analysisFacets?.has_no_owner || false;

  useEffect(() => {
    if (!analysisFacets) return;

    const allowed = new Set<number>(filterCategories.map((c) => c.id));
    if (includeUncategorizedInFilter) allowed.add(MISSING_FILTER_ID);

    const next = selectedCategoryIds.filter((id) => allowed.has(id));
    if (next.length !== selectedCategoryIds.length) {
      setSelectedCategoryIds(next);
    }
  }, [analysisFacets, filterCategories, includeUncategorizedInFilter, selectedCategoryIds]);

  useEffect(() => {
    if (!analysisFacets) return;

    const allowed = new Set<number>(filterOwners.map((o) => o.id));
    if (includeNoOwnerInFilter) allowed.add(MISSING_FILTER_ID);

    const next = selectedOwnerIds.filter((id) => allowed.has(id));
    if (next.length !== selectedOwnerIds.length) {
      setSelectedOwnerIds(next);
    }
  }, [analysisFacets, filterOwners, includeNoOwnerInFilter, selectedOwnerIds]);

  const groupingOptions: GroupBy[] = ["All", "Category", "Owner", "Account"];

  return (
    <ScreenLayout size="wide">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3.5 bg-gradient-to-br from-brand/20 to-indigo-400/20 text-brand rounded-3xl border border-brand/25 shadow-brand-glow">
              <BarChart3 className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-canvas-900 tracking-tight select-none">Financial Analysis</h1>
              <p className="text-canvas-600 text-base font-semibold mt-1 select-none">
                Money pulse, trend radar, and spend receipts in one view.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative" ref={exportDropdownRef}>
              <motion.button
                onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
                disabled={exporting}
                whileHover={exporting ? undefined : { y: -1 }}
                whileTap={exporting ? undefined : { scale: 0.98 }}
                transition={{ type: "spring", stiffness: 450, damping: 28 }}
                className={`
                  inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border transition-all
                  ${
                    exporting
                      ? "bg-canvas-100 text-canvas-400 border-canvas-200 cursor-not-allowed"
                      : "text-canvas-600 border-canvas-200 bg-canvas-50 hover:text-canvas-900 hover:border-brand/35 hover:bg-brand/[0.06]"
                  }
                `}
                title="Export transactions"
                aria-label="Export transactions"
              >
                {exporting ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span className="text-xs font-semibold uppercase tracking-[0.08em] select-none">Export</span>
              </motion.button>

              <AnimatePresence>
                {exportDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-40 bg-canvas-50/95 rounded-2xl border border-canvas-200 shadow-card overflow-hidden z-10 backdrop-blur-md"
                  >
                    <button
                      onClick={() => handleExport("csv")}
                      disabled={!selectedMonth}
                      className="w-full px-4 py-2.5 text-left text-sm font-medium text-canvas-700 hover:bg-brand/10 hover:text-brand disabled:text-canvas-400 disabled:cursor-not-allowed transition-colors select-none"
                    >
                      CSV
                    </button>
                    <button
                      onClick={() => handleExport("xlsx")}
                      disabled={!selectedMonth}
                      className="w-full px-4 py-2.5 text-left text-sm font-medium text-canvas-700 hover:bg-brand/10 hover:text-brand disabled:text-canvas-400 disabled:cursor-not-allowed transition-colors select-none"
                    >
                      Excel
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {displayWarning && (
          <div
            className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 ${
              displayWarning.tone === "error"
                ? "bg-finance-expense/10 border-finance-expense/25 text-finance-expense"
                : "bg-yellow-100 border-yellow-300 text-yellow-800"
            }`}
          >
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 select-none" />
            <div>
              <p className="text-sm font-bold select-none">{displayWarning.title}</p>
              <p className="text-sm select-none">{displayWarning.detail}</p>
            </div>
          </div>
        )}

        <motion.div
          layout
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="flex flex-wrap items-center justify-between gap-3 pt-1"
        >
          <div className="flex items-center gap-2 bg-canvas-50/90 p-1 rounded-2xl border border-canvas-200 shadow-sm w-fit">
            <span className="text-[10px] font-semibold text-canvas-500 uppercase tracking-[0.1em] pl-2 pr-1 select-none">
              Group by
            </span>
            {groupingOptions.map((option) => (
              <motion.button
                key={option}
                onClick={() => setGroupBy(option)}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 450, damping: 28 }}
                className={`
                  px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 select-none
                  ${
                    groupBy === option
                      ? "bg-gradient-to-r from-brand to-indigo-500 text-white shadow-brand-glow"
                      : "text-canvas-600 hover:text-canvas-900 hover:bg-canvas-100"
                  }
                `}
              >
                {option}
              </motion.button>
            ))}
          </div>

          <div className="flex items-center min-w-0">
            <TransactionSearch
              value={transactionSearch}
              onChange={setTransactionSearch}
              onClear={() => setTransactionSearch("")}
            />
          </div>
        </motion.div>

        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-4 rounded-3xl border border-canvas-200/80 bg-canvas-50/70">
            <div className="w-12 h-12 border-4 border-brand/25 border-t-brand rounded-full animate-spin"></div>
            <p className="text-canvas-600 font-semibold animate-pulse select-none">Crunching your numbers...</p>
          </div>
        ) : (
          <GroupedTransactionList
            transactions={displayedTransactionsWithFx}
            categories={categories}
            owners={owners}
            filterCategories={filterCategories}
            filterOwners={filterOwners}
            includeUncategorizedInFilter={includeUncategorizedInFilter}
            includeNoOwnerInFilter={includeNoOwnerInFilter}
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
            Delete {selectedTxIds.size} transaction{selectedTxIds.size !== 1 ? "s" : ""}? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={deleting}
              className="!bg-finance-expense hover:!bg-finance-expense/90 !text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </div>
      </Modal>
    </ScreenLayout>
  );
};

export default Analysis;
