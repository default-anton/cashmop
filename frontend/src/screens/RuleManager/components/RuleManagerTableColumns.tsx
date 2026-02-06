import { Pencil, Trash2 } from "lucide-react";
import type { MatchType, RuleRow } from "../types";

interface BuildRuleManagerColumnsOptions {
  matchTypeOptions: { value: MatchType; label: string }[];
  formatAmountFilter: (rule: RuleRow) => string;
  onEdit: (rule: RuleRow) => void;
  onDelete: (rule: RuleRow) => void;
}

export const buildRuleManagerColumns = ({
  matchTypeOptions,
  formatAmountFilter,
  onEdit,
  onDelete,
}: BuildRuleManagerColumnsOptions) => [
  {
    key: "match_type",
    header: "Match Type",
    sortable: true,
    render: (value: MatchType) => {
      const label = matchTypeOptions.find((opt) => opt.value === value)?.label || value;
      return <span className="text-canvas-700">{label}</span>;
    },
  },
  {
    key: "match_value",
    header: "Match Value",
    sortable: true,
    render: (value: string) => <span className="font-mono text-canvas-700">{value}</span>,
  },
  {
    key: "amount",
    header: "Amount Filter",
    sortable: true,
    render: (_: any, row: RuleRow) => <span className="text-canvas-700">{formatAmountFilter(row)}</span>,
  },
  {
    key: "category_name",
    header: "Category",
    sortable: true,
    render: (value: string) => <span className="text-canvas-700">{value || "Uncategorized"}</span>,
  },
  {
    key: "created_at",
    header: "Created",
    sortable: true,
    render: (value: string) => (
      <span className="text-canvas-600">
        {value
          ? new Date(value).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "—"}
      </span>
    ),
  },
  {
    key: "actions",
    header: "Actions",
    render: (_: any, row: RuleRow) => (
      <div className="flex items-center gap-2">
        <button
          onClick={() => onEdit(row)}
          className="rounded-xl border border-canvas-200 bg-canvas-50 p-2 text-canvas-500 transition-colors hover:border-brand/25 hover:bg-brand/[0.06] hover:text-brand"
          aria-label={`Edit rule ${row.match_value}`}
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={() => onDelete(row)}
          className="rounded-xl border border-canvas-200 bg-canvas-50 p-2 text-canvas-500 transition-colors hover:border-finance-expense/25 hover:bg-finance-expense/10 hover:text-finance-expense"
          aria-label={`Delete rule ${row.match_value}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    ),
  },
];
