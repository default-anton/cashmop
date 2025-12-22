import React, { useEffect, useMemo, useRef, useState } from 'react';
import Input from './Input';

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
}

const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
  value,
  onChange,
  options,
  placeholder,
  className,
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

  const filteredOptions = useMemo(() => {
    if (!value) return options;
    return options.filter((opt) => opt.toLowerCase().includes(value.toLowerCase()));
  }, [options, value]);

  const showDropdown = isOpen && filteredOptions.length > 0;

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className="w-full"
      />
      {showDropdown && (
        <ul className="absolute z-20 w-full mt-1 bg-canvas-50 border border-canvas-200 rounded-md shadow-lg max-h-60 overflow-auto py-1 text-sm focus:outline-none animate-in fade-in zoom-in-95 duration-100">
          {filteredOptions.map((option) => (
            <li
              key={option}
              className="px-3 py-2 cursor-pointer hover:bg-brand/10 hover:text-brand text-canvas-700 transition-colors"
              onClick={() => {
                onChange(option);
                setIsOpen(false);
              }}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AutocompleteInput;
