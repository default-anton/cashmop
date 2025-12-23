import React, { useState, useRef, useEffect } from 'react';
import { Filter, Check, ChevronDown, X } from 'lucide-react';

interface Category {
  id: number;
  name: string;
}

interface CategoryMultiSelectProps {
  categories: Category[];
  selectedCategoryIds: number[];
  onChange: (ids: number[]) => void;
}

const CategoryMultiSelect: React.FC<CategoryMultiSelectProps> = ({
  categories,
  selectedCategoryIds,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleCategory = (id: number) => {
    const newSelection = selectedCategoryIds.includes(id)
      ? selectedCategoryIds.filter((sid) => sid !== id)
      : [...selectedCategoryIds, id];
    onChange(newSelection);
  };

  const clearSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const selectedCount = selectedCategoryIds.length;

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-2xl border transition-all duration-200
          ${isOpen
            ? 'bg-canvas-50 border-brand shadow-focus-ring'
            : 'bg-canvas-50 border-canvas-200 hover:border-canvas-300 shadow-sm'}
        `}
      >
        <Filter className={`w-4 h-4 ${selectedCount > 0 ? 'text-brand' : 'text-canvas-400'}`} />
        <span className="text-sm font-bold text-canvas-700">
          {selectedCount === 0
            ? 'All Categories'
            : `${selectedCount} Categor${selectedCount === 1 ? 'y' : 'ies'}`}
        </span>
        {selectedCount > 0 && (
          <div
            onClick={clearSelection}
            className="ml-1 p-0.5 rounded-full hover:bg-canvas-200 text-canvas-400 hover:text-canvas-600 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </div>
        )}
        <ChevronDown className={`w-4 h-4 text-canvas-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 w-64 bg-canvas-50 border border-canvas-200 rounded-2xl shadow-glass z-50 py-2 max-h-80 overflow-y-auto animate-snap-in">
          <div className="px-4 py-2 mb-1 border-b border-canvas-100 flex justify-between items-center">
             <span className="text-[10px] font-bold text-canvas-400 uppercase tracking-widest">Select Categories</span>
             {selectedCount > 0 && (
                <button
                  onClick={() => onChange([])}
                  className="text-[10px] font-bold text-brand uppercase hover:underline"
                >
                  Reset
                </button>
             )}
          </div>
          {categories.map((category) => {
            const isSelected = selectedCategoryIds.includes(category.id);
            return (
              <button
                key={category.id}
                onClick={() => toggleCategory(category.id)}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-canvas-100 transition-colors group"
              >
                <span className={`text-sm ${isSelected ? 'font-bold text-canvas-800' : 'text-canvas-600'}`}>
                  {category.name}
                </span>
                <div className={`
                  w-5 h-5 rounded-lg flex items-center justify-center border-2 transition-all
                  ${isSelected ? 'bg-brand border-brand text-white' : 'border-canvas-200 bg-white group-hover:border-canvas-300'}
                `}>
                  {isSelected && <Check className="w-3 h-3" strokeWidth={4} />}
                </div>
              </button>
            );
          })}
          {categories.length === 0 && (
            <div className="px-4 py-8 text-center text-canvas-400 text-sm italic">
              No categories found
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CategoryMultiSelect;
