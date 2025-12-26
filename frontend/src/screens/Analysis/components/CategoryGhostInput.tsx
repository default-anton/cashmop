import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { database } from '../../../../wailsjs/go/models';
import { motion, AnimatePresence } from 'framer-motion';

interface CategoryGhostInputProps {
  categories: database.Category[];
  initialValue: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}

const CategoryGhostInput: React.FC<CategoryGhostInputProps> = ({
  categories,
  initialValue,
  onSave,
  onCancel,
}) => {
  const [value, setValue] = useState(initialValue || '');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    if (!value.trim()) return [];
    return categories
      .filter(c => c.name.toLowerCase().includes(value.toLowerCase()) && c.name.toLowerCase() !== value.toLowerCase())
      .slice(0, 5);
  }, [categories, value]);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
    
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const finalValue = selectedIndex >= 0 ? suggestions[selectedIndex].name : value;
      onSave(finalValue);
    } else if (e.key === 'Escape') {
      onCancel();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    // If we click on a suggestion, don't trigger blur immediately
    if (dropdownRef.current?.contains(e.relatedTarget as Node)) {
      return;
    }
    onSave(value);
  };

  const dropdown = (
    <AnimatePresence>
      {suggestions.length > 0 && (
        <motion.div 
          ref={dropdownRef}
          initial={{ opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          style={{
            position: 'absolute',
            top: coords.top,
            left: coords.left,
            width: coords.width,
          }}
          className="mt-1 bg-white border border-canvas-200 rounded-lg shadow-xl z-[100] overflow-hidden"
          onMouseDown={(e: React.MouseEvent) => e.preventDefault()} // Prevent blur when clicking dropdown
        >
          {suggestions.map((suggestion, index) => (
            <div
              key={suggestion.id}
              className={`px-3 py-1.5 text-[10px] font-bold tracking-tight cursor-pointer transition-colors ${
                index === selectedIndex ? 'bg-brand/10 text-brand' : 'text-canvas-600 hover:bg-canvas-50'
              }`}
              onClick={() => onSave(suggestion.name)}
            >
              {suggestion.name}
            </div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <motion.div 
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="relative w-full"
    >
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSelectedIndex(-1);
        }}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className="w-full h-7 px-2 py-0.5 text-[10px] font-bold text-brand bg-brand/5 border border-brand/30 rounded-md tracking-tight outline-none focus:ring-2 focus:ring-brand/20 transition-all"
        placeholder="Category..."
      />
      {createPortal(dropdown, document.body)}
    </motion.div>
  );
};

export default CategoryGhostInput;
