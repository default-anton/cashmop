import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Filter as Funnel, Search, X } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MISSING_FILTER_ID } from "../utils/filterIds";

export type FilterType = "category" | "text" | "amount" | "date";

export interface FilterConfig {
  type: FilterType;
  isActive: boolean;
  label?: string;
}

type TableHeaderFilterVariant = "header" | "bar";

interface TableHeaderFilterProps {
  config: FilterConfig;
  children: React.ReactNode;
  onClear?: () => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onToggle?: () => void;
  positionKey?: string | number;
  ariaLabel?: string;
  titleLabel?: string;
  variant?: TableHeaderFilterVariant;

  /**
   * When false, renders an icon-only trigger (still includes chevron/clear).
   * Useful for dense toolbars where the active state is shown elsewhere.
   */
  showLabel?: boolean;

  /**
   * Optional: provide a fully custom trigger (button) for this popover.
   * You must attach `buttonRef` to your trigger element for positioning.
   */
  renderTrigger?: (args: {
    buttonRef: React.RefObject<HTMLButtonElement | null>;
    isOpen: boolean;
    onToggle: () => void;
    onClear?: (e: React.MouseEvent) => void;
    showClear: boolean;
    ariaLabel?: string;
  }) => React.ReactNode;
}

export const TableHeaderFilter: React.FC<TableHeaderFilterProps> = ({
  config,
  children,
  onClear,
  isOpen: controlledIsOpen,
  onOpenChange,
  onToggle,
  positionKey,
  ariaLabel,
  titleLabel,
  variant = "header",
  showLabel = true,
  renderTrigger,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = onOpenChange || onToggle || setInternalIsOpen;

  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const popoverWidth = 320; // Approximate max width of popover
      const viewportWidth = window.innerWidth;

      // Default: align left with button
      let left = rect.left;

      // If not enough space on the right, align right
      if (left + popoverWidth > viewportWidth - 10) {
        left = rect.right - popoverWidth;
      }

      // Ensure it doesn't go off the left edge
      if (left < 10) {
        left = 10;
      }

      setPosition({
        top: rect.bottom + 4,
        left,
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    requestAnimationFrame(() => {
      updatePosition();
    });
  }, [isOpen, positionKey]);

  useEffect(() => {
    const handleScroll = () => {
      if (isOpen) {
        updatePosition();
      }
    };

    const handleResize = () => {
      if (isOpen) {
        updatePosition();
      }
    };

    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-autocomplete-dropdown="true"]')) {
        return;
      }
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, setIsOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, setIsOpen]);

  const Icon = variant === "bar" ? Funnel : Search;

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClear?.();
  };

  const handleToggle = () => {
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    if (newIsOpen) {
      // Force position update after a brief delay to ensure DOM is ready
      requestAnimationFrame(() => {
        updatePosition();
      });
    }
  };

  const popover = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={popoverRef}
          initial={{ opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: 0.15 }}
          style={{
            position: "fixed",
            top: position.top,
            left: position.left,
            width: "min-content",
            minWidth: "280px",
            maxWidth: "360px",
          }}
          className="bg-canvas-50 border border-canvas-200 rounded-2xl shadow-glass overflow-hidden z-[100]"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );

  const defaultTrigger = (
    <button
      ref={buttonRef}
      onClick={(e) => {
        e.stopPropagation();
        handleToggle();
      }}
      className={`
        flex items-center gap-2 transition-all duration-200 group relative z-10 select-none
        ${
          variant === "bar"
            ? `px-3 py-1.5 rounded-full border shadow-sm ${
                config.isActive
                  ? "border-brand/20 bg-brand/[0.06] text-canvas-900"
                  : "border-canvas-200 bg-canvas-50 text-canvas-800"
              } hover:bg-canvas-100`
            : `px-2 py-1 rounded-md ${
                config.isActive
                  ? "bg-brand/10 text-brand hover:bg-brand/15"
                  : "text-canvas-400 hover:text-canvas-600 hover:bg-canvas-100"
              }`
        }
      `}
      aria-label={ariaLabel}
      title={config.isActive ? "Filter active - click to edit" : "Add filter"}
    >
      <Icon className="w-3.5 h-3.5 opacity-70" />

      {showLabel &&
        (variant === "bar" ? (
          <div className="flex items-baseline gap-1.5">
            {titleLabel && (
              <span className="text-[10px] font-bold uppercase tracking-widest text-canvas-600">{titleLabel}:</span>
            )}
            <span className={`text-xs font-semibold ${config.isActive ? "text-canvas-900" : "text-canvas-700"}`}>
              {config.label}
            </span>
          </div>
        ) : (
          config.isActive &&
          config.label && <span className="text-[10px] font-bold uppercase tracking-tight">{config.label}</span>
        ))}

      <div className="flex items-center gap-1 ml-auto">
        {onClear && config.isActive && <X className="w-3 h-3 hover:text-canvas-900" onClick={handleClear} />}
        <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </div>
    </button>
  );

  const trigger =
    renderTrigger?.({
      buttonRef,
      isOpen,
      onToggle: handleToggle,
      onClear: onClear ? handleClear : undefined,
      showClear: !!onClear && config.isActive,
      ariaLabel,
    }) ?? defaultTrigger;

  return (
    <>
      {trigger}
      {createPortal(popover, document.body)}
    </>
  );
};

