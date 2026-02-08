import type React from "react";
import { useEffect } from "react";
import { Button, Modal } from "../../../components";
import type { RuleRow } from "../../RuleManager/types";

interface DeleteRuleConfirmModalProps {
  isOpen: boolean;
  rule: RuleRow | null;
  matchCount: number;
  loading: boolean;
  onClose: () => void;
  onDeleteOnly: () => void;
  onDeleteAndUncategorize: () => void;
}

const DeleteRuleConfirmModal: React.FC<DeleteRuleConfirmModalProps> = ({
  isOpen,
  rule,
  matchCount,
  loading,
  onClose,
  onDeleteOnly,
  onDeleteAndUncategorize,
}) => {
  useEffect(() => {
    if (!isOpen || !rule) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === "Enter" && !loading) {
        event.preventDefault();
        onDeleteOnly();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, loading, onClose, onDeleteOnly, rule]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Rule" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-canvas-600 select-none">
          Choose how to handle existing categorizations for this rule.
        </p>
        <div className="text-sm text-canvas-500 select-none">
          {loading ? "Checking matches..." : `${matchCount} matching transaction${matchCount !== 1 ? "s" : ""}`}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {rule && (
            <>
              <Button variant="secondary" onClick={onDeleteOnly}>
                Delete Rule Only
              </Button>
              <Button
                onClick={onDeleteAndUncategorize}
                className="!bg-finance-expense hover:!bg-finance-expense/90 !text-white"
              >
                Delete + Uncategorize ({matchCount})
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default DeleteRuleConfirmModal;
