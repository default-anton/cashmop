import React from 'react';

interface Tab {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange, className = '' }) => {
  return (
    <div className={`flex border-b border-canvas-200 ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-4 py-2 text-sm font-medium transition-colors relative ${
            activeTab === tab.id
              ? 'text-brand border-b-2 border-brand'
              : 'text-canvas-600 hover:text-canvas-800'
          }`}
        >
          {tab.label}
          {activeTab === tab.id && (
            <div className="absolute inset-x-0 -bottom-px h-0.5 bg-brand" />
          )}
        </button>
      ))}
    </div>
  );
};

export default Tabs;