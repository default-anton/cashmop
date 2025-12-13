import React, { useMemo, useState } from 'react';
import { Calendar, Check } from 'lucide-react';

export type MonthOption = {
  key: string; // YYYY-MM
  label: string;
  count: number;
};

interface MonthSelectorProps {
  months: MonthOption[];
  onComplete: (selectedMonthKeys: string[]) => void;
}

const MonthSelector: React.FC<MonthSelectorProps> = ({ months, onComplete }) => {
  const defaultSelected = useMemo(() => {
    if (months.length === 0) return new Set<string>();
    return new Set<string>([months[months.length - 1].key]);
  }, [months]);

  const [selected, setSelected] = useState<Set<string>>(defaultSelected);

  React.useEffect(() => {
    setSelected(defaultSelected);
  }, [defaultSelected]);

  const totalSelectedTxns = useMemo(() => {
    const byKey = new Map(months.map((m) => [m.key, m.count] as const));
    let total = 0;
    selected.forEach((k) => (total += byKey.get(k) ?? 0));
    return total;
  }, [months, selected]);

  const toggleMonth = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(months.map((m) => m.key)));
  const deselectAll = () => setSelected(new Set());

  const canStart = selected.size > 0;

  return (
    <div className="max-w-xl mx-auto animate-snap-in">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Select Range</h2>
        <p className="text-obsidian-400">
          We found transactions spanning {months.length} month{months.length === 1 ? '' : 's'}.
        </p>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-obsidian-400">
          Selected: <span className="font-mono text-obsidian-200">{totalSelectedTxns}</span> txns
        </div>
        <div className="flex gap-2">
          <button
            onClick={selectAll}
            className="text-xs font-semibold px-3 py-1.5 rounded-md bg-obsidian-800 border border-obsidian-700 text-obsidian-200 hover:border-obsidian-500 transition-colors"
          >
            Select All
          </button>
          <button
            onClick={deselectAll}
            className="text-xs font-semibold px-3 py-1.5 rounded-md bg-obsidian-800 border border-obsidian-700 text-obsidian-200 hover:border-obsidian-500 transition-colors"
          >
            Deselect All
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 mb-8">
        {months.map((m) => {
          const isSelected = selected.has(m.key);
          return (
            <button
              key={m.key}
              onClick={() => toggleMonth(m.key)}
              className={
                'flex items-center justify-between p-4 rounded-xl border transition-all duration-200 ' +
                (isSelected
                  ? 'bg-brand text-white border-brand shadow-focus-ring'
                  : 'bg-obsidian-800 text-obsidian-300 border-obsidian-700 hover:border-obsidian-500')
              }
            >
              <div className="flex items-center gap-3">
                <div className={
                  'p-2 rounded-lg ' + (isSelected ? 'bg-white/20' : 'bg-obsidian-900')
                }>
                  <Calendar className="w-5 h-5" />
                </div>
                <span className="font-semibold">{m.label}</span>
              </div>

              <div className="flex items-center gap-4">
                <span className={
                  'text-sm font-mono ' + (isSelected ? 'text-white/80' : 'text-obsidian-500')
                }>
                  {m.count} txns
                </span>
                {isSelected && <Check className="w-5 h-5" />}
              </div>
            </button>
          );
        })}

        {months.length === 0 && (
          <div className="text-sm text-obsidian-500 bg-obsidian-900/50 border border-obsidian-800 rounded-xl p-4">
            No months detected. Check that your Date mapping is correct.
          </div>
        )}
      </div>

      <button
        onClick={() => onComplete(Array.from(selected))}
        disabled={!canStart}
        className={
          'w-full font-bold text-lg py-4 rounded-xl transition-colors shadow-lg ' +
          (canStart
            ? 'bg-white text-obsidian-950 hover:bg-obsidian-200'
            : 'bg-obsidian-800 text-obsidian-600 cursor-not-allowed')
        }
      >
        Continue
      </button>
    </div>
  );
};

export default MonthSelector;
