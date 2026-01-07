import React from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { TableHeaderFilter, FilterConfig } from './TableHeaderFilter';

interface Column<T> {
  key: string;
  header: React.ReactNode;
  render?: (value: any, row: T) => React.ReactNode;
  className?: string;
  sortable?: boolean;
  filter?: {
    config: FilterConfig;
    children: React.ReactNode;
    onClear?: () => void;
    isOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    onToggle?: () => void;
    positionKey?: string | number;
  };
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  className?: string;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  rowKey?: (row: T) => string | number;
}

const Table = <T,>({
  columns,
  data,
  emptyMessage = 'No data available',
  className = '',
  sortField,
  sortOrder,
  onSort,
  rowKey
}: TableProps<T>) => {
  const getRowKey = (row: T, index: number) => {
    if (rowKey) return rowKey(row);
    if ((row as any).id !== undefined) return (row as any).id;
    return index;
  };

  return (
    <div className={`overflow-x-auto rounded-lg border border-canvas-200 ${className}`}>
      <table className="w-full border-collapse">
        <thead className="bg-canvas-100/80 backdrop-blur-sm sticky top-0 z-10 border-b border-canvas-200">
          <tr>
            {columns.map((column) => {
              const isSorted = sortField === column.key;
              const canSort = column.sortable && onSort;
              const hasFilter = column.filter;

              return (
                <th
                  key={column.key as string}
                  className={`px-6 py-3 text-left text-[10px] font-bold text-canvas-500 uppercase tracking-widest transition-colors group relative ${
                    canSort ? 'cursor-pointer hover:bg-canvas-200/50 hover:text-canvas-700' : ''
                  } ${column.className || ''}`}
                  onClick={() => canSort && onSort(column.key)}
                  title={canSort ? `Sort by ${column.key}` : undefined}
                >
                  <div className={`flex items-center gap-2 ${column.className?.includes('text-right') || column.className?.includes('justify-end') ? 'justify-end' : ''}`}>
                    {column.header}
                    <div className="flex items-center gap-1 shrink-0">
                      {canSort && (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            onSort(column.key);
                          }}
                          className={`cursor-pointer hover:text-brand ${hasFilter ? '' : ''}`}
                        >
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
                      {hasFilter && column.filter && (
                        <TableHeaderFilter
                          config={column.filter.config}
                          onClear={column.filter.onClear}
                          isOpen={column.filter.isOpen}
                          onOpenChange={column.filter.onOpenChange}
                          onToggle={column.filter.onToggle}
                          positionKey={column.filter.positionKey}
                        >
                          {column.filter.children}
                        </TableHeaderFilter>
                      )}
                    </div>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        {data.length === 0 ? (
          <tbody>
            <tr>
              <td colSpan={columns.length} className="px-6 py-8 text-center text-sm text-canvas-500">
                <div className="space-y-2">
                  <p>No transactions found for this selection.</p>
                  <p className="text-xs">Use the filter above to adjust your selection.</p>
                </div>
              </td>
            </tr>
          </tbody>
        ) : (
          <tbody className="divide-y divide-canvas-200/50">
            {data.map((row, rowIndex) => (
              <tr
                key={getRowKey(row, rowIndex)}
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
        )}
      </table>
    </div>
  );
};

export default Table;
