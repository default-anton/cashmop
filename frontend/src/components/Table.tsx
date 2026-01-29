import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type React from "react";
import { type FilterConfig, TableHeaderFilter } from "./TableHeaderFilter";

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
  isCheckbox?: boolean;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  emptyDetail?: string;
  className?: string;
  sortField?: string;
  sortOrder?: "asc" | "desc";
  onSort?: (key: string) => void;
  rowKey?: (row: T) => string | number;
  selectedIds?: Set<string | number>;
  onSelectionChange?: (id: string | number, selected: boolean) => void;
}

const Table = <T,>({
  columns,
  data,
  emptyMessage = "No transactions found for this selection.",
  emptyDetail = "Use the filter above to adjust your selection.",
  className = "",
  sortField,
  sortOrder,
  onSort,
  rowKey,
  selectedIds,
  onSelectionChange,
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
              const isCheckbox = column.isCheckbox;
              if (isCheckbox) {
                const allSelected = data.length > 0 && data.every((row) => selectedIds?.has(getRowKey(row, 0)));
                const someSelected = data.some((row) => selectedIds?.has(getRowKey(row, 0)));
                return (
                  <th key="checkbox" className="px-6 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(input) => {
                        if (input) {
                          input.indeterminate = someSelected && !allSelected;
                        }
                      }}
                      onChange={(e) => {
                        const selected = e.target.checked;
                        data.forEach((row) => {
                          const key = getRowKey(row, 0);
                          onSelectionChange?.(key, selected);
                        });
                      }}
                      className="w-4 h-4 rounded border-canvas-300 text-brand focus:ring-brand focus:ring-offset-0 cursor-pointer"
                    />
                  </th>
                );
              }
              const isSorted = sortField === column.key;
              const canSort = column.sortable && onSort;
              const hasFilter = column.filter;

              return (
                <th
                  key={column.key as string}
                  className={`px-6 py-3 text-left text-[10px] font-bold text-canvas-500 uppercase tracking-widest transition-colors group relative select-none ${
                    canSort ? "cursor-pointer hover:bg-canvas-200/50 hover:text-canvas-700" : ""
                  } ${column.className || ""}`}
                  onClick={() => canSort && onSort(column.key)}
                  title={canSort ? `Sort by ${column.key}` : undefined}
                >
                  <div
                    className={`flex items-center gap-2 ${column.className?.includes("text-right") || column.className?.includes("justify-end") ? "justify-end" : ""}`}
                  >
                    {column.header}
                    <div className="flex items-center gap-1 shrink-0">
                      {canSort && (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            onSort(column.key);
                          }}
                          className={`cursor-pointer hover:text-brand select-none ${hasFilter ? "" : ""}`}
                        >
                          {isSorted ? (
                            sortOrder === "asc" ? (
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
                  <p className="select-none">{emptyMessage}</p>
                  {emptyDetail && <p className="text-xs select-none">{emptyDetail}</p>}
                </div>
              </td>
            </tr>
          </tbody>
        ) : (
          <tbody className="divide-y divide-canvas-200/50">
            {data.map((row, rowIndex) => (
              <tr
                key={getRowKey(row, rowIndex)}
                className={`hover:bg-brand/[0.02] even:bg-canvas-100/30 transition-colors group ${
                  selectedIds?.has(getRowKey(row, rowIndex)) ? "bg-brand/[0.03]" : ""
                }`}
              >
                {columns.map((column) => {
                  if (column.isCheckbox) {
                    const rowKeyVal = getRowKey(row, rowIndex);
                    return (
                      <td key="checkbox" className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds?.has(rowKeyVal) || false}
                          onChange={(e) => {
                            onSelectionChange?.(rowKeyVal, e.target.checked);
                          }}
                          className="w-4 h-4 rounded border-canvas-300 text-brand focus:ring-brand focus:ring-offset-0 cursor-pointer"
                        />
                      </td>
                    );
                  }
                  const value = (row as any)[column.key];
                  const renderedValue = column.render ? column.render(value, row) : String(value);
                  return (
                    <td
                      key={column.key as string}
                      className={`px-6 py-4 text-sm text-canvas-700 ${column.className || ""}`}
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
