import { Check, Plus, Search, X } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCurrency } from "@/contexts/CurrencyContext";
import type { database } from "../../../wailsjs/go/models";
import type { FilterConfig } from "../../components";
import {
  Button,
  Card,
  CategoryFilterContent,
  Modal,
  ScreenLayout,
  Table,
  TableHeaderFilter,
  useToast,
} from "../../components";
import { useFuzzySearch } from "../../hooks/useFuzzySearch";
import { formatCents } from "../../utils/currency";
import RuleEditorModal from "./components/RuleEditorModal";
import RuleManagerHeader from "./components/RuleManagerHeader";
import { buildRuleManagerColumns } from "./components/RuleManagerTableColumns";
import type { MatchType, RuleRow } from "./types";

type SortField = "match_type" | "match_value" | "amount" | "category_name" | "created_at";
type SortOrder = "asc" | "desc";

interface RuleManagerProps {
  initialCategoryIds?: number[];
}

const matchTypeOptions: { value: MatchType; label: string }[] = [
  { value: "contains", label: "Contains" },
  { value: "starts_with", label: "Starts With" },
  { value: "ends_with", label: "Ends With" },
  { value: "exact", label: "Exact" },
];

const RuleManager: React.FC<RuleManagerProps> = ({ initialCategoryIds = [] }) => {
  const toast = useToast();
  const { mainCurrency } = useCurrency();
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [categories, setCategories] = useState<database.Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [ruleSearch, setRuleSearch] = useState("");

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [selectedMatchTypes, setSelectedMatchTypes] = useState<MatchType[]>([]);
  const [categoryFilterSearch, setCategoryFilterSearch] = useState("");
  const categoryFilterInputRef = useRef<HTMLInputElement>(null);

  const [activeFilter, setActiveFilter] = useState<"match_type" | "category" | null>(null);

  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [activeRule, setActiveRule] = useState<RuleRow | null>(null);

  const [confirmRule, setConfirmRule] = useState<RuleRow | null>(null);
  const [confirmMatchCount, setConfirmMatchCount] = useState(0);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    setSelectedCategoryIds(initialCategoryIds);
  }, [initialCategoryIds]);

  useEffect(() => {
    if (activeFilter !== "category") return;
    setTimeout(() => {
      categoryFilterInputRef.current?.focus();
    }, 50);
  }, [activeFilter]);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const [ruleList, categoryList] = await Promise.all([
        (window as any).go.main.App.GetCategorizationRules(),
        (window as any).go.main.App.GetCategories(),
      ]);
      setRules(ruleList || []);
      setCategories(categoryList || []);
    } catch (e) {
      console.error("Failed to fetch rules", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const openCreateModal = () => {
    setActiveRule(null);
    setIsEditorOpen(true);
  };

  const openEditModal = (rule: RuleRow) => {
    setActiveRule(rule);
    setIsEditorOpen(true);
  };

  const closeEditor = () => {
    setIsEditorOpen(false);
    setActiveRule(null);
  };

  const handleDeleteRule = async (rule: RuleRow, uncategorize: boolean) => {
    try {
      const res = await (window as any).go.main.App.DeleteCategorizationRule(rule.id, uncategorize);
      if (uncategorize) {
        toast.showToast(
          `Rule deleted and ${res?.uncategorized_count || 0} transaction${(res?.uncategorized_count || 0) !== 1 ? "s" : ""} uncategorized`,
          "success",
        );
      } else {
        toast.showToast("Rule deleted", "success");
      }
      fetchRules();
    } catch (e) {
      console.error("Failed to delete rule", e);
      toast.showToast("Failed to delete rule", "error");
    } finally {
      setConfirmOpen(false);
      setConfirmRule(null);
    }
  };

  const openDeleteConfirm = async (rule: RuleRow) => {
    setConfirmOpen(true);
    setConfirmRule(rule);
    setConfirmMatchCount(0);
    setConfirmLoading(true);
    try {
      const count = await (window as any).go.main.App.GetRuleMatchCount(rule.id);
      setConfirmMatchCount(count || 0);
    } catch (e) {
      console.error("Failed to fetch rule match count", e);
      setConfirmMatchCount(0);
    } finally {
      setConfirmLoading(false);
    }
  };

  const formatAmountFilter = (rule: RuleRow) => {
    const min = rule.amount_min ?? null;
    const max = rule.amount_max ?? null;

    if (min === null && max === null) return "Any";

    if (min !== null && max !== null) {
      const minAbs = Math.abs(min);
      const maxAbs = Math.abs(max);
      const lower = Math.min(minAbs, maxAbs);
      const upper = Math.max(minAbs, maxAbs);
      return `${formatCents(lower, mainCurrency)} - ${formatCents(upper, mainCurrency)}`;
    }

    if (min !== null) {
      return min < 0 ? `≤ ${formatCents(min, mainCurrency)}` : `≥ ${formatCents(min, mainCurrency)}`;
    }

    return max !== null && max < 0 ? `≥ ${formatCents(max, mainCurrency)}` : `≤ ${formatCents(max || 0, mainCurrency)}`;
  };

  const buildRuleSearchLabel = useCallback((rule: RuleRow) => {
    const parts = [
      rule.match_type,
      rule.match_value,
      rule.amount_min ?? "",
      rule.amount_max ?? "",
      rule.category_name || "Uncategorized",
      rule.created_at || "",
    ];
    return `${parts.join(" | ")} ::${rule.id}`;
  }, []);

  const baseFilteredRules = useMemo(() => {
    let next = [...rules];

    if (selectedCategoryIds.length > 0) {
      next = next.filter((rule) => selectedCategoryIds.includes(rule.category_id));
    }

    if (selectedMatchTypes.length > 0) {
      next = next.filter((rule) => selectedMatchTypes.includes(rule.match_type));
    }

    const getAmountSortValue = (rule: RuleRow) => {
      const min = rule.amount_min ?? null;
      const max = rule.amount_max ?? null;
      if (min === null && max === null) return 0;
      if (min !== null && max !== null) return Math.max(Math.abs(min), Math.abs(max));
      if (min !== null) return Math.abs(min);
      return Math.abs(max || 0);
    };

    const compare = (a: RuleRow, b: RuleRow) => {
      let result = 0;
      switch (sortField) {
        case "match_type":
          result = a.match_type.localeCompare(b.match_type);
          break;
        case "match_value":
          result = a.match_value.localeCompare(b.match_value);
          break;
        case "amount":
          result = getAmountSortValue(a) - getAmountSortValue(b);
          break;
        case "category_name":
          result = (a.category_name || "").localeCompare(b.category_name || "");
          break;
        case "created_at":
          result = new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
          break;
      }
      return sortOrder === "asc" ? result : -result;
    };

    next.sort(compare);
    return next;
  }, [rules, selectedCategoryIds, selectedMatchTypes, sortField, sortOrder]);

  const filteredRules = useFuzzySearch(baseFilteredRules, buildRuleSearchLabel, ruleSearch);
  const hasActiveFilters =
    selectedCategoryIds.length > 0 || selectedMatchTypes.length > 0 || ruleSearch.trim().length > 0;

  const clearAllFilters = () => {
    setRuleSearch("");
    setSelectedMatchTypes([]);
    setSelectedCategoryIds([]);
    setCategoryFilterSearch("");
    setActiveFilter(null);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder(field === "created_at" ? "desc" : "asc");
    }
  };

  const matchTypeFilterConfig: FilterConfig = {
    type: "text",
    isActive: selectedMatchTypes.length > 0,
    label: selectedMatchTypes.length > 0 ? `${selectedMatchTypes.length} selected` : "All",
  };

  const categoryFilterConfig: FilterConfig = {
    type: "category",
    isActive: selectedCategoryIds.length > 0,
    label: selectedCategoryIds.length > 0 ? `${selectedCategoryIds.length} selected` : "All",
  };

  const columns = buildRuleManagerColumns({
    matchTypeOptions,
    formatAmountFilter,
    onEdit: openEditModal,
    onDelete: openDeleteConfirm,
  });

  return (
    <ScreenLayout size="wide">
      <div className="space-y-6">
        <RuleManagerHeader />

        <Card variant="glass" className="overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand/25 border-t-brand" />
              <p className="text-sm font-semibold text-canvas-500 select-none">Loading rules...</p>
            </div>
          ) : (
            <>
              <div className="border-b border-canvas-200/80 bg-canvas-100/50 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <TableHeaderFilter
                      variant="bar"
                      titleLabel="Match Type"
                      config={matchTypeFilterConfig}
                      ariaLabel="Match type filter"
                      onClear={() => {
                        setSelectedMatchTypes([]);
                        setActiveFilter(null);
                      }}
                      isOpen={activeFilter === "match_type"}
                      onOpenChange={(open) => setActiveFilter(open ? "match_type" : null)}
                      positionKey={`rule-manager-filter-match-type-${selectedMatchTypes.length}`}
                    >
                      <div className="space-y-3 p-3">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-xs font-bold uppercase tracking-[0.1em] text-canvas-600 select-none">
                            Filter by type
                          </span>
                          <button
                            onClick={() => setSelectedMatchTypes([])}
                            className="text-xs font-medium text-canvas-500 hover:text-canvas-700 select-none"
                          >
                            Clear
                          </button>
                        </div>
                        <div className="space-y-1.5">
                          {matchTypeOptions.map((option) => {
                            const isActive = selectedMatchTypes.includes(option.value);
                            return (
                              <button
                                key={option.value}
                                onClick={() => {
                                  setSelectedMatchTypes((prev) =>
                                    prev.includes(option.value)
                                      ? prev.filter((t) => t !== option.value)
                                      : [...prev, option.value],
                                  );
                                }}
                                className={`
                                  flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-colors select-none
                                  ${isActive ? "bg-brand/10 font-semibold text-brand" : "text-canvas-700 hover:bg-canvas-100"}
                                `}
                              >
                                <span>{option.label}</span>
                                {isActive && <Check className="h-4 w-4" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </TableHeaderFilter>

                    <TableHeaderFilter
                      variant="bar"
                      titleLabel="Category"
                      config={categoryFilterConfig}
                      ariaLabel="Rule category filter"
                      onClear={() => {
                        setSelectedCategoryIds([]);
                        setActiveFilter(null);
                      }}
                      isOpen={activeFilter === "category"}
                      onOpenChange={(open) => setActiveFilter(open ? "category" : null)}
                      positionKey={`rule-manager-filter-category-${selectedCategoryIds.length}`}
                    >
                      <CategoryFilterContent
                        categories={categories}
                        selectedIds={selectedCategoryIds}
                        includeUncategorized={false}
                        onSelect={(id) => {
                          setSelectedCategoryIds((prev) =>
                            prev.includes(id) ? prev.filter((cid) => cid !== id) : [...prev, id],
                          );
                        }}
                        onSelectOnly={(id, e) => {
                          e?.stopPropagation();
                          setSelectedCategoryIds([id]);
                        }}
                        onSelectAll={() => setSelectedCategoryIds(categories.map((c) => c.id))}
                        onClear={() => {
                          setSelectedCategoryIds([]);
                          setActiveFilter(null);
                        }}
                        searchTerm={categoryFilterSearch}
                        onSearchChange={setCategoryFilterSearch}
                        inputRef={categoryFilterInputRef}
                      />
                    </TableHeaderFilter>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <div className="relative flex h-11 min-w-[250px] items-center rounded-2xl border border-canvas-200 bg-canvas-50/90 px-2.5 shadow-sm">
                      <Search className="ml-1 h-4 w-4 text-canvas-500 select-none" />
                      <input
                        value={ruleSearch}
                        onChange={(event) => setRuleSearch(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") {
                            setRuleSearch("");
                          }
                        }}
                        aria-label="Search rules"
                        placeholder="Search rules..."
                        className="w-56 md:w-64 bg-transparent px-2.5 text-sm text-canvas-700 placeholder:text-canvas-500 focus:outline-none"
                      />
                      {ruleSearch && (
                        <button
                          type="button"
                          onClick={() => setRuleSearch("")}
                          className="rounded-md p-1 text-canvas-400 transition-colors hover:bg-canvas-100 hover:text-canvas-700 select-none"
                          title="Clear search"
                          aria-label="Clear rule search"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    <p className="text-sm text-canvas-600 select-none">
                      {filteredRules.length} rule{filteredRules.length !== 1 ? "s" : ""}
                    </p>

                    <Button onClick={openCreateModal} className="whitespace-nowrap">
                      <Plus className="h-4 w-4" />
                      New Rule
                    </Button>

                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={clearAllFilters}
                        className="text-xs font-semibold uppercase tracking-[0.08em] text-brand hover:underline select-none"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <Table
                columns={columns}
                data={filteredRules}
                className="!rounded-none !border-none !bg-transparent shadow-none"
                sortField={sortField}
                sortOrder={sortOrder}
                onSort={(field) => handleSort(field as SortField)}
                emptyMessage="No rules yet"
                emptyDetail="Create a rule to automatically categorize new transactions."
              />
            </>
          )}
        </Card>
      </div>

      <RuleEditorModal
        isOpen={isEditorOpen}
        activeRule={activeRule}
        matchTypeOptions={matchTypeOptions}
        onClose={closeEditor}
        onSaved={fetchRules}
      />

      <Modal
        isOpen={confirmOpen}
        onClose={() => {
          setConfirmOpen(false);
          setConfirmRule(null);
        }}
        title="Delete Rule"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-canvas-600 select-none">
            Choose how to handle existing categorizations for this rule.
          </p>
          <div className="text-sm text-canvas-500 select-none">
            {confirmLoading
              ? "Checking matches..."
              : `${confirmMatchCount} matching transaction${confirmMatchCount !== 1 ? "s" : ""}`}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setConfirmOpen(false);
                setConfirmRule(null);
              }}
            >
              Cancel
            </Button>
            {confirmRule && (
              <>
                <Button variant="secondary" onClick={() => handleDeleteRule(confirmRule, false)}>
                  Delete Rule Only
                </Button>
                <Button
                  onClick={() => handleDeleteRule(confirmRule, true)}
                  className="!bg-finance-expense hover:!bg-finance-expense/90 !text-white"
                >
                  Delete + Uncategorize ({confirmMatchCount})
                </Button>
              </>
            )}
          </div>
        </div>
      </Modal>
    </ScreenLayout>
  );
};

export default RuleManager;