// Category filter content
export const CategoryFilterContent: React.FC<{
  categories: { id: number; name: string }[];
  selectedIds: number[];
  onSelect: (id: number) => void;
  onSelectOnly: (id: number, e?: React.MouseEvent) => void;
  onSelectAll: () => void;
  onClear: () => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  includeUncategorized?: boolean;
}> = ({
  categories,
  selectedIds,
  onSelect,
  onSelectOnly,
  onSelectAll,
  onClear,
  searchTerm,
  onSearchChange,
  inputRef,
  includeUncategorized = true,
}) => {
  const [filteredCategories, setFilteredCategories] = useState(categories);

  useEffect(() => {
    const uncategorizedOption: { id: number; name: string } = { id: MISSING_FILTER_ID, name: "Uncategorized" };

    const prefix = includeUncategorized ? [uncategorizedOption] : [];

    if (!searchTerm.trim()) {
      setFilteredCategories([...prefix, ...categories]);
      return;
    }

    const names = categories.map((c) => c.name);
    (window as any).go.main.App.FuzzySearch(searchTerm, names).then((rankedNames: string[]) => {
      const ranked = rankedNames
        .map((name) => categories.find((c) => c.name === name))
        .filter((c): c is { id: number; name: string } => !!c);
      setFilteredCategories([...prefix, ...ranked]);
    });
  }, [categories, searchTerm, includeUncategorized]);

  const selectedCount = selectedIds.length;
  const totalCount = categories.length + (includeUncategorized ? 1 : 0);
  const isAllSelected = selectedCount === totalCount;

  return (
    <div className="flex flex-col max-h-[360px]">
      <div className="p-3 border-b border-canvas-100 space-y-3">
        <div className="flex justify-between items-center px-1">
          <span className="text-[10px] font-bold text-canvas-600 uppercase tracking-widest select-none">
            Filter by Category
          </span>
          <div className="flex gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                isAllSelected ? onClear() : onSelectAll();
              }}
              className="text-[10px] font-bold text-brand uppercase hover:underline select-none"
            >
              {isAllSelected ? "Deselect All" : "Select All"}
            </button>
            {selectedCount > 0 && !isAllSelected && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                className="text-[10px] font-bold text-canvas-600 uppercase hover:text-canvas-800 hover:underline select-none"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-canvas-500 select-none" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search categories..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-canvas-100 border-none rounded-xl py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-brand/20 placeholder:text-canvas-500 outline-none"
          />
        </div>
      </div>

      <div className="overflow-y-auto flex-1 py-1 px-2">
        {filteredCategories.map((category) => {
          const isSelected = selectedIds.includes(category.id);
          return (
            <div key={category.id} className="group relative flex items-center">
              <button
                onClick={() => onSelect(category.id)}
                className="flex-1 flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-canvas-100 transition-colors select-none"
              >
                <span className={`text-sm ${isSelected ? "font-bold text-canvas-800" : "text-canvas-600"}`}>
                  {category.name}
                </span>
                <div
                  className={`
                  w-5 h-5 rounded-lg flex items-center justify-center border-2 transition-all
                  ${isSelected ? "bg-brand border-brand text-white" : "border-canvas-200 bg-white"}
                `}
                >
                  {isSelected && <Check className="w-3 h-3" strokeWidth={4} />}
                </div>
              </button>

              <button
                onClick={(e) => onSelectOnly(category.id, e)}
                className="absolute right-14 opacity-0 group-hover:opacity-100 px-2 py-1 rounded-md bg-canvas-200 text-[10px] font-bold text-canvas-600 hover:bg-canvas-300 transition-all z-10 select-none"
              >
                ONLY
              </button>
            </div>
          );
        })}

        {filteredCategories.length === 0 && (
          <div className="px-4 py-8 text-center text-canvas-500 text-sm italic select-none">
            {searchTerm ? "No matches found" : "No categories found"}
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-canvas-100 flex items-center justify-between">
        <span className="text-[10px] text-canvas-500 font-medium select-none">
          {selectedCount === 0 ? "No filters applied" : `${selectedCount} of ${totalCount} selected`}
        </span>
      </div>
    </div>
  );
};

// Owner filter content
export const OwnerFilterContent: React.FC<{
  owners: { id: number; name: string }[];
  selectedIds: number[];
  onSelect: (id: number) => void;
  onSelectOnly: (id: number, e?: React.MouseEvent) => void;
  onSelectAll: () => void;
  onClear: () => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  includeNoOwner?: boolean;
}> = ({
  owners,
  selectedIds,
  onSelect,
  onSelectOnly,
  onSelectAll,
  onClear,
  searchTerm,
  onSearchChange,
  inputRef,
  includeNoOwner = true,
}) => {
  const [filteredOwners, setFilteredOwners] = useState(owners);

  useEffect(() => {
    const noOwnerOption: { id: number; name: string } = { id: MISSING_FILTER_ID, name: "No Owner" };

    const prefix = includeNoOwner ? [noOwnerOption] : [];

    if (!searchTerm.trim()) {
      setFilteredOwners([...prefix, ...owners]);
      return;
    }

    const names = owners.map((o) => o.name);
    (window as any).go.main.App.FuzzySearch(searchTerm, names).then((rankedNames: string[]) => {
      const ranked = rankedNames
        .map((name) => owners.find((o) => o.name === name))
        .filter((o): o is { id: number; name: string } => !!o);
      setFilteredOwners([...prefix, ...ranked]);
    });
  }, [owners, searchTerm, includeNoOwner]);

  const selectedCount = selectedIds.length;
  const totalCount = owners.length + (includeNoOwner ? 1 : 0);
  const isAllSelected = selectedCount === totalCount;

  return (
    <div className="flex flex-col max-h-[360px]">
      <div className="p-3 border-b border-canvas-100 space-y-3">
        <div className="flex justify-between items-center px-1">
          <span className="text-[10px] font-bold text-canvas-600 uppercase tracking-widest select-none">
            Filter by Owner
          </span>
          <div className="flex gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                isAllSelected ? onClear() : onSelectAll();
              }}
              className="text-[10px] font-bold text-brand uppercase hover:underline select-none"
            >
              {isAllSelected ? "Deselect All" : "Select All"}
            </button>
            {selectedCount > 0 && !isAllSelected && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                className="text-[10px] font-bold text-canvas-600 uppercase hover:text-canvas-800 hover:underline select-none"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-canvas-500 select-none" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search owners..."
            aria-label="Search owners"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-canvas-100 border-none rounded-xl py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-brand/20 placeholder:text-canvas-500 outline-none"
          />
        </div>
      </div>

      <div className="overflow-y-auto flex-1 py-1 px-2">
        {filteredOwners.map((owner) => {
          const isSelected = selectedIds.includes(owner.id);
          return (
            <div key={owner.id} className="group relative flex items-center">
              <button
                onClick={() => onSelect(owner.id)}
                className="flex-1 flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-canvas-100 transition-colors select-none"
              >
                <span className={`text-sm ${isSelected ? "font-bold text-canvas-800" : "text-canvas-600"}`}>
                  {owner.name}
                </span>
                <div
                  className={`
                  w-5 h-5 rounded-lg flex items-center justify-center border-2 transition-all
                  ${isSelected ? "bg-brand border-brand text-white" : "border-canvas-200 bg-white"}
                `}
                >
                  {isSelected && <Check className="w-3 h-3" strokeWidth={4} />}
                </div>
              </button>

              <button
                onClick={(e) => onSelectOnly(owner.id, e)}
                className="absolute right-14 opacity-0 group-hover:opacity-100 px-2 py-1 rounded-md bg-canvas-200 text-[10px] font-bold text-canvas-600 hover:bg-canvas-300 transition-all z-10 select-none"
              >
                ONLY
              </button>
            </div>
          );
        })}

        {filteredOwners.length === 0 && (
          <div className="px-4 py-8 text-center text-canvas-500 text-sm italic select-none">
            {searchTerm ? "No matches found" : "No owners found"}
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-canvas-100 flex items-center justify-between">
        <span className="text-[10px] text-canvas-500 font-medium select-none">
          {selectedCount === 0 ? "No filters applied" : `${selectedCount} of ${totalCount} selected`}
        </span>
      </div>
    </div>
  );
};

// Text filter content (for description, etc.)
export const TextFilterContent: React.FC<{
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder?: string;
}> = ({ value, onChange, onClear, placeholder = "Search..." }) => {
  return (
    <div className="p-3 space-y-3">
      <div className="text-[10px] font-bold text-canvas-600 uppercase tracking-widest select-none">Text Filter</div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-canvas-500 select-none" />
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-canvas-100 border-none rounded-xl py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-brand/20 placeholder:text-canvas-500 outline-none"
          autoFocus
        />
      </div>
      {value && (
        <div className="flex justify-end">
          <button
            onClick={onClear}
            className="text-[10px] font-bold text-canvas-600 uppercase hover:text-canvas-800 hover:underline select-none"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
};
