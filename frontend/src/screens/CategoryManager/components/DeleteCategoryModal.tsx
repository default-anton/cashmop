import type React from "react";
import { useEffect } from "react";
import { Button, Modal } from "../../../components";
import type { CategorySummary } from "../types";

interface DeleteCategoryModalProps {
  category: CategorySummary | null;
  deleting: boolean;
  onClose: () => void;
  onDelete: () => void;
}

const DeleteCategoryModal: React.FC<DeleteCategoryModalProps> = ({ category, deleting, onClose, onDelete }) => {
  useEffect(() => {
    if (!category) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === "Enter" && !deleting) {
        event.preventDefault();
        onDelete();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [category, deleting, onClose, onDelete]);

  return (
    <Modal isOpen={!!category} onClose={onClose} title="Delete Category" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-canvas-600 select-none">
          Delete <span className="font-semibold text-canvas-800">{category?.name}</span>? This will remove all linked
          rules and uncategorize its transactions.
        </p>
        <div className="rounded-xl border border-canvas-200 bg-canvas-100/60 p-3 text-sm text-canvas-600 select-none">
          <p>
            {category?.transaction_count || 0} transaction{(category?.transaction_count || 0) !== 1 ? "s" : ""} will
            become uncategorized.
          </p>
          <p>
            {category?.rule_count || 0} rule{(category?.rule_count || 0) !== 1 ? "s" : ""} will be deleted.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={onDelete}
            disabled={deleting}
            className="!bg-finance-expense hover:!bg-finance-expense/90 !text-white disabled:opacity-60"
          >
            {deleting ? "Deleting..." : "Delete + Uncategorize"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default DeleteCategoryModal;
