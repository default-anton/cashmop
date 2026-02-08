import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Landmark, List, Tag, Trash2, User } from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { MISSING_FILTER_ID } from "@/utils/filterIds";
import type { database } from "../../../../wailsjs/go/models";
import {
  Card,
  CategoryFilterContent,
  type FilterConfig,
  Input,
  OwnerFilterContent,
  TableHeaderFilter,
} from "../../../components";
import Table from "../../../components/Table";
import { formatCents, formatCentsDecimal } from "../../../utils/currency";
import type { GroupSortField, SortOrder, TransactionSortField } from "../Analysis";
import CategoryGhostInput from "./CategoryGhostInput";

type GroupBy = "All" | "Category" | "Owner" | "Account";

type TransactionWithFx = database.TransactionModel & { main_amount: number | null };

interface GroupedTransactionListProps {
  transactions: TransactionWithFx[];

  // Full lists (used for editing cells, etc.)
  categories: database.Category[];
  owners: database.User[];

  // Filter lists (used only for filter dropdown options)
  filterCategories?: { id: number; name: string }[];
  filterOwners?: { id: number; name: string }[];
  includeUncategorizedInFilter?: boolean;
  includeNoOwnerInFilter?: boolean;

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
  selectedOwnerIds?: number[];
  onOwnerFilterChange?: (ids: number[]) => void;
  monthOptions: { value: string; label: string }[];
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  selectedTxIds?: Set<number>;
  onSelectionChange?: (id: string | number, selected: boolean) => void;
  onDeleteSelected?: () => void;
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
          inline-flex items-center px-2.5 py-1 rounded-lg text-[15px] font-medium tracking-tight cursor-pointer transition-all duration-300
          ${
            showSuccess
              ? "bg-finance-income/10 text-finance-income border border-finance-income/30"
              : "bg-brand/5 text-brand border border-brand/20 hover:bg-brand/10 hover:border-brand/30"
          }
        `}
      >
        {showSuccess && <Check className="w-3.5 h-3.5 mr-1" />}
        {transaction.category_name || "Uncategorized"}
      </span>
    </div>
  );
};

const GroupedTransactionList: React.FC<GroupedTransactionListProps> = ({
  transactions,
  categories,
  owners,
  filterCategories,
  filterOwners,
  includeUncategorizedInFilter = true,
  includeNoOwnerInFilter = true,
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
  selectedOwnerIds = [],
  onOwnerFilterChange,
  monthOptions,
  selectedMonth,
  onMonthChange,
  selectedTxIds = new Set(),
  onSelectionChange,
  onDeleteSelected,
}) => {
  const [categoryFilterSearch, setCategoryFilterSearch] = useState("");
  const categoryFilterInputRef = useRef<HTMLInputElement>(null);
  const [ownerFilterSearch, setOwnerFilterSearch] = useState("");
  const ownerFilterInputRef = useRef<HTMLInputElement>(null);
  const [monthFilterSearch, setMonthFilterSearch] = useState("");
  const [filteredMonthOptions, setFilteredMonthOptions] = useState(monthOptions);
  const [activeFilter, setActiveFilter] = useState<"category" | "owner" | "date" | null>(null);
  const [monthHighlightedIndex, setMonthHighlightedIndex] = useState(0);
  const { mainCurrency } = useCurrency();

  const categoriesForFilter = filterCategories ?? categories;
  const ownersForFilter = filterOwners ?? owners;

  useEffect(() => {
    if (activeFilter === "category" && categoryFilterInputRef.current) {
      // Small delay to ensure the popover is rendered
      setTimeout(() => {
        categoryFilterInputRef.current?.focus();
      }, 50);
    }
  }, [activeFilter]);

  useEffect(() => {
    if (activeFilter === "owner" && ownerFilterInputRef.current) {
      setTimeout(() => {
        ownerFilterInputRef.current?.focus();
      }, 50);
    }
  }, [activeFilter]);

  useEffect(() => {
    if (activeFilter === "date") {
      setMonthFilterSearch("");
      const selectedIndex = filteredMonthOptions.findIndex((option) => option.value === selectedMonth);
      setMonthHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    }
  }, [activeFilter, filteredMonthOptions, selectedMonth]);

  useEffect(() => {
    setActiveFilter(null);
  }, [groupBy]);

  useEffect(() => {
    if (!monthFilterSearch.trim()) {
      setFilteredMonthOptions(monthOptions);
      setMonthHighlightedIndex(0);
      return;
    }
    const labels = monthOptions.map((option) => option.label);
    (window as any).go.main.App.FuzzySearch(monthFilterSearch, labels).then((rankedLabels: string[]) => {
      const ranked = rankedLabels
        .map((label) => monthOptions.find((option) => option.label === label))
        .filter((option): option is { value: string; label: string } => !!option);
      setFilteredMonthOptions(ranked);
      setMonthHighlightedIndex(0);
    });
  }, [monthFilterSearch, monthOptions]);

  const groups = useMemo(() => {
    const grouped = new Map<string, { transactions: TransactionWithFx[]; total: number }>();

    transactions.forEach((tx) => {
      let key = "";
      if (groupBy === "Owner") key = tx.owner_name || "No Owner";
      else if (groupBy === "Category") key = tx.category_name || "Uncategorized";
      else if (groupBy === "Account") key = tx.account_name;
      else if (groupBy === "All") key = "All Transactions";

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
        if (transactionSortField === "date") {
          comparison = a.date.localeCompare(b.date);
        } else if (transactionSortField === "account_name") {
          comparison = (a.account_name || "").localeCompare(b.account_name || "");
        } else if (transactionSortField === "category_name") {
          comparison = (a.category_name || "Uncategorized").localeCompare(b.category_name || "Uncategorized");
        } else if (transactionSortField === "owner_name") {
          comparison = (a.owner_name || "No Owner").localeCompare(b.owner_name || "No Owner");
        } else {
          const aAmount = a.main_amount;
          const bAmount = b.main_amount;
          if (aAmount === null && bAmount === null) comparison = 0;
          else if (aAmount === null) comparison = 1;
          else if (bAmount === null) comparison = -1;
          else comparison = Math.abs(aAmount) - Math.abs(bAmount);
        }
        return transactionSortOrder === "asc" ? comparison : -comparison;
      });
    });

    const result = Array.from(grouped.entries());

    result.sort((a, b) => {
      let comparison = 0;
      if (groupSortField === "name") {
        comparison = a[0].localeCompare(b[0]);
      } else {
        comparison = Math.abs(a[1].total) - Math.abs(b[1].total);
      }
      return groupSortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [transactions, groupBy, groupSortField, groupSortOrder, transactionSortField, transactionSortOrder]);

  const columns = useMemo(() => {
    const cols: any[] = [
      {
        key: "checkbox",
        isCheckbox: true,
      },
      {
        key: "date",
        header: "Date",
        className: "w-24",
        sortable: true,
        render: (dateStr: string) => {
          const date = new Date(`${dateStr}T00:00:00`);
          const dayMonth = date.toLocaleDateString("default", { day: "2-digit", month: "short" });
          return <span className="font-medium text-canvas-700">{dayMonth}</span>;
        },
      },
      {
        key: "description",
        header: "Description",
      },
    ];

    if (groupBy !== "Account") {
      cols.push({
        key: "account_name",
        header: "Account",
        className: "w-44",
        sortable: true,
        render: (val: string) => <span className="text-canvas-700">{val}</span>,
      });
    }

    cols.push({
      key: "category_name",
      header: "Category",
      className: "w-40",
      sortable: true,
      render: (_val: string, tx: database.TransactionModel) => (
        <EditableCategoryCell transaction={tx} categories={categories} onSave={onCategorize} />
      ),
    });

    if (groupBy !== "Owner") {
      cols.push({
        key: "owner_name",
        header: "Owner",
        className: "w-32",
        sortable: true,
        render: (val: string) => <span className="text-canvas-700">{val || "No Owner"}</span>,
      });
    }

    cols.push({
      key: "amount",
      header: `AMOUNT (${mainCurrency})`,
      className: "text-right w-36 whitespace-nowrap",
      sortable: true,
      render: (_amount: number, tx: TransactionWithFx) => {
        const txCurrency = (tx.currency || mainCurrency).toUpperCase();
        const main = mainCurrency.toUpperCase();
        const showOriginal = txCurrency !== main;
        const amount = tx.main_amount;
        const formatted = formatCents(amount, mainCurrency);
        const [symbol, value] = formatted !== "—" ? [formatted.slice(0, 1), formatted.slice(1)] : ["", "—"];
        return (
          <div className="flex flex-col items-end gap-0.5">
            <div
              className={`flex items-baseline justify-end gap-0.5 ${amount === null ? "text-canvas-400" : amount >= 0 ? "text-finance-income" : "text-finance-expense"}`}
            >
              {symbol && <span className="text-[10px] opacity-40 font-sans tracking-tighter">{symbol}</span>}
              <span className="font-mono text-[15px] tracking-tight">{value}</span>
            </div>
            {showOriginal && (
              <span
                className={`text-[13px] font-sans ${tx.amount < 0 ? "text-finance-expense/70" : "text-finance-income/70"}`}
              >
                {txCurrency} {formatCentsDecimal(Math.abs(tx.amount))}
              </span>
            )}
          </div>
        );
      },
    });

    return cols;
  }, [categories, groupBy, mainCurrency, onCategorize]);
  const selectedMonthLabel = useMemo(
    () => monthOptions.find((option) => option.value === selectedMonth)?.label,
    [monthOptions, selectedMonth],
  );

  const monthTabs = useMemo(() => {
    const recent = monthOptions.slice(0, 3);
    const selected = monthOptions.find((option) => option.value === selectedMonth);

    if (!selected) return recent;
    if (recent.some((option) => option.value === selected.value)) return recent;

    return [...recent, selected];
  }, [monthOptions, selectedMonth]);

  const monthFilterConfig: FilterConfig = {
    type: "date",
    isActive: !!selectedMonth,
    label: selectedMonthLabel || "All",
  };

  const categoryFilterConfig: FilterConfig = {
    type: "category",
    isActive: selectedCategoryIds.length > 0,
    label: selectedCategoryIds.length > 0 ? `${selectedCategoryIds.length} selected` : "All",
  };

  const ownerFilterConfig: FilterConfig = {
    type: "category",
    isActive: selectedOwnerIds.length > 0,
    label: selectedOwnerIds.length > 0 ? `${selectedOwnerIds.length} selected` : "All",
  };

  const getIcon = () => {
    if (groupBy === "Owner") return <User className="w-4 h-4" />;
    if (groupBy === "Category") return <Tag className="w-4 h-4" />;
    if (groupBy === "All") return <List className="w-4 h-4" />;
    return <Landmark className="w-4 h-4" />;
  };

  const netTotal = transactions.reduce((sum, tx) => sum + (tx.main_amount ?? 0), 0);
  const selectedCount = selectedTxIds.size;

  return (
    <div className="w-full space-y-6">
      {showSummary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card variant="elevated" className="p-6 bg-gradient-to-br from-finance-income/10 to-canvas-50">
            <div className="text-[10px] font-extrabold text-canvas-600 uppercase tracking-[0.14em] mb-1 select-none">
              Total Income
            </div>
            <div className="text-2xl font-mono font-bold text-finance-income">
              {formatCents(
                transactions.filter((t) => (t.main_amount ?? 0) > 0).reduce((s, t) => s + (t.main_amount ?? 0), 0),
                mainCurrency,
              )}
            </div>
          </Card>
          <Card variant="elevated" className="p-6 bg-gradient-to-br from-finance-expense/10 to-canvas-50">
            <div className="text-[10px] font-extrabold text-canvas-600 uppercase tracking-[0.14em] mb-1 select-none">
              Total Expenses
            </div>
            <div className="text-2xl font-mono font-bold text-finance-expense">
              {formatCents(
                transactions.filter((t) => (t.main_amount ?? 0) < 0).reduce((s, t) => s + (t.main_amount ?? 0), 0),
                mainCurrency,
              )}
            </div>
          </Card>
          <Card
            variant="elevated"
            className="p-6 !border-brand/30 shadow-brand-glow bg-gradient-to-br from-brand/10 to-brand-soft/70"
          >
            <div className="text-[10px] font-extrabold text-brand uppercase tracking-[0.14em] mb-1 select-none">
              Net Flow
            </div>
            <div
              className={`text-2xl font-mono font-bold ${netTotal >= 0 ? "text-finance-income" : "text-finance-expense"}`}
            >
              {formatCents(netTotal, mainCurrency)}
            </div>
          </Card>
        </div>
      )}

      <motion.div
        layout
        className="flex flex-wrap items-center justify-between gap-3 border-b border-canvas-200/80 pb-3"
      >
        <div className="flex flex-wrap items-center gap-2.5">
          {monthOptions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 bg-canvas-50/90 p-1.5 rounded-2xl border border-canvas-200 shadow-sm">
              {monthTabs.map((option) => (
                <motion.button
                  key={option.value}
                  onClick={() => {
                    onMonthChange(option.value);
                    setActiveFilter(null);
                    setMonthFilterSearch("");
                  }}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 450, damping: 28 }}
                  className={
                    option.value === selectedMonth
                      ? "px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 select-none bg-gradient-to-r from-brand to-brand-alt text-white shadow-brand-glow"
                      : "px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 select-none text-canvas-600 hover:text-canvas-900 hover:bg-canvas-100"
                  }
                >
                  {option.label}
                </motion.button>
              ))}

              <TableHeaderFilter
                config={monthFilterConfig}
                ariaLabel="Month filter"
                isOpen={activeFilter === "date"}
                onOpenChange={(open) => setActiveFilter(open ? "date" : null)}
                positionKey={`analysis-filter-month-${groupBy}`}
                renderTrigger={({ buttonRef, isOpen, onToggle, ariaLabel }) => (
                  <motion.button
                    ref={buttonRef}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggle();
                    }}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 450, damping: 28 }}
                    className={
                      isOpen
                        ? "px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 select-none bg-canvas-100 text-canvas-900"
                        : "px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 select-none text-canvas-600 hover:text-canvas-900 hover:bg-canvas-100"
                    }
                    aria-label={ariaLabel}
                    title="Choose month"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      All months
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </span>
                  </motion.button>
                )}
              >
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-extrabold text-canvas-600 uppercase tracking-[0.14em] select-none">
                      Filter by Month
                    </span>
                    {selectedMonthLabel && (
                      <span className="text-[10px] font-extrabold text-canvas-500 uppercase tracking-[0.14em] select-none">
                        {selectedMonthLabel}
                      </span>
                    )}
                  </div>
                  <Input
                    value={monthFilterSearch}
                    onChange={(e) => setMonthFilterSearch(e.target.value)}
                    placeholder="Search months..."
                    className="w-full"
                    autoFocus
                    onKeyDown={(event) => {
                      if (filteredMonthOptions.length === 0) return;
                      if (event.key === "ArrowDown") {
                        event.preventDefault();
                        setMonthHighlightedIndex((prev) => Math.min(prev + 1, filteredMonthOptions.length - 1));
                      }
                      if (event.key === "ArrowUp") {
                        event.preventDefault();
                        setMonthHighlightedIndex((prev) => Math.max(prev - 1, 0));
                      }
                      if (event.key === "Enter") {
                        event.preventDefault();
                        const selected = filteredMonthOptions[monthHighlightedIndex];
                        if (!selected) return;
                        onMonthChange(selected.value);
                        setActiveFilter(null);
                        setMonthFilterSearch("");
                      }
                    }}
                  />
                  <div className="max-h-56 overflow-y-auto -mx-1 px-1">
                    {filteredMonthOptions.length === 0 ? (
                      <div className="px-3 py-6 text-center text-xs text-canvas-500 select-none">No months found.</div>
                    ) : (
                      filteredMonthOptions.map((option, index) => {
                        const isSelected = option.value === selectedMonth;
                        const isHighlighted = index === monthHighlightedIndex;
                        return (
                          <button
                            key={option.value}
                            onClick={() => {
                              onMonthChange(option.value);
                              setActiveFilter(null);
                              setMonthFilterSearch("");
                            }}
                            className={
                              isSelected
                                ? "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-colors select-none bg-brand/[0.12] text-brand font-semibold"
                                : isHighlighted
                                  ? "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-colors select-none bg-canvas-100 text-canvas-800"
                                  : "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-colors select-none text-canvas-700 hover:bg-canvas-100"
                            }
                          >
                            <span>{option.label}</span>
                            {isSelected && <Check className="w-4 h-4" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </TableHeaderFilter>
            </div>
          )}

          {onCategoryFilterChange && (
            <TableHeaderFilter
              variant="bar"
              titleLabel="Category"
              config={categoryFilterConfig}
              ariaLabel="Category filter"
              onClear={() => {
                onCategoryFilterChange([]);
                setActiveFilter(null);
              }}
              isOpen={activeFilter === "category"}
              onOpenChange={(open) => setActiveFilter(open ? "category" : null)}
              positionKey={`analysis-filter-category-${groupBy}`}
            >
              <CategoryFilterContent
                categories={categoriesForFilter}
                selectedIds={selectedCategoryIds}
                includeUncategorized={includeUncategorizedInFilter}
                onSelect={(id) => {
                  const newSelection = selectedCategoryIds.includes(id)
                    ? selectedCategoryIds.filter((sid) => sid !== id)
                    : [...selectedCategoryIds, id];
                  onCategoryFilterChange(newSelection);
                }}
                onSelectOnly={(id) => {
                  onCategoryFilterChange([id]);
                }}
                onSelectAll={() => {
                  const ids = categoriesForFilter.map((c) => c.id);
                  onCategoryFilterChange(includeUncategorizedInFilter ? [MISSING_FILTER_ID, ...ids] : ids);
                }}
                onClear={() => {
                  onCategoryFilterChange([]);
                  setActiveFilter(null);
                }}
                searchTerm={categoryFilterSearch}
                onSearchChange={setCategoryFilterSearch}
                inputRef={categoryFilterInputRef}
              />
            </TableHeaderFilter>
          )}

          {onOwnerFilterChange && (
            <TableHeaderFilter
              variant="bar"
              titleLabel="Owner"
              config={ownerFilterConfig}
              ariaLabel="Owner filter"
              onClear={() => {
                onOwnerFilterChange([]);
                setActiveFilter(null);
              }}
              isOpen={activeFilter === "owner"}
              onOpenChange={(open) => setActiveFilter(open ? "owner" : null)}
              positionKey={`analysis-filter-owner-${groupBy}`}
            >
              <OwnerFilterContent
                owners={ownersForFilter}
                selectedIds={selectedOwnerIds}
                includeNoOwner={includeNoOwnerInFilter}
                onSelect={(id) => {
                  const newSelection = selectedOwnerIds.includes(id)
                    ? selectedOwnerIds.filter((sid) => sid !== id)
                    : [...selectedOwnerIds, id];
                  onOwnerFilterChange(newSelection);
                }}
                onSelectOnly={(id) => {
                  onOwnerFilterChange([id]);
                }}
                onSelectAll={() => {
                  const ids = ownersForFilter.map((o) => o.id);
                  onOwnerFilterChange(includeNoOwnerInFilter ? [MISSING_FILTER_ID, ...ids] : ids);
                }}
                onClear={() => {
                  onOwnerFilterChange([]);
                  setActiveFilter(null);
                }}
                searchTerm={ownerFilterSearch}
                onSearchChange={setOwnerFilterSearch}
                inputRef={ownerFilterInputRef}
              />
            </TableHeaderFilter>
          )}
        </div>

        {selectedCount > 0 && onDeleteSelected && (
          <button
            onClick={onDeleteSelected}
            className="ml-auto inline-flex items-center gap-2 rounded-xl border border-finance-expense/35 bg-finance-expense/10 px-3 py-2 text-sm font-bold text-finance-expense transition-colors hover:bg-finance-expense/15"
          >
            <Trash2 className="h-4 w-4" />
            Delete ({selectedCount})
          </button>
        )}
      </motion.div>

      <div className="space-y-4 relative">
        <AnimatePresence mode="popLayout" initial={false}>
          {groups.map(([name, data]) => (
            <motion.div
              key={name}
              layout="position"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 40,
                mass: 1,
                opacity: { duration: 0.15 },
                layout: { duration: 0.25 },
              }}
            >
              <Card variant="elevated" className="overflow-hidden">
                <div className="px-6 py-[18px] bg-canvas-100/65 border-b border-canvas-200/80 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-canvas-50 rounded-xl border border-canvas-200 shadow-sm text-brand select-none">
                      {getIcon()}
                    </div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-canvas-900 text-lg">{name}</h3>
                    </div>
                    <span className="text-sm font-mono text-canvas-600 bg-canvas-200 px-2.5 py-0.5 rounded-full select-none">
                      {data.transactions.length} transactions
                    </span>
                  </div>
                  <div>
                    <div
                      className={`font-mono font-bold text-lg ${data.total >= 0 ? "text-finance-income" : "text-finance-expense"}`}
                    >
                      {formatCents(data.total, mainCurrency)}
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
                  selectedIds={selectedTxIds}
                  onSelectionChange={onSelectionChange}
                />
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>

        {groups.length === 0 && (
          <motion.div
            layout="position"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 40,
              mass: 1,
              opacity: { duration: 0.15 },
              layout: { duration: 0.25 },
            }}
          >
            <Card variant="elevated" className="overflow-hidden">
              <div className="px-6 py-[18px] bg-canvas-100/65 border-b border-canvas-200/80 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-canvas-50 rounded-xl border border-canvas-200 shadow-sm text-brand select-none">
                    {getIcon()}
                  </div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-canvas-900 text-lg">
                      {groupBy === "Owner"
                        ? "No Owner"
                        : groupBy === "Category"
                          ? "Uncategorized"
                          : groupBy === "Account"
                            ? transactions[0]?.account_name || "No Account"
                            : "All Transactions"}
                    </h3>
                  </div>
                  <span className="text-sm font-mono text-canvas-600 bg-canvas-200 px-2.5 py-0.5 rounded-full select-none">
                    0 transactions
                  </span>
                </div>
                <div className="font-mono font-bold text-canvas-400 select-none">{formatCents(0, mainCurrency)}</div>
              </div>

              <Table
                columns={columns}
                data={[]}
                className="!border-none !rounded-none shadow-none"
                sortField={transactionSortField}
                sortOrder={transactionSortOrder}
                onSort={(field) => onSortTransaction(field as TransactionSortField)}
                selectedIds={selectedTxIds}
                onSelectionChange={onSelectionChange}
              />
            </Card>

            <div className="py-10 text-center">
              <p className="text-canvas-600 font-semibold select-none">No transactions found for this selection.</p>
              <p className="text-sm text-canvas-500 mt-1 select-none">
                Try widening filters to bring more activity into view.
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default GroupedTransactionList;
