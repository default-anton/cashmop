import React from 'react';

interface Column<T> {
  key: keyof T;
  header: string;
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
      <table className="w-full">
        <thead className="bg-canvas-100 border-b border-canvas-200">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key as string}
                className={`px-4 py-3 text-left text-xs font-semibold text-canvas-700 uppercase tracking-wider ${column.className || ''}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-canvas-200">
          {data.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-canvas-50 transition-colors">
              {columns.map((column) => {
                const value = row[column.key];
                const renderedValue = column.render ? column.render(value, row) : String(value);
                return (
                  <td
                    key={column.key as string}
                    className={`px-4 py-3 text-sm text-canvas-700 ${column.className || ''}`}
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