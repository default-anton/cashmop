import React from 'react';
import { Card } from '../../../components';

import { Wand2 } from 'lucide-react';

interface Transaction {
  id: number;
  date: string;
  description: string;
  amount: number;
  account_id: number;
  account_name: string;
  owner_name?: string;
}

interface SelectionRule {
  text: string;
  mode: 'contains' | 'starts_with' | 'ends_with';
  startIndex?: number;
}

interface TransactionCardProps {
  transaction: Transaction;
  onMouseUp: () => void;
  selectionRule?: SelectionRule | null;
  onSelectionChange?: (start: number, end: number) => void;
  showOnboardingHint?: boolean;
}

export const TransactionCard: React.FC<TransactionCardProps> = ({
  transaction,
  onMouseUp,
  onSelectionChange,
  selectionRule,
  showOnboardingHint,
}) => {
  const descriptionRef = React.useRef<HTMLHeadingElement>(null);
  const [dragStart, setDragStart] = React.useState<number | null>(null);

  const getOffsetFromPoint = (x: number, y: number): number | null => {
    if (!descriptionRef.current) return null;

    // Check if point is roughly within bounds (vertical) to avoid jumping when far away
    const rect = descriptionRef.current.getBoundingClientRect();
    const isClose = y >= rect.top - 20 && y <= rect.bottom + 20;

    // If we're far out, we might want to snap to start or end based on X
    if (!isClose) {
      if (x < rect.left) return 0;
      if (x > rect.right) return transaction.description.length;
    }

    let range;
    if (document.caretRangeFromPoint) {
      range = document.caretRangeFromPoint(x, y);
    } else if ((document as any).caretPositionFromPoint) {
      // Firefox fallback - unlikely needed for Wails but good practice
      const pos = (document as any).caretPositionFromPoint(x, y);
      if (pos) {
        range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.setEnd(pos.offsetNode, pos.offset);
      }
    }

    if (!range) return null;

    // Now map range.startContainer + offset to global index
    // We walk the descriptionRef text nodes
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
      e.preventDefault(); // Stop native selection from interfering

      const currentOffset = getOffsetFromPoint(e.clientX, e.clientY);
      if (currentOffset !== null && onSelectionChange) {
        onSelectionChange(dragStart, currentOffset);
      }
    };

    const handleGlobalMouseUp = (e: MouseEvent) => {
      if (dragStart !== null) {
        setDragStart(null);
        if (onMouseUp) onMouseUp();
      }
    };

    if (dragStart !== null) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [dragStart, onSelectionChange, onMouseUp, transaction.description]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only trigger on left click
    if (e.button !== 0) return;

    e.preventDefault();

    const offset = getOffsetFromPoint(e.clientX, e.clientY);
    if (offset !== null) {
      setDragStart(offset);
      if (onSelectionChange) {
        // Initial click is a 0-length selection at that point
        // or effectively "clearing" previous selection until drag happens
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
      (mode === 'starts_with' && index === 0) ||
      (mode === 'ends_with' && index + text.length === desc.length) ||
      mode === 'contains';

    if (!matchesMode) return desc;

    const before = desc.substring(0, index);
    const match = desc.substring(index, index + text.length);
    const after = desc.substring(index + text.length);

    return (
      <>
        {before}
        <span className="bg-brand text-white shadow-brand-glow py-0.5">{match}</span>
        {after}
      </>
    );
  };
  return (
    <div className="relative group perspective-1000">
      <Card
        variant="glass"
        className="p-6 mb-4 transform transition-all duration-500 hover:rotate-x-1 hover:shadow-2xl border-canvas-200/50"
        onMouseUp={undefined} // We handle mouse up globally for the drag
        onMouseDown={undefined}
      >
        <div className="text-center">
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-canvas-200/30">
            <div className="flex flex-col items-start text-left">
              <span className="text-[9px] font-black text-canvas-400 uppercase tracking-[0.2em] mb-0.5">
                Date
              </span>
              <span className="text-sm font-bold text-canvas-700">
                {new Date(transaction.date).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>

            <div className="flex flex-col items-center">
              <span className={`text-[9px] font-black uppercase tracking-[0.2em] mb-0.5 ${transaction.amount < 0 ? 'text-finance-expense/60' : 'text-finance-income/60'}`}>
                {transaction.amount < 0 ? 'Expense' : 'Income'}
              </span>
              <span className={`text-sm font-mono font-black tracking-tight ${transaction.amount < 0 ? 'text-finance-expense' : 'text-finance-income'}`}>
                ${Math.abs(transaction.amount).toFixed(2)}
              </span>
            </div>

            <div className="flex gap-6">
              <div className="flex flex-col items-end text-right">
                <span className="text-[9px] font-black text-canvas-400 uppercase tracking-[0.2em] mb-0.5">
                  Account
                </span>
                <span className="text-sm font-black text-brand tracking-tight">
                  {transaction.account_name}
                </span>
              </div>
              {transaction.owner_name && (
                <div className="flex flex-col items-end text-right border-l border-canvas-200/50 pl-6">
                  <span className="text-[9px] font-black text-canvas-400 uppercase tracking-[0.2em] mb-0.5">
                    Owner
                  </span>
                  <span className="text-sm font-black text-canvas-800 tracking-tight">
                    {transaction.owner_name}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="mb-4 flex flex-col items-center">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[9px] font-black text-canvas-400 uppercase tracking-[0.2em]">
                Description
              </span>
            </div>
            <div className="relative group/desc w-full">
              {showOnboardingHint && !selectionRule && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center animate-snap-in pointer-events-none">
                  <div className="bg-brand text-white text-[9px] font-black px-2.5 py-1.5 rounded-lg shadow-brand-glow uppercase tracking-widest flex items-center gap-2 border border-brand/20 backdrop-blur-sm">
                    <Wand2 className="w-3 h-3" />
                    Select text to create rule
                  </div>
                  <div className="w-2 h-2 bg-brand rotate-45 -mt-1 shadow-brand-glow"></div>
                </div>
              )}
              <h2
                ref={descriptionRef}
                onMouseDown={handleMouseDown}
                aria-label="Transaction Description"
                className="text-xl font-black text-canvas-800 leading-tight select-none cursor-text border-2 border-dashed border-canvas-300 bg-canvas-200/20 hover:bg-brand/[0.02] hover:border-brand/30 rounded-2xl transition-all duration-300 p-5 w-full"
              >
                {renderDescription()}
              </h2>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
