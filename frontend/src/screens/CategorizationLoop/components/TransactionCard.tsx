import { Wand2 } from "lucide-react";
import React from "react";
import { Card } from "../../../components";
import { formatCents, formatCentsDecimal } from "../../../utils/currency";

interface Transaction {
  id: number;
  date: string;
  description: string;
  amount: number;
  currency: string;
  account_id: number;
  account_name: string;
  owner_name?: string;
}

interface SelectionRule {
  text: string;
  mode: "contains" | "starts_with" | "ends_with";
  startIndex?: number;
}

interface TransactionCardProps {
  transaction: Transaction;
  mainAmount: number | null;
  mainCurrency: string;
  onMouseUp: () => void;
  selectionRule?: SelectionRule | null;
  onSelectionChange?: (start: number, end: number) => void;
  showOnboardingHint?: boolean;
}

export const TransactionCard: React.FC<TransactionCardProps> = ({
  transaction,
  mainAmount,
  mainCurrency,
  onMouseUp,
  onSelectionChange,
  selectionRule,
  showOnboardingHint,
}) => {
  const descriptionRef = React.useRef<HTMLHeadingElement>(null);
  const [dragStart, setDragStart] = React.useState<number | null>(null);

  const getOffsetFromPoint = (x: number, y: number): number | null => {
    if (!descriptionRef.current) return null;

    const rect = descriptionRef.current.getBoundingClientRect();
    const isClose = y >= rect.top - 20 && y <= rect.bottom + 20;

    if (!isClose) {
      if (x < rect.left) return 0;
      if (x > rect.right) return transaction.description.length;
    }

    let range: Range | null = null;
    if (document.caretRangeFromPoint) {
      range = document.caretRangeFromPoint(x, y);
    } else if ((document as any).caretPositionFromPoint) {
      const pos = (document as any).caretPositionFromPoint(x, y);
      if (pos) {
        range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.setEnd(pos.offsetNode, pos.offset);
      }
    }

    if (!range) return null;

    let currentGlobalOffset = 0;
    const walker = document.createTreeWalker(descriptionRef.current, NodeFilter.SHOW_TEXT);

    let found = false;
    let result = 0;

    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node === range.startContainer) {
        found = true;
        result = currentGlobalOffset + range.startOffset;
        break;
      }
      currentGlobalOffset += node.textContent?.length || 0;
    }

    return found ? result : null;
  };

  React.useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (dragStart === null) return;
      e.preventDefault();

      const currentOffset = getOffsetFromPoint(e.clientX, e.clientY);
      if (currentOffset !== null && onSelectionChange) {
        onSelectionChange(dragStart, currentOffset);
      }
    };

    const handleGlobalMouseUp = (_e: MouseEvent) => {
      if (dragStart !== null) {
        setDragStart(null);
        if (onMouseUp) onMouseUp();
      }
    };

    if (dragStart !== null) {
      window.addEventListener("mousemove", handleGlobalMouseMove);
      window.addEventListener("mouseup", handleGlobalMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [dragStart, onSelectionChange, onMouseUp, transaction.description]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;

    e.preventDefault();

    const offset = getOffsetFromPoint(e.clientX, e.clientY);
    if (offset !== null) {
      setDragStart(offset);
      if (onSelectionChange) {
        onSelectionChange(offset, offset);
      }
    }
  };

  const renderDescription = () => {
    if (!selectionRule || !transaction.description.toLowerCase().includes(selectionRule.text.toLowerCase())) {
      return transaction.description;
    }

    const { text, mode, startIndex } = selectionRule;
    const desc = transaction.description;

    let index = -1;
    if (startIndex !== undefined && startIndex >= 0) {
      const actualTextAtStart = desc.substring(startIndex, startIndex + text.length).toLowerCase();
      if (actualTextAtStart === text.toLowerCase()) {
        index = startIndex;
      }
    }

    if (index === -1) {
      index = desc.toLowerCase().indexOf(text.toLowerCase());
    }

    if (index === -1) return desc;

    const matchesMode =
      (mode === "starts_with" && index === 0) ||
      (mode === "ends_with" && index + text.length === desc.length) ||
      mode === "contains";

    if (!matchesMode) return desc;

    const before = desc.substring(0, index);
    const match = desc.substring(index, index + text.length);
    const after = desc.substring(index + text.length);

    return (
      <>
        {before}
        <span className="rounded-sm bg-brand/20 text-canvas-900">{match}</span>
        {after}
      </>
    );
  };

  const displayAmount = mainAmount ?? transaction.amount;
  const isExpense = displayAmount < 0;
  const formattedMain = formatCents(mainAmount, mainCurrency);

  return (
    <Card variant="default" className="w-full p-5 shadow-card">
      <div className="space-y-4">
        <div className="flex flex-col gap-4 border-b border-canvas-200/80 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-wrap items-start gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-canvas-500 select-none">Date</p>
              <p className="mt-1 text-sm font-semibold text-canvas-800">
                {new Date(transaction.date).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-canvas-500 select-none">Account</p>
              <p className="mt-1 text-sm font-semibold text-canvas-800">{transaction.account_name}</p>
            </div>

            {transaction.owner_name && (
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-canvas-500 select-none">Owner</p>
                <p className="mt-1 text-sm font-semibold text-canvas-800">{transaction.owner_name}</p>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-canvas-200 bg-canvas-50/90 px-4 py-2 text-right sm:min-w-[170px]">
            <p
              className={`text-xs font-bold uppercase tracking-[0.08em] select-none ${isExpense ? "text-finance-expense/70" : "text-finance-income/70"}`}
            >
              {isExpense ? "Expense" : "Income"}
            </p>
            <p
              className={`mt-1 text-sm font-semibold tracking-tight ${mainAmount === null ? "text-canvas-500" : isExpense ? "text-finance-expense" : "text-finance-income"}`}
            >
              {formattedMain}
            </p>
            {(() => {
              const txCurrency = (transaction.currency || mainCurrency).toUpperCase();
              const main = mainCurrency.toUpperCase();
              const showOriginal = txCurrency !== main;
              return showOriginal ? (
                <p
                  className={`mt-1 text-xs ${transaction.amount < 0 ? "text-finance-expense/80" : "text-finance-income/80"}`}
                >
                  {txCurrency} {formatCentsDecimal(Math.abs(transaction.amount))}
                </p>
              ) : null;
            })()}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-canvas-500 select-none">Description</p>
            {showOnboardingHint && !selectionRule && (
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand select-none">
                <Wand2 className="h-3.5 w-3.5" />
                Drag over words to create an auto-rule
              </p>
            )}
          </div>

          <h2
            ref={descriptionRef}
            onMouseDown={handleMouseDown}
            aria-label="Transaction Description"
            className="w-full cursor-text rounded-2xl border border-canvas-200 bg-canvas-50/90 p-4 text-xl font-black leading-tight text-canvas-900 transition-colors hover:border-brand/30 hover:bg-brand/[0.03] select-none"
          >
            {renderDescription()}
          </h2>

          <p className="text-xs text-canvas-500 select-none">
            Tip: drag across the merchant text to preview a reusable rule.
          </p>
        </div>
      </div>
    </Card>
  );
};
