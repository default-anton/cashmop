import React, { RefObject } from 'react';
import { Search, ArrowRight, CheckCircle2, FastForward } from 'lucide-react';
import { Button } from '../../../components';

interface Category {
  id: number;
  name: string;
}

interface CategoryInputProps {
  inputRef: RefObject<HTMLInputElement>;
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
  return (
    <div className="relative">
      <div className="flex gap-4">
        <div className="relative flex-1">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-canvas-500">
            <Search className="w-5 h-5" />
          </div>
          <input
            ref={inputRef}
            autoFocus
            type="text"
            value={categoryInput}
            onChange={(e) => setCategoryInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (categoryInput) {
                  onCategorize(categoryInput);
                } else {
                  onSkip();
                }
              }
            }}
            placeholder={isRuleMode ? 'Set category for this rule...' : 'Type a category...'}
            className={`w-full bg-white border-2 rounded-2xl py-5 pl-12 pr-6 text-xl font-bold text-canvas-800 placeholder-canvas-300 focus:ring-0 transition-all shadow-sm ${isRuleMode ? 'border-brand ring-4 ring-brand/5' : 'border-canvas-200 focus:border-brand'
              }`}
          />

          {suggestions.length > 0 && (
            <div className="absolute top-full mt-2 left-0 w-full bg-white rounded-xl shadow-xl border border-canvas-200 overflow-hidden z-20">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onCategorize(s.name, s.id)}
                  className="w-full text-left px-6 py-3 hover:bg-brand/5 text-canvas-700 font-bold border-b border-canvas-100 last:border-0 transition-colors flex items-center justify-between group"
                >
                  {s.name}
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                </button>
              ))}
            </div>
          )}
        </div>

        <Button
          size="lg"
          variant="primary"
          className={`px-8 rounded-2xl transition-all duration-300 ${isRuleMode ? 'shadow-brand-glow scale-105' : 'shadow-brand/20'
            }`}
          onClick={() => (categoryInput ? onCategorize(categoryInput) : onSkip())}
        >
          {isRuleMode ? (
            <CheckCircle2 className="w-6 h-6" />
          ) : (
            <FastForward className="w-6 h-6" />
          )}
        </Button>
      </div>

      <p className="mt-4 text-center text-canvas-500 text-sm">
        {isRuleMode ? (
          <>
            Press{' '}
            <kbd className="px-2 py-1 bg-canvas-200 rounded text-xs font-mono text-canvas-800">
              ENTER
            </kbd>{' '}
            to save rule & categorize
          </>
        ) : (
          <>
            Press{' '}
            <kbd className="px-2 py-1 bg-canvas-200 rounded text-xs font-mono text-canvas-800">
              ENTER
            </kbd>{' '}
            to punch through
          </>
        )}
      </p>
    </div>
  );
};
