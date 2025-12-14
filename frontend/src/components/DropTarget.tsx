import React from 'react';

interface DropTargetProps {
  children: React.ReactNode;
  isActive?: boolean;
  isMissing?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent) => void;
  className?: string;
}

const DropTarget: React.FC<DropTargetProps> = ({
  children,
  isActive = false,
  isMissing = false,
  onDragOver,
  onDragLeave,
  onDrop,
  className = '',
}) => {
  const baseClasses = 'bg-canvas-200/50 border-2 border-dashed rounded-xl p-4 flex items-center gap-2 justify-between group transition-colors [&>*]:flex-1';
  const activeClasses = isActive ? 'border-brand' : 'border-canvas-300 hover:border-canvas-600';
  const missingClasses = isMissing ? 'border-finance-expense/60 bg-finance-expense/5' : '';

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    onDragOver?.(e);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    onDrop?.(e);
  };

  return (
    <div
      className={`${baseClasses} ${activeClasses} ${missingClasses} ${className}`}
      onDragOver={handleDragOver}
      onDragLeave={onDragLeave}
      onDrop={handleDrop}
    >
      {children}
    </div>
  );
};

export default DropTarget;