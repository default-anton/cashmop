import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { EventsOn } from "../../../wailsjs/runtime/runtime";
import { Card, ScreenLayout, Table, useToast } from "../../components";
import { useFuzzySearch } from "../../hooks/useFuzzySearch";
import { formatCents } from "../../utils/currency";
import { EVENT_CATEGORIES_UPDATED, EVENT_TRANSACTIONS_UPDATED } from "../../utils/events";
import RuleEditorModal from "../RuleManager/components/RuleEditorModal";
import type { MatchType, RuleRow } from "../RuleManager/types";
import { buildCategoryTableColumns } from "./components/buildCategoryTableColumns";
import CategoryManagerHeader from "./components/CategoryManagerHeader";
import CategoryRulesModal from "./components/CategoryRulesModal";
import CategoryTableToolbar from "./components/CategoryTableToolbar";
import CreateCategoryModal from "./components/CreateCategoryModal";
import DeleteCategoryModal from "./components/DeleteCategoryModal";
import DeleteRuleConfirmModal from "./components/DeleteRuleConfirmModal";
import type { CategorySummary } from "./types";

type SortField = "name" | "transaction_count" | "rule_count" | "last_used_date";
type SortOrder = "asc" | "desc";

interface CategoryManagerProps {
  onViewRules?: (categoryId: number) => void;
}

const matchTypeOptions: { value: MatchType; label: string }[] = [
  { value: "contains", label: "Contains" },
  { value: "starts_with", label: "Starts With" },
  { value: "ends_with", label: "Ends With" },
  { value: "exact", label: "Exact" },
];

const formatDate = (value: string) => {
  if (!value) return "Never";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || target.isContentEditable;
};

