import React from 'react';
import { ArrowRight, Save } from 'lucide-react';

interface ColumnMapperProps {
  onComplete: () => void;
}

const ColumnMapper: React.FC<ColumnMapperProps> = ({ onComplete }) => {
  // Mock Data
  const csvHeaders = ["Transaction Date", "Posting Date", "Description 1", "Debit", "Credit", "Card Member"];
  const appSchema = [
    { key: "date", label: "Date", required: true },
    { key: "desc", label: "Description", required: true },
    { key: "amount", label: "Amount", required: true },
    { key: "owner", label: "Owner", required: false }, // For multi-user setup
  ];

  return (
    <div className="bg-obsidian-900 border border-obsidian-800 rounded-xl shadow-glass overflow-hidden animate-snap-in">
      {/* Header: Save Mapping Logic */}
      <div className="bg-obsidian-950 p-4 border-b border-obsidian-800 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h2 className="font-bold text-white">Map Columns</h2>
          <div className="h-4 w-px bg-obsidian-700 mx-2"></div>
          {/* Saved Mapping Dropdown */}
          <select className="bg-obsidian-900 border border-obsidian-700 text-sm rounded-md px-2 py-1 focus:ring-1 focus:ring-brand outline-none">
            <option>New Mapping...</option>
            <option>RBC Bank (Saved)</option>
            <option>TD Visa (Saved)</option>
          </select>
        </div>
        <button
          onClick={onComplete}
          className="flex items-center gap-2 bg-brand hover:bg-brand-hover text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          Next Step <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="flex h-[500px]">
        {/* Left: Source Columns (Draggables) */}
        <div className="w-1/3 bg-obsidian-900 p-6 border-r border-obsidian-800 overflow-y-auto">
          <h3 className="text-xs font-mono uppercase text-obsidian-500 mb-4 tracking-wider">Found in CSV</h3>
          <div className="space-y-3">
            {csvHeaders.map((header) => (
              <div key={header} className="p-3 bg-obsidian-800 border border-obsidian-700 rounded-lg cursor-grab active:cursor-grabbing hover:border-obsidian-500 transition-colors shadow-sm group">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-obsidian-200">{header}</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-obsidian-600 group-hover:bg-brand"></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Target Schema (Drop Targets) */}
        <div className="w-2/3 bg-obsidian-950/50 p-6 overflow-y-auto">
          <h3 className="text-xs font-mono uppercase text-obsidian-500 mb-4 tracking-wider">App Schema</h3>
          <div className="grid gap-4">
            {appSchema.map((field) => (
              <div key={field.key} className="bg-obsidian-800/50 border-2 border-dashed border-obsidian-700 rounded-xl p-4 flex items-center justify-between group hover:border-obsidian-600 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${field.required ? 'bg-obsidian-700 text-obsidian-300' : 'bg-obsidian-800 text-obsidian-500'}`}>
                    <span className="text-xs font-bold">{field.label[0]}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-obsidian-200">{field.label}</p>
                    <p className="text-xs text-obsidian-500">{field.required ? 'Required' : 'Optional'}</p>
                  </div>
                </div>
                {/* Empty State / Drop Indication */}
                <div className="text-xs text-obsidian-600 font-mono bg-obsidian-900 px-3 py-1.5 rounded border border-obsidian-800">
                  Drop CSV column here
                </div>
              </div>
            ))}
          </div>

          {/* Save Mapping Option */}
          <div className="mt-8 flex items-center gap-2 p-4 bg-brand/5 border border-brand/20 rounded-lg">
            <Save className="w-4 h-4 text-brand" />
            <input
              type="text"
              placeholder="Name this mapping (e.g., RBC Checking)"
              className="bg-transparent text-sm text-white placeholder-obsidian-500 focus:outline-none w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ColumnMapper;
