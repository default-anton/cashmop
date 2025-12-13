import React, { useState } from 'react';
import { Upload, Table, Calendar, Check } from 'lucide-react';

import FileDropZone from './FileDropZone';
import ColumnMapper from './ColumnMapper';
import MonthSelector from './MonthSelector';

export default function ImportFlow() {
  const [step, setStep] = useState(1); // 1: Upload, 2: Map, 3: Date Select

  // Configuration for the steps to keep the JSX clean
  const steps = [
    { id: 1, label: "Upload File", icon: Upload },
    { id: 2, label: "Map Columns", icon: Table },
    { id: 3, label: "Select Range", icon: Calendar },
  ];

  return (
    <div className="min-h-screen bg-obsidian-950 flex items-center justify-center p-8 font-sans text-obsidian-100">
      <div className="w-full max-w-4xl">

        <div className="mb-12">
          <div className="flex items-center justify-between relative">

            {/* The Connecting Line (Background) */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-obsidian-800 rounded-full -z-10" />

            {/* The Connecting Line (Progress Fill) */}
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-brand transition-all duration-500 rounded-full -z-10"
              style={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }}
            />

            {steps.map((s) => {
              const isActive = step === s.id;
              const isCompleted = step > s.id;
              const Icon = isCompleted ? Check : s.icon;

              return (
                <div key={s.id} className="flex flex-col items-center gap-2 bg-obsidian-950 px-2">
                  <div
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300
                      ${isActive
                        ? "border-brand bg-brand/10 text-brand shadow-[0_0_15px_rgba(99,102,241,0.5)] scale-110"
                        : isCompleted
                          ? "border-finance-income bg-finance-income text-obsidian-950 scale-100" // Completed = Green
                          : "border-obsidian-800 bg-obsidian-900 text-obsidian-600"
                      }
                    `}
                  >
                    <Icon className="w-5 h-5" strokeWidth={isCompleted ? 3 : 2} />
                  </div>

                  <span
                    className={`
                      text-xs font-bold tracking-wider uppercase transition-colors duration-300 absolute -bottom-8
                      ${isActive ? "text-white" : "text-obsidian-600"}
                    `}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-obsidian-900/30 border border-obsidian-800/50 rounded-2xl p-8 backdrop-blur-sm">
          {step === 1 && <FileDropZone onFileDrop={() => setStep(2)} />}
          {step === 2 && <ColumnMapper onComplete={() => setStep(3)} />}
          {step === 3 && <MonthSelector onComplete={() => console.log('Import Started')} />}
        </div>

      </div>
    </div>
  );
}
