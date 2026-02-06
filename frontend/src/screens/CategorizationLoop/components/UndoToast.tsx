import { AlertCircle, X } from "lucide-react";
import type React from "react";
import { useEffect, useRef } from "react";

interface UndoToastProps {
  show: boolean;
  message: string;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onDismiss: () => void;
  autoFadeMs?: number;
}

const UndoToast: React.FC<UndoToastProps> = ({
  show,
  message,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onDismiss,
  autoFadeMs = 5000,
}) => {
  const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (show && autoFadeMs > 0) {
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
      }

      fadeTimeoutRef.current = setTimeout(() => {
        onDismiss();
      }, autoFadeMs);
    }

    return () => {
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
      }
    };
  }, [show, autoFadeMs, onDismiss]);

  if (!show) {
    return null;
  }

  return (
    <div
      className="fixed bottom-6 left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2"
      data-testid="undo-toast"
    >
      <div className="flex items-center gap-3 rounded-2xl border border-canvas-200 bg-canvas-50/95 px-4 py-3 shadow-card backdrop-blur-sm">
        <AlertCircle className="h-4 w-4 flex-shrink-0 text-canvas-500" />

        <span className="flex-1 truncate text-sm font-medium text-canvas-700">{message}</span>

        {canRedo && (
          <button
            onClick={onRedo}
            className="flex-shrink-0 rounded-lg border border-canvas-200 px-2 py-1 text-sm font-semibold text-canvas-700 transition-colors hover:border-brand/35 hover:text-brand"
          >
            Redo
          </button>
        )}

        {canUndo && (
          <button
            onClick={onUndo}
            className="flex-shrink-0 rounded-lg border border-brand/25 bg-brand/10 px-2 py-1 text-sm font-semibold text-brand transition-colors hover:bg-brand/15"
          >
            Undo
          </button>
        )}

        <button
          onClick={onDismiss}
          className="flex-shrink-0 rounded-md p-1 text-canvas-500 transition-colors hover:bg-canvas-100 hover:text-canvas-700"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default UndoToast;
