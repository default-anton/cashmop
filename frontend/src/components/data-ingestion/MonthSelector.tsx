import React, { useState } from 'react';
import { Calendar, Check } from 'lucide-react';

interface MonthSelectorProps {
  onComplete: () => void;
}

const MonthSelector: React.FC<MonthSelectorProps> = ({ onComplete }) => {
  // Mock: Months found in the CSV
  const [months, setMonths] = useState([
    { label: "Aug 2025", count: 12, selected: false },
    { label: "Sep 2025", count: 45, selected: false },
    { label: "Oct 2025", count: 68, selected: true }, // Default to last month
  ]);

  const toggleMonth = (index: number) => {
    const newMonths = [...months];
    newMonths[index].selected = !newMonths[index].selected;
    setMonths(newMonths);
  };

  return (
    <div className="max-w-xl mx-auto animate-snap-in">
        <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">Select Range</h2>
            <p className="text-obsidian-400">
                We found transactions spanning 3 months. <br/>
                Which ones do you want to import?
            </p>
        </div>

        <div className="grid grid-cols-1 gap-3 mb-8">
            {months.map((m, index) => (
                <button 
                    key={m.label}
                    onClick={() => toggleMonth(index)}
                    className={`
                        flex items-center justify-between p-4 rounded-xl border transition-all duration-200
                        ${m.selected 
                            ? 'bg-brand text-white border-brand shadow-focus-ring' 
                            : 'bg-obsidian-800 text-obsidian-300 border-obsidian-700 hover:border-obsidian-500'
                        }
                    `}
                >
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${m.selected ? 'bg-white/20' : 'bg-obsidian-900'}`}>
                            <Calendar className="w-5 h-5" />
                        </div>
                        <span className="font-semibold">{m.label}</span>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <span className={`text-sm font-mono ${m.selected ? 'text-white/80' : 'text-obsidian-500'}`}>
                            {m.count} txns
                        </span>
                        {m.selected && <Check className="w-5 h-5" />}
                    </div>
                </button>
            ))}
        </div>

        <button 
            onClick={onComplete}
            className="w-full bg-white text-obsidian-950 hover:bg-obsidian-200 font-bold text-lg py-4 rounded-xl transition-colors shadow-lg"
        >
            Start Import
        </button>
    </div>
  );
};

export default MonthSelector;