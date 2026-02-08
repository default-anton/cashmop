import { Check, Edit2, Sparkles, Trash2, X } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { Button, Input } from "../../../components";
import type { CategorySummary } from "../types";

interface BuildCategoryTableColumnsOptions {
  editingId: number | null;
  editName: string;
  renameSaving: boolean;
  onEditNameChange: (value: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onStartEdit: (category: CategorySummary) => void;
  onOpenRules: (category: CategorySummary) => void;
  onDeleteCategory: (category: CategorySummary) => void;
  formatDate: (value: string) => string;
}

const iconButtonClass =
  "rounded-xl border border-canvas-200 bg-canvas-50 p-2 text-canvas-500 transition-colors hover:border-brand/25 hover:bg-brand/[0.06] hover:text-brand";

const dangerIconButtonClass =
  "rounded-xl border border-canvas-200 bg-canvas-50 p-2 text-canvas-500 transition-colors hover:border-finance-expense/25 hover:bg-finance-expense/10 hover:text-finance-expense";

const IconButton = ({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button {...props} className={`${iconButtonClass} ${className || ""}`} />
);

export const buildCategoryTableColumns = ({
  editingId,
  editName,
  renameSaving,
  onEditNameChange,
  onSaveEdit,
  onCancelEdit,
  onStartEdit,
  onOpenRules,
  onDeleteCategory,
  formatDate,
}: BuildCategoryTableColumnsOptions) => [
  {
    key: "name",
    header: "Category",
    sortable: true,
    render: (value: string, row: CategorySummary) =>
      editingId === row.id ? (
        <div className="flex items-center gap-2">
          <Input
            value={editName}
            onChange={(event) => onEditNameChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onSaveEdit();
              }
              if (event.key === "Escape") {
                onCancelEdit();
              }
            }}
            autoFocus
            aria-label={`Edit category ${row.name}`}
            className="h-9"
          />
          <button
            onClick={onSaveEdit}
            disabled={renameSaving}
            className="rounded-lg bg-brand p-2 text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
            aria-label={`Save category ${row.name}`}
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={onCancelEdit}
            className="rounded-lg bg-canvas-200 p-2 text-canvas-600 transition-colors hover:bg-canvas-300"
            aria-label={`Cancel editing category ${row.name}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <span className="text-canvas-700">{value}</span>
      ),
  },
  {
    key: "transaction_count",
    header: "Transactions",
    sortable: true,
    render: (value: number) => <span className="text-canvas-700">{value}</span>,
    className: "w-36",
  },
  {
    key: "rule_count",
    header: "Rules",
    sortable: true,
    render: (value: number) => <span className="text-canvas-700">{value}</span>,
    className: "w-28",
  },
  {
    key: "last_used_date",
    header: "Last Used",
    sortable: true,
    render: (value: string) => <span className="text-canvas-600">{formatDate(value)}</span>,
    className: "w-40",
  },
  {
    key: "actions",
    header: "Actions",
    render: (_: unknown, row: CategorySummary) => (
      <div className="flex items-center justify-end gap-2 whitespace-nowrap">
        <Button variant="secondary" size="sm" className="whitespace-nowrap" onClick={() => onOpenRules(row)}>
          <Sparkles className="h-4 w-4" />
          Manage Rules
        </Button>
        <IconButton onClick={() => onStartEdit(row)} aria-label={`Rename category ${row.name}`}>
          <Edit2 className="h-4 w-4" />
        </IconButton>
        <button
          onClick={() => onDeleteCategory(row)}
          className={dangerIconButtonClass}
          aria-label={`Delete category ${row.name}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    ),
    className: "text-right w-[280px] whitespace-nowrap",
  },
];
