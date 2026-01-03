import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Filter, Check, ChevronDown, X, Search } from 'lucide-react';

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
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const toggleCategory = (id: number) => {
    const newSelection = selectedCategoryIds.includes(id)
      ? selectedCategoryIds.filter((sid) => sid !== id)
      : [...selectedCategoryIds, id];
    onChange(newSelection);
  };

  const selectOnly = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([id]);
  };

  const selectAll = () => {
    onChange([0, ...categories.map(c => c.id)]);
  };

  const clearSelection = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onChange([]);
  };

  const [filteredCategories, setFilteredCategories] = useState<Category[]>(categories);

  useEffect(() => {
    const uncategorizedOption: Category = { id: 0, name: 'Uncategorized' };

    if (!searchTerm.trim()) {
      setFilteredCategories([uncategorizedOption, ...categories]);
      return;
    }

    const names = categories.map(c => c.name);
    (window as any).go.main.App.FuzzySearch(searchTerm, names).then((rankedNames: string[]) => {
      const ranked = rankedNames
        .map(name => categories.find(c => c.name === name))
        .filter((c): c is Category => !!c);
      setFilteredCategories([uncategorizedOption, ...ranked]);
    });
  }, [categories, searchTerm]);

  const selectedCount = selectedCategoryIds.length;
  const isAllSelected = selectedCount === categories.length + 1;

  return (
    <div className="relative" ref={containerRef}>
      <div className="bg-canvas-50 p-1.5 rounded-2xl border border-canvas-200 shadow-sm">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200
            ${isOpen
              ? 'bg-canvas-100 text-brand'
              : 'hover:bg-canvas-100 text-canvas-700'}
          `}
        >
          <Filter className={`w-4 h-4 ${selectedCount > 0 ? 'text-brand' : 'text-canvas-400'}`} />
          <span className="text-sm font-bold">
            {selectedCount === 0
              ? 'All Categories'
              : selectedCount === categories.length + 1
                ? 'All Categories Selected'
                : `${selectedCount} Categor${selectedCount === 1 ? 'y' : 'ies'}`}
          </span>
          {selectedCount > 0 && (
            <div
              onClick={clearSelection}
              className="ml-1 p-0.5 rounded-full hover:bg-canvas-200 text-canvas-500 hover:text-canvas-800 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </div>
          )}
          <ChevronDown className={`w-4 h-4 text-canvas-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 w-72 bg-canvas-50 border border-canvas-200 rounded-2xl shadow-glass z-50 overflow-hidden animate-snap-in flex flex-col max-h-96">
          <div className="p-3 border-b border-canvas-100 space-y-3">
            <div className="flex justify-between items-center px-1">
               <span className="text-[10px] font-bold text-canvas-600 uppercase tracking-widest">Select Categories</span>
               <div className="flex gap-3">
                 <button
                    onClick={isAllSelected ? () => clearSelection() : selectAll}
                    className="text-[10px] font-bold text-brand uppercase hover:underline"
                  >
                    {isAllSelected ? 'Deselect All' : 'Select All'}
                  </button>
                  {selectedCount > 0 && !isAllSelected && (
                    <button
                      onClick={() => clearSelection()}
                      className="text-[10px] font-bold text-canvas-600 uppercase hover:text-canvas-800 hover:underline"
                    >
                      Reset
                    </button>
                  )}
               </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-canvas-500" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search categories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-canvas-100 border-none rounded-xl py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-brand/20 placeholder:text-canvas-500 outline-none"
              />
            </div>
          </div>

          <div className="overflow-y-auto flex-1 py-1">
            {filteredCategories.map((category) => {
              const isSelected = selectedCategoryIds.includes(category.id);
              return (
                <div
                  key={category.id}
                  className="group relative flex items-center px-2"
                >
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="flex-1 flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-canvas-100 transition-colors"
                  >
                    <span className={`text-sm ${isSelected ? 'font-bold text-canvas-800' : 'text-canvas-600'}`}>
                      {category.name}
                    </span>
                    <div className={`
                      w-5 h-5 rounded-lg flex items-center justify-center border-2 transition-all
                      ${isSelected ? 'bg-brand border-brand text-white' : 'border-canvas-200 bg-white'}
                    `}>
                      {isSelected && <Check className="w-3 h-3" strokeWidth={4} />}
                    </div>
                  </button>

                  <button
                    onClick={(e) => selectOnly(category.id, e)}
                    className="absolute right-12 opacity-0 group-hover:opacity-100 px-2 py-1 rounded-md bg-canvas-200 text-[10px] font-bold text-canvas-600 hover:bg-canvas-300 transition-all z-10"
                  >
                    ONLY
                  </button>
                </div>
              );
            })}

            {filteredCategories.length === 0 && (
              <div className="px-4 py-8 text-center text-canvas-500 text-sm italic">
                {searchTerm ? 'No matches found' : 'No categories found'}
              </div>
            )}
          </div>

          <div className="h-2" />
        </div>
      )}
    </div>
  );
};

export default CategoryMultiSelect;
