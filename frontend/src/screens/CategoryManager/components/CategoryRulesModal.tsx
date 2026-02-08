import { ExternalLink, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Modal, Table } from "../../../components";
import { useFuzzySearch } from "../../../hooks/useFuzzySearch";
import type { MatchType, RuleRow } from "../../RuleManager/types";
import type { CategorySummary } from "../types";

interface CategoryRulesModalProps {
  isOpen: boolean;
  category: CategorySummary | null;
  rules: RuleRow[];
  hotkeysEnabled?: boolean;
  onClose: () => void;
  onCreateRule: () => void;
  onEditRule: (rule: RuleRow) => void;
  onDeleteRule: (rule: RuleRow) => void;
  onOpenRuleManager?: (categoryId: number) => void;
  formatAmountFilter: (rule: RuleRow) => string;
}

const matchTypeLabels: Record<MatchType, string> = {
  contains: "Contains",
  starts_with: "Starts With",
  ends_with: "Ends With",
  exact: "Exact",
};

const formatCreatedDate = (value?: string) => {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || target.isContentEditable;
};

const CategoryRulesModal: React.FC<CategoryRulesModalProps> = ({
  isOpen,
  category,
  rules,
  hotkeysEnabled = true,
  onClose,
  onCreateRule,
  onEditRule,
  onDeleteRule,
  onOpenRuleManager,
  formatAmountFilter,
}) => {
  const [search, setSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setSearch("");
    }
  }, [isOpen, category?.id]);

  useEffect(() => {
    if (!isOpen || !hotkeysEnabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        onCreateRule();
        return;
      }

      if (event.key === "/" && !isEditableTarget(event.target)) {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (event.key === "Escape") {
        if (search.trim()) {
          setSearch("");
        } else {
          onClose();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [hotkeysEnabled, isOpen, onClose, onCreateRule, search]);

  const sortedRules = useMemo(
    () =>
      [...rules].sort((a, b) => {
        const aTime = new Date(a.created_at || 0).getTime();
        const bTime = new Date(b.created_at || 0).getTime();
        if (aTime !== bTime) return bTime - aTime;
        return b.id - a.id;
      }),
    [rules],
  );

  const buildRuleSearchLabel = useCallback((rule: RuleRow) => {
    const parts = [
      matchTypeLabels[rule.match_type],
      rule.match_value,
      rule.category_name,
      String(rule.amount_min ?? ""),
      String(rule.amount_max ?? ""),
      rule.created_at || "",
    ];
    return `${parts.join(" | ")} ::${rule.id}`;
  }, []);

  const filteredRules = useFuzzySearch(sortedRules, buildRuleSearchLabel, search);

  const columns = [
    {
      key: "match_type",
      header: "Match Type",
      render: (value: MatchType) => <span className="text-canvas-700">{matchTypeLabels[value] || value}</span>,
    },
    {
      key: "match_value",
      header: "Match Value",
      render: (value: string) => <span className="font-mono text-canvas-700">{value}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      render: (_: unknown, row: RuleRow) => <span className="text-canvas-700">{formatAmountFilter(row)}</span>,
    },
    {
      key: "created_at",
      header: "Created",
      render: (value: string) => <span className="text-canvas-600">{formatCreatedDate(value)}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      render: (_: unknown, row: RuleRow) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => onEditRule(row)}
            className="rounded-xl border border-canvas-200 bg-canvas-50 p-2 text-canvas-500 transition-colors hover:border-brand/25 hover:bg-brand/[0.06] hover:text-brand"
            aria-label={`Edit rule ${row.match_value}`}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDeleteRule(row)}
            className="rounded-xl border border-canvas-200 bg-canvas-50 p-2 text-canvas-500 transition-colors hover:border-finance-expense/25 hover:bg-finance-expense/10 hover:text-finance-expense"
            aria-label={`Delete rule ${row.match_value}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Rules · ${category?.name || "Category"}`} size="xl">
      <div className="space-y-4">
        <p className="text-sm text-canvas-600 select-none">
          Tune match logic for {category?.name || "this category"} without leaving this screen.
        </p>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-canvas-200 bg-canvas-100/50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex h-11 min-w-[240px] items-center rounded-2xl border border-canvas-200 bg-canvas-50 px-2.5 shadow-sm">
              <Search className="ml-1 h-4 w-4 text-canvas-500 select-none" />
              <input
                ref={searchInputRef}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setSearch("");
                  }
                }}
                aria-label="Search category rules"
                placeholder="Search rules..."
                className="w-56 bg-transparent px-2.5 text-sm text-canvas-700 placeholder:text-canvas-500 focus:outline-none"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="rounded-md p-1 text-canvas-400 transition-colors hover:bg-canvas-100 hover:text-canvas-700 select-none"
                  title="Clear search"
                  aria-label="Clear category rule search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <p className="text-sm text-canvas-600 select-none">
              {filteredRules.length} rule{filteredRules.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {category && onOpenRuleManager && (
              <Button variant="secondary" onClick={() => onOpenRuleManager(category.id)}>
                <ExternalLink className="h-4 w-4" />
                Full Rule Manager
              </Button>
            )}
            <Button onClick={onCreateRule}>
              <Plus className="h-4 w-4" />
              New Rule
            </Button>
          </div>
        </div>

        <Table
          columns={columns}
          data={filteredRules}
          className="!rounded-2xl"
          emptyMessage="No rules for this category yet"
          emptyDetail="Create one to auto-categorize matching transactions faster."
        />
      </div>
    </Modal>
  );
};

export default CategoryRulesModal;