const CategoryManager: React.FC<CategoryManagerProps> = ({ onViewRules }) => {
  const { showToast } = useToast();
  const { mainCurrency } = useCurrency();

  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [categorySearch, setCategorySearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creating, setCreating] = useState(false);

  const [deleteCategory, setDeleteCategory] = useState<CategorySummary | null>(null);
  const [deletingCategory, setDeletingCategory] = useState(false);

  const [rulesCategory, setRulesCategory] = useState<CategorySummary | null>(null);

  const [isRuleEditorOpen, setIsRuleEditorOpen] = useState(false);
  const [activeRule, setActiveRule] = useState<RuleRow | null>(null);

  const [confirmRule, setConfirmRule] = useState<RuleRow | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmMatchCount, setConfirmMatchCount] = useState(0);

  const categorySearchInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
      }

      try {
        const [categorySummaries, ruleList] = await Promise.all([
          (window as any).go.main.App.GetCategorySummaries(),
          (window as any).go.main.App.GetCategorizationRules(),
        ]);

        setCategories(categorySummaries || []);
        setRules(ruleList || []);

        setRulesCategory((prev) => {
          if (!prev) return prev;
          const refreshed = (categorySummaries || []).find((category: CategorySummary) => category.id === prev.id);
          return refreshed || null;
        });
      } catch (error) {
        console.error("Failed to load categories screen data", error);
        showToast("Failed to load categories", "error");
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [showToast],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const offs = [
      EventsOn(EVENT_CATEGORIES_UPDATED, () => fetchData(true)),
      EventsOn(EVENT_TRANSACTIONS_UPDATED, () => fetchData(true)),
    ];

    return () => {
      offs.forEach((off) => {
        off?.();
      });
    };
  }, [fetchData]);

  const hasModalOpen = createModalOpen || !!deleteCategory || !!rulesCategory || isRuleEditorOpen || confirmOpen;

  useEffect(() => {
    if (hasModalOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        setCreateModalOpen(true);
        setNewCategoryName("");
        return;
      }

      if (event.key === "/" && !isEditableTarget(event.target)) {
        event.preventDefault();
        categorySearchInputRef.current?.focus();
        categorySearchInputRef.current?.select();
        return;
      }

      if (event.key === "Escape" && categorySearch.trim()) {
        setCategorySearch("");
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [categorySearch, hasModalOpen]);

  const sortedCategories = useMemo(() => {
    const next = [...categories];
    next.sort((a, b) => {
      let result = 0;
      switch (sortField) {
        case "name":
          result = a.name.localeCompare(b.name);
          break;
        case "transaction_count":
          result = a.transaction_count - b.transaction_count;
          break;
        case "rule_count":
          result = a.rule_count - b.rule_count;
          break;
        case "last_used_date":
          result = new Date(a.last_used_date || 0).getTime() - new Date(b.last_used_date || 0).getTime();
          break;
      }
      return sortOrder === "asc" ? result : -result;
    });

    return next;
  }, [categories, sortField, sortOrder]);

  const buildCategorySearchLabel = useCallback((category: CategorySummary) => {
    const parts = [
      category.name,
      String(category.transaction_count),
      String(category.rule_count),
      category.last_used_date || "",
    ];
    return `${parts.join(" | ")} ::${category.id}`;
  }, []);

  const filteredCategories = useFuzzySearch(sortedCategories, buildCategorySearchLabel, categorySearch);

  const rulesForActiveCategory = useMemo(() => {
    if (!rulesCategory) return [];
    return rules.filter((rule) => rule.category_id === rulesCategory.id);
  }, [rules, rulesCategory]);

  const formatAmountFilter = (rule: RuleRow) => {
    const min = rule.amount_min ?? null;
    const max = rule.amount_max ?? null;

    if (min === null && max === null) return "Any";

    if (min !== null && max !== null) {
      const lower = Math.min(Math.abs(min), Math.abs(max));
      const upper = Math.max(Math.abs(min), Math.abs(max));
      return `${formatCents(lower, mainCurrency)} - ${formatCents(upper, mainCurrency)}`;
    }

    if (min !== null) {
      return min < 0 ? `≤ ${formatCents(min, mainCurrency)}` : `≥ ${formatCents(min, mainCurrency)}`;
    }

    return max !== null && max < 0 ? `≥ ${formatCents(max, mainCurrency)}` : `≤ ${formatCents(max || 0, mainCurrency)}`;
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortField(field);
    setSortOrder(field === "name" ? "asc" : "desc");
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;

    const nextName = editName.trim();
    if (!nextName) {
      showToast("Category name cannot be empty", "error");
      return;
    }

    setRenameSaving(true);
    try {
      await (window as any).go.main.App.RenameCategory(editingId, nextName);
      setRulesCategory((prev) => (prev && prev.id === editingId ? { ...prev, name: nextName } : prev));
      setEditingId(null);
      setEditName("");
      showToast("Category renamed", "success");
      await fetchData(true);
    } catch (error) {
      console.error("Failed to rename category", error);
      showToast("Failed to rename category", "error");
    } finally {
      setRenameSaving(false);
    }
  };

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      showToast("Category name is required", "error");
      return;
    }

    setCreating(true);
    try {
      await (window as any).go.main.App.CreateCategory(name);
      setCreateModalOpen(false);
      setNewCategoryName("");
      showToast(`Category ${name} is ready`, "success");
      await fetchData(true);
    } catch (error) {
      console.error("Failed to create category", error);
      showToast("Failed to create category", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteCategory) return;

    setDeletingCategory(true);
    try {
      const res = await (window as any).go.main.App.DeleteCategory(deleteCategory.id);
      const uncategorizedCount = res?.uncategorized_count || 0;
      const deletedRuleCount = res?.deleted_rule_count || 0;

      showToast(
        `Deleted ${deleteCategory.name}: ${uncategorizedCount} uncategorized, ${deletedRuleCount} rule${deletedRuleCount !== 1 ? "s" : ""} removed`,
        "success",
      );

      if (rulesCategory?.id === deleteCategory.id) {
        setRulesCategory(null);
      }

      setDeleteCategory(null);
      await fetchData(true);
    } catch (error) {
      console.error("Failed to delete category", error);
      showToast("Failed to delete category", "error");
    } finally {
      setDeletingCategory(false);
    }
  };

  const openRuleDeleteConfirm = async (rule: RuleRow) => {
    setConfirmRule(rule);
    setConfirmOpen(true);
    setConfirmMatchCount(0);
    setConfirmLoading(true);

    try {
      const count = await (window as any).go.main.App.GetRuleMatchCount(rule.id);
      setConfirmMatchCount(count || 0);
    } catch (error) {
      console.error("Failed to fetch rule match count", error);
      setConfirmMatchCount(0);
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleDeleteRule = async (rule: RuleRow, uncategorize: boolean) => {
    try {
      const res = await (window as any).go.main.App.DeleteCategorizationRule(rule.id, uncategorize);
      if (uncategorize) {
        showToast(
          `Rule deleted and ${res?.uncategorized_count || 0} transaction${(res?.uncategorized_count || 0) !== 1 ? "s" : ""} uncategorized`,
          "success",
        );
      } else {
        showToast("Rule deleted", "success");
      }
      setConfirmOpen(false);
      setConfirmRule(null);
      await fetchData(true);
    } catch (error) {
      console.error("Failed to delete rule", error);
      showToast("Failed to delete rule", "error");
    }
  };

  const columns = buildCategoryTableColumns({
    editingId,
    editName,
    renameSaving,
    onEditNameChange: setEditName,
    onSaveEdit: handleSaveEdit,
    onCancelEdit: () => setEditingId(null),
    onStartEdit: (category) => {
      setEditingId(category.id);
      setEditName(category.name);
    },
    onOpenRules: setRulesCategory,
    onDeleteCategory: setDeleteCategory,
    formatDate,
  });

  return (
    <ScreenLayout size="wide">
      <div className="space-y-6">
        <CategoryManagerHeader />

        <Card variant="elevated" className="overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand/25 border-t-brand" />
              <p className="text-sm font-semibold text-canvas-500 select-none">Loading categories...</p>
            </div>
          ) : (
            <>
              <CategoryTableToolbar
                search={categorySearch}
                categoryCount={filteredCategories.length}
                onSearchChange={setCategorySearch}
                onClearSearch={() => setCategorySearch("")}
                onCreateCategory={() => {
                  setCreateModalOpen(true);
                  setNewCategoryName("");
                }}
                searchInputRef={categorySearchInputRef}
              />

              <Table
                columns={columns}
                data={filteredCategories}
                className="!rounded-none !border-none !bg-transparent shadow-none"
                sortField={sortField}
                sortOrder={sortOrder}
                onSort={(field) => handleSort(field as SortField)}
                emptyMessage="No categories found"
                emptyDetail="Create your first category and start wiring rules to it."
              />
            </>
          )}
        </Card>
      </div>

      <CreateCategoryModal
        isOpen={createModalOpen}
        value={newCategoryName}
        creating={creating}
        onChange={setNewCategoryName}
        onCreate={handleCreateCategory}
        onClose={() => setCreateModalOpen(false)}
      />

      <DeleteCategoryModal
        category={deleteCategory}
        deleting={deletingCategory}
        onClose={() => setDeleteCategory(null)}
        onDelete={handleDeleteCategory}
      />

      <CategoryRulesModal
        isOpen={!!rulesCategory}
        category={rulesCategory}
        rules={rulesForActiveCategory}
        hotkeysEnabled={!isRuleEditorOpen && !confirmOpen}
        onClose={() => setRulesCategory(null)}
        onCreateRule={() => {
          setActiveRule(null);
          setIsRuleEditorOpen(true);
        }}
        onEditRule={(rule) => {
          setActiveRule(rule);
          setIsRuleEditorOpen(true);
        }}
        onDeleteRule={openRuleDeleteConfirm}
        onOpenRuleManager={onViewRules}
        formatAmountFilter={formatAmountFilter}
      />

      <RuleEditorModal
        isOpen={isRuleEditorOpen}
        activeRule={activeRule}
        matchTypeOptions={matchTypeOptions}
        prefillCategory={!activeRule && rulesCategory ? { id: rulesCategory.id, name: rulesCategory.name } : null}
        disableCategorySelection={!!rulesCategory}
        onClose={() => {
          setIsRuleEditorOpen(false);
          setActiveRule(null);
        }}
        onSaved={() => fetchData(true)}
      />

      <DeleteRuleConfirmModal
        isOpen={confirmOpen}
        rule={confirmRule}
        matchCount={confirmMatchCount}
        loading={confirmLoading}
        onClose={() => {
          setConfirmOpen(false);
          setConfirmRule(null);
        }}
        onDeleteOnly={() => confirmRule && handleDeleteRule(confirmRule, false)}
        onDeleteAndUncategorize={() => confirmRule && handleDeleteRule(confirmRule, true)}
      />
    </ScreenLayout>
  );
};

export default CategoryManager;
