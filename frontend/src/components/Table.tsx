import React from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

interface Column<T> {
  key: string;
  header: React.ReactNode;
  render?: (value: any, row: T) => React.ReactNode;
  className?: string;
  sortable?: boolean;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  className?: string;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (key: string) => void;
}

const Table = <T,>({ 
  columns, 
  data, 
  emptyMessage = 'No data available', 
  className = '',
  sortField,
  sortOrder,
  onSort
}: TableProps<T>) => {
  if (data.length === 0) {
    return (
      <div className={`text-center py-8 text-canvas-500 ${className}`}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto rounded-lg border border-canvas-200 ${className}`}>
      <table className="w-full border-collapse">
        <thead className="bg-canvas-100/80 backdrop-blur-sm sticky top-0 z-10 border-b border-canvas-200">
          <tr>
            {columns.map((column) => {
              const isSorted = sortField === column.key;
              const canSort = column.sortable && onSort;

              return (
                <th
                  key={column.key as string}
                  className={`px-6 py-3 text-left text-[10px] font-bold text-canvas-500 uppercase tracking-widest transition-colors group ${
                    canSort ? 'cursor-pointer hover:bg-canvas-200/50 hover:text-canvas-700' : ''
                  } ${column.className || ''}`}
                  onClick={() => canSort && onSort(column.key)}
                  title={canSort ? `Sort by ${column.key}` : undefined}
                >
                  <div className={`flex items-center gap-2 ${column.className?.includes('text-right') || column.className?.includes('justify-end') ? 'justify-end' : ''}`}>
                    {column.header}
                    {canSort && (
                      <span className="shrink-0">
                        {isSorted ? (
                          sortOrder === 'asc' ? (
                            <ArrowUp className="w-3 h-3 text-brand" />
                          ) : (
                            <ArrowDown className="w-3 h-3 text-brand" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-canvas-200/50">
          {data.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className="hover:bg-brand/[0.02] even:bg-canvas-100/30 transition-colors group"
            >
              {columns.map((column) => {
                const value = (row as any)[column.key];
                const renderedValue = column.render ? column.render(value, row) : String(value);
                return (
                  <td
                    key={column.key as string}
                    className={`px-6 py-4 text-sm text-canvas-700 ${column.className || ''}`}
                  >
                    {renderedValue}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
