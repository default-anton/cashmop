import React from 'react';
import { X } from 'lucide-react';

interface PillProps {
  children: React.ReactNode;
  onRemove?: () => void;
  draggable?: boolean;
  isDragging?: boolean;
  isDragOver?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  className?: string;
}

const Pill: React.FC<PillProps> = ({
  children,
  onRemove,
  draggable = false,
  isDragging = false,
  isDragOver = false,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  className = '',
}) => {
  const baseClasses = 'inline-flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded border';
  const stateClasses = isDragOver
    ? 'border-brand bg-brand/10'
    : 'border-canvas-200 bg-canvas-50';
  const cursorClass = draggable ? 'cursor-grab active:cursor-grabbing' : '';

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    onDragOver?.(e);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    onDrop?.(e);
  };

  return (
    <span
      className={`${baseClasses} ${stateClasses} ${cursorClass} ${className}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={handleDragOver}
      onDragLeave={onDragLeave}
      onDrop={handleDrop}
      onDragEnd={onDragEnd}
    >
      {children}
      {onRemove && (
        <button
          onClick={onRemove}
          className="text-canvas-500 hover:text-brand"
          aria-label="Remove"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
};

export default Pill;