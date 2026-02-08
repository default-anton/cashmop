import { Search, X } from "lucide-react";
import type React from "react";
import { Button } from "../../../components";

interface CategoryTableToolbarProps {
  search: string;
  categoryCount: number;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  onCreateCategory: () => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
}

const CategoryTableToolbar: React.FC<CategoryTableToolbarProps> = ({
  search,
  categoryCount,
  onSearchChange,
  onClearSearch,
  onCreateCategory,
  searchInputRef,
}) => {
  return (
    <div className="border-b border-canvas-200/80 bg-canvas-100/50 px-5 py-4">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <div className="relative flex h-11 min-w-[250px] items-center rounded-2xl border border-canvas-200 bg-canvas-50/90 px-2.5 shadow-sm">
          <Search className="ml-1 h-4 w-4 text-canvas-500 select-none" />
          <input
            ref={searchInputRef}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                onClearSearch();
              }
            }}
            aria-label="Search categories"
            placeholder="Search categories..."
            className="w-56 md:w-64 bg-transparent px-2.5 text-sm text-canvas-700 placeholder:text-canvas-500 focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={onClearSearch}
              className="rounded-md p-1 text-canvas-400 transition-colors hover:bg-canvas-100 hover:text-canvas-700 select-none"
              title="Clear search"
              aria-label="Clear category search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <p className="text-sm text-canvas-600 select-none">
          {categoryCount} categor{categoryCount === 1 ? "y" : "ies"}
        </p>

        <Button onClick={onCreateCategory} className="whitespace-nowrap">
          New Category
        </Button>

        {search.trim() && (
          <button
            type="button"
            onClick={onClearSearch}
            className="text-xs font-semibold uppercase tracking-[0.08em] text-brand hover:underline select-none"
          >
            Clear search
          </button>
        )}
      </div>
    </div>
  );
};

export default CategoryTableToolbar;
