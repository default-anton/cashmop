import { ArrowRight, CheckCircle2, FastForward, Search } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Card } from "../../../components";

interface Category {
  id: number;
  name: string;
}

interface CategoryInputProps {
  inputRef: React.RefObject<HTMLInputElement | null>;
  categoryInput: string;
  setCategoryInput: (value: string) => void;
  onCategorize: (name: string, id?: number) => void;
  onSkip: () => void;
  suggestions: Category[];
  isRuleMode: boolean;
}

export const CategoryInput: React.FC<CategoryInputProps> = ({
  inputRef,
  categoryInput,
  setCategoryInput,
  onCategorize,
  onSkip,
  suggestions,
  isRuleMode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }, [suggestions]);

  useEffect(() => {
    if (!showSuggestions) return;

    const updatePosition = () => {
      if (!inputRef.current) return;
      const rect = inputRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;

      let left = rect.left;
      if (left + rect.width > viewportWidth - 10) {
        left = viewportWidth - rect.width - 10;
      }
      if (left < 10) {
        left = 10;
      }

      setDropdownPosition({
        top: rect.bottom + 4,
        left,
        width: rect.width,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [showSuggestions, inputRef]);

  useEffect(() => {
    if (!showSuggestions) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target) || dropdownRef.current?.contains(target)) {
        return;
      }
      setShowSuggestions(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSuggestions]);

  const dropdown = showSuggestions ? (
    <div
      ref={dropdownRef}
      style={{
        position: "fixed",
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        width: dropdownPosition.width,
      }}
      className="z-[110] overflow-hidden rounded-2xl border border-canvas-200 bg-white shadow-card"
      onMouseDown={(event) => event.preventDefault()}
    >
      {suggestions.map((s) => (
        <button
          key={s.id}
          onClick={() => {
            onCategorize(s.name, s.id);
            setShowSuggestions(false);
          }}
          className="group flex w-full items-center justify-between border-b border-canvas-100 px-4 py-2.5 text-left text-sm font-semibold text-canvas-700 transition-colors hover:bg-brand/5 hover:text-brand last:border-0"
        >
          {s.name}
          <ArrowRight className="h-4 w-4 text-canvas-400 transition-colors group-hover:text-brand" />
        </button>
      ))}
    </div>
  ) : null;

  return (
    <Card variant="default" className="relative w-full p-4 shadow-card">
      <div ref={containerRef} className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-canvas-500">
            <Search className="h-4 w-4" />
          </div>
          <input
            ref={inputRef}
            autoFocus
            type="text"
            value={categoryInput}
            onChange={(e) => setCategoryInput(e.target.value)}
            onFocus={() => {
              if (suggestions.length > 0) {
                setShowSuggestions(true);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (categoryInput) {
                  onCategorize(categoryInput);
                } else {
                  onSkip();
                }
              }
            }}
            placeholder={isRuleMode ? "Set category for this rule..." : "Type a category..."}
            aria-label={isRuleMode ? "Category for rule" : "Category"}
            className={`w-full rounded-2xl border bg-white py-2.5 pl-10 pr-4 text-sm font-semibold text-canvas-800 placeholder:text-canvas-400 focus:outline-none focus:ring-2 focus:ring-brand/15 ${
              isRuleMode ? "border-brand/45" : "border-canvas-200 focus:border-brand/45"
            }`}
          />
        </div>

        <Button
          size="md"
          variant="primary"
          aria-label={categoryInput ? "Categorize" : "Skip"}
          data-testid="categorize-submit-button"
          className={`w-full whitespace-nowrap sm:w-auto ${isRuleMode ? "ring-2 ring-brand/20" : ""}`}
          onClick={() => (categoryInput ? onCategorize(categoryInput) : onSkip())}
        >
          {categoryInput ? <CheckCircle2 className="h-4 w-4" /> : <FastForward className="h-4 w-4" />}
          {categoryInput ? "Categorize" : "Skip"}
        </Button>
      </div>

      <p className="mt-3 text-sm text-canvas-500 select-none">
        Press{" "}
        <kbd className="rounded border border-canvas-300 bg-canvas-100 px-1.5 py-0.5 font-mono text-xs text-canvas-700">
          Enter
        </kbd>{" "}
        {!categoryInput
          ? isRuleMode
            ? "to skip this rule and keep flowing"
            : "to skip this transaction"
          : isRuleMode
            ? "to save the rule and categorize matches"
            : "to categorize and move to the next transaction"}
      </p>

      {dropdown ? createPortal(dropdown, document.body) : null}
    </Card>
  );
};
