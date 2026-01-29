import type React from "react";
import { useState } from "react";
import Pill from "./Pill";

interface DragReorderableListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onRemove: (index: number) => void;
  emptyPlaceholder?: React.ReactNode;
  className?: string;
}

const DragReorderableList = <T,>({
  items,
  renderItem,
  onReorder,
  onRemove,
  emptyPlaceholder,
  className = "",
}: DragReorderableListProps<T>) => {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    setDraggingIndex(index);
    e.dataTransfer.setData("text/plain", index.toString());
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };

  const handleDragLeave = (index: number) => () => {
    if (dragOverIndex === index) {
      setDragOverIndex(null);
    }
  };

  const handleDrop = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
    onReorder(sourceIndex, index);
    setDragOverIndex(null);
    setDraggingIndex(null);
  };

  const handleDragEnd = () => {
    setDraggingIndex(null);
    setDragOverIndex(null);
  };

  if (items.length === 0 && emptyPlaceholder) {
    return <div className={className}>{emptyPlaceholder}</div>;
  }

  return (
    <div className={`flex flex-wrap gap-2 justify-end ${className}`}>
      {items.map((item, index) => (
        <Pill
          key={index}
          draggable
          isDragging={draggingIndex === index}
          isDragOver={dragOverIndex === index}
          onDragStart={handleDragStart(index)}
          onDragOver={handleDragOver(index)}
          onDragLeave={handleDragLeave(index)}
          onDrop={handleDrop(index)}
          onDragEnd={handleDragEnd}
          onRemove={() => onRemove(index)}
        >
          {renderItem(item, index)}
        </Pill>
      ))}
    </div>
  );
};

export default DragReorderableList;
