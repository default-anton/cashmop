import type React from "react";
import { useEffect } from "react";
import { Button, Input, Modal } from "../../../components";

interface CreateCategoryModalProps {
  isOpen: boolean;
  value: string;
  creating: boolean;
  onChange: (value: string) => void;
  onCreate: () => void;
  onClose: () => void;
}

const CreateCategoryModal: React.FC<CreateCategoryModalProps> = ({
  isOpen,
  value,
  creating,
  onChange,
  onCreate,
  onClose,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === "Enter" && !event.shiftKey && !creating) {
        const target = event.target as HTMLElement | null;
        if (target?.tagName.toLowerCase() === "textarea") return;
        event.preventDefault();
        onCreate();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [creating, isOpen, onClose, onCreate]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Category" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-canvas-600 select-none">Add a category name. You can attach rules right after.</p>
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label="New category name"
          placeholder="e.g., Subscriptions"
          className="w-full"
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onCreate} disabled={creating}>
            {creating ? "Creating..." : "Create Category"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default CreateCategoryModal;
