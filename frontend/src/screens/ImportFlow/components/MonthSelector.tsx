import React, { useMemo, useState } from 'react';
import { Calendar, Check } from 'lucide-react';
import { Button, Card } from '../../../components';

export type MonthOption = {
  key: string;
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
        <h2 className="text-2xl font-bold text-canvas-800 mb-2">Select Range</h2>
        <p className="text-canvas-500">
          We found transactions spanning {months.length} month{months.length === 1 ? '' : 's'}.
        </p>
      </div>

      <Card variant="elevated" className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-canvas-500">
            Selected: <span className="font-mono text-canvas-700">{totalSelectedTxns}</span> txns
          </div>
          <div className="flex gap-2">
            <Button
              onClick={selectAll}
              variant="secondary"
              size="sm"
            >
              Select All
            </Button>
            <Button
              onClick={deselectAll}
              variant="secondary"
              size="sm"
            >
              Deselect All
            </Button>
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
                    : 'bg-canvas-200 text-canvas-600 border-canvas-300 hover:border-canvas-500')
                }
              >
                <div className="flex items-center gap-3">
                  <div className={
                    'p-2 rounded-lg ' + (isSelected ? 'bg-white/20' : 'bg-canvas-50')
                  }>
                    <Calendar className="w-5 h-5" />
                  </div>
                  <span className="font-semibold">{m.label}</span>
                </div>

                <div className="flex items-center gap-4">
                  <span className={
                    'text-sm font-mono ' + (isSelected ? 'text-white/80' : 'text-canvas-500')
                  }>
                    {m.count} txns
                  </span>
                  {isSelected && <Check className="w-5 h-5" />}
                </div>
              </button>
            );
          })}

          {months.length === 0 && (
            <div className="text-sm text-canvas-500 bg-canvas-50/50 border border-canvas-200 rounded-xl p-4">
              No months detected. Check that your Date mapping is correct.
            </div>
          )}
        </div>

        <Button
          onClick={() => onComplete(Array.from(selected))}
          disabled={!canStart}
          variant="primary"
          size="lg"
          className="w-full text-lg justify-center"
        >
          Continue
        </Button>
      </Card>
    </div>
  );
};

export default MonthSelector;
