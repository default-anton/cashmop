import React from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

interface AnalysisMonthSelectorProps {
  months: string[];
  selectedMonth: string;
  onChange: (month: string) => void;
}

const AnalysisMonthSelector: React.FC<AnalysisMonthSelectorProps> = ({
  months,
  selectedMonth,
  onChange,
}) => {
  const currentIndex = months.indexOf(selectedMonth);

  const formatMonth = (monthStr: string) => {
    if (!monthStr) return '';
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('default', { month: 'short', year: 'numeric' });
  };

  const handlePrevious = () => {
    if (currentIndex < months.length - 1) {
      onChange(months[currentIndex + 1]);
    }
  };

  const handleNext = () => {
    if (currentIndex > 0) {
      onChange(months[currentIndex - 1]);
    }
  };

  if (months.length === 0) return null;

  return (
    <div className="flex items-center gap-1 bg-canvas-50 p-1.5 rounded-2xl border border-canvas-200 shadow-sm" aria-label="Month Selector">
      <button
        onClick={handlePrevious}
        disabled={currentIndex >= months.length - 1}
        aria-label="Previous Month"
        className="p-2 rounded-lg hover:bg-canvas-200 disabled:opacity-40 disabled:hover:bg-transparent transition-colors text-canvas-600"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-2 px-2 justify-center" aria-label="Current Month">
        <Calendar className="w-4 h-4 text-brand" />
        <span className="text-sm font-bold text-canvas-800">
          {formatMonth(selectedMonth)}
        </span>
      </div>

      <button
        onClick={handleNext}
        disabled={currentIndex <= 0}
        aria-label="Next Month"
        className="p-2 rounded-lg hover:bg-canvas-200 disabled:opacity-40 disabled:hover:bg-transparent transition-colors text-canvas-600"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};

export default AnalysisMonthSelector;
