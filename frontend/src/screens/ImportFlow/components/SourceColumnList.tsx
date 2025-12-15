import React from 'react';

interface SourceColumnListProps {
  csvHeaders: string[];
  usedHeaders: Set<string>;
}

export const SourceColumnList: React.FC<SourceColumnListProps> = ({ csvHeaders, usedHeaders }) => {
  return (
    <div className="w-1/3 bg-canvas-50 p-6 border-r border-canvas-200 overflow-y-auto">
      <h3 className="text-xs font-mono uppercase text-canvas-500 mb-4 tracking-wider">Found in File</h3>
      <div className="space-y-3">
        {csvHeaders.map((header) => {
          const isUsed = usedHeaders.has(header);
          return (
            <div
              key={header}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', header);
                e.dataTransfer.effectAllowed = 'move';
              }}
              className={
                'p-3 border rounded-lg cursor-grab active:cursor-grabbing transition-colors shadow-sm group ' +
                (isUsed
                  ? 'bg-canvas-50 border-canvas-200 text-canvas-600'
                  : 'bg-canvas-200 border-canvas-300 hover:border-canvas-500')
              }
              title={isUsed ? 'Already mapped (dropping elsewhere will move it)' : 'Drag to map'}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm">{header}</span>
                <div className={
                  'w-1.5 h-1.5 rounded-full transition-colors ' +
                  (isUsed ? 'bg-canvas-300' : 'bg-canvas-600 group-hover:bg-brand')
                } />
              </div>
            </div>
          );
        })}

        {csvHeaders.length === 0 && (
          <div className="text-sm text-canvas-500">No headers found.</div>
        )}
      </div>
    </div>
  );
};
