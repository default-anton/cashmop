import React from 'react';

interface Column<T> {
  key: string;
  header: React.ReactNode;
  render?: (value: any, row: T) => React.ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  className?: string;
}

const Table = <T,>({ columns, data, emptyMessage = 'No data available', className = '' }: TableProps<T>) => {
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
            {columns.map((column) => (
              <th
                key={column.key as string}
                className={`px-6 py-3 text-left text-[10px] font-bold text-canvas-500 uppercase tracking-widest ${column.className || ''}`}
              >
                {column.header}
              </th>
            ))}
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