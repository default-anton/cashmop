import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Input from "./Input";

type AutocompleteOption = string | { value: string; label: string };

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (value: string) => void;
  onSubmit?: (value: string) => void;
  options: AutocompleteOption[];
  placeholder?: string;
  "aria-label"?: string;
  className?: string;
  autoFocus?: boolean;
  filterMode?: "includes" | "none";
  dropdownClassName?: string;
}

const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
  value,
  onChange,
  onSelect,
  onSubmit,
  options,
  placeholder,
  "aria-label": ariaLabel,
  className,
  autoFocus,
  filterMode = "includes",
  dropdownClassName = "z-20",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target) || dropdownRef.current?.contains(target)) {
        return;
      }
      if (containerRef.current && !containerRef.current.contains(target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const normalizedOptions = useMemo(
    () => options.map((opt) => (typeof opt === "string" ? { value: opt, label: opt } : opt)),
    [options],
  );

  const filteredOptions = useMemo(() => {
    if (filterMode === "none") return normalizedOptions;
    if (!value) return normalizedOptions;
    const needle = value.toLowerCase();
    return normalizedOptions.filter(
      (opt) => opt.label.toLowerCase().includes(needle) || opt.value.toLowerCase().includes(needle),
    );
  }, [filterMode, normalizedOptions, value]);

  const showDropdown = isOpen && filteredOptions.length > 0;

  useEffect(() => {
    if (!isOpen || !inputRef.current) return;
    const update = () => {
      if (!inputRef.current) return;
      const rect = inputRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [isOpen, value]);

  const handleSelect = (option: { value: string; label: string }) => {
    onChange(option.label);
    if (onSelect) {
      onSelect(option.value);
    }
    setIsOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (showDropdown) {
        const needle = value.trim().toLowerCase();
        const exact = filteredOptions.find(
          (option) => option.value.toLowerCase() === needle || option.label.toLowerCase() === needle,
        );
        handleSelect(exact || filteredOptions[0]);
      } else if (onSubmit) {
        onSubmit(value);
      }
    }
  };

  const dropdown = showDropdown ? (
    <div
      ref={dropdownRef}
      style={{ position: "absolute", top: coords.top, left: coords.left, width: coords.width }}
      className={dropdownClassName}
      data-autocomplete-dropdown="true"
      onMouseDown={(event) => event.preventDefault()}
    >
      <ul className="mt-1 bg-canvas-50 border border-canvas-200 rounded-md shadow-lg max-h-60 overflow-auto py-1 text-sm focus:outline-none animate-in fade-in zoom-in-95 duration-100">
        {filteredOptions.map((option) => (
          <li
            key={`${option.value}-${option.label}`}
            className="px-3 py-2 cursor-pointer hover:bg-brand/10 hover:text-brand text-canvas-700 transition-colors"
            onClick={() => handleSelect(option)}
          >
            {option.label}
          </li>
        ))}
      </ul>
    </div>
  ) : null;

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        className="w-full"
      />
      {dropdown ? createPortal(dropdown, document.body) : null}
    </div>
  );
};

export default AutocompleteInput;
