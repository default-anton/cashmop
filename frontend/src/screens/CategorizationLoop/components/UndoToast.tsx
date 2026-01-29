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
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50" data-testid="undo-toast">
      <div className="bg-gray-900 text-white rounded-lg shadow-lg px-4 py-3 flex items-center gap-3 min-w-[300px] max-w-md">
        <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>

        <span className="flex-1 text-sm truncate">{message}</span>

        {canRedo && (
          <button
            onClick={onRedo}
            className="text-green-400 hover:text-green-300 text-sm font-medium flex-shrink-0 transition-colors"
          >
            Redo
          </button>
        )}

        {canUndo && (
          <button
            onClick={onUndo}
            className="text-blue-400 hover:text-blue-300 text-sm font-medium flex-shrink-0 transition-colors"
          >
            Undo
          </button>
        )}

        <button
          onClick={onDismiss}
          className="text-gray-500 hover:text-gray-400 flex-shrink-0 transition-colors"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default UndoToast;
