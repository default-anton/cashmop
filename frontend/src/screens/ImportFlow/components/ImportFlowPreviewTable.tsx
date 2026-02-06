import type React from "react";

import { Card, Input, Select } from "@/components";
import { formatCentsDecimal } from "@/utils/currency";
import { getHeaderRole, parseAmountValue } from "../helpers";
import type { ColumnRole } from "../types";
import type { ImportMapping } from "./ColumnMapperTypes";

type PreviewTableProps = {
  headers: string[];
  columns: Array<{ header: string; index: number }>;
  rows: string[][];
  mapping: ImportMapping;
  roleOptions: Array<{ value: string; label: string }>;
  amountHint: string;
  onRoleChange: (header: string, role: ColumnRole) => void;
  onInvertToggle: () => void;
  onDirectionValueChange: (field: "negativeValue" | "positiveValue", value: string) => void;
};

const ImportFlowPreviewTable: React.FC<PreviewTableProps> = ({
  headers,
  columns,
  rows,
  mapping,
  roleOptions,
  amountHint,
  onRoleChange,
  onInvertToggle,
  onDirectionValueChange,
}) => {
  const renderCellValue = (header: string, raw: string, row: string[]) => {
    const role = getHeaderRole(mapping, header);
    if (role !== "money" && role !== "moneyOut" && role !== "moneyIn") {
      return raw;
    }

    const parsed = parseAmountValue(raw);
    if (parsed === null) return raw;

    const cents = Math.round(parsed * 100);
    const absCents = Math.abs(cents);

    let signedCents = absCents;
    if (role === "moneyOut") signedCents = -absCents;
    if (role === "moneyIn") signedCents = absCents;

    if (role === "money") {
      const am = mapping.csv.amountMapping;
      if (am.type === "single") {
        const invert = am.invertSign ?? false;
        signedCents = invert ? -cents : cents;
      }
      if (am.type === "amountWithType") {
        const typeIdx = am.typeColumn ? headers.indexOf(am.typeColumn) : -1;
        const typeVal = typeIdx !== -1 ? (row[typeIdx] ?? "").trim().toLowerCase() : "";
        const neg = (am.negativeValue ?? "debit").trim().toLowerCase();
        const pos = (am.positiveValue ?? "credit").trim().toLowerCase();
        if (typeVal && neg && typeVal === neg) signedCents = -absCents;
        else if (typeVal && pos && typeVal === pos) signedCents = absCents;
        else signedCents = absCents;
      }
    }

    const toneClass =
      signedCents === 0 ? "text-canvas-500" : signedCents < 0 ? "text-finance-expense" : "text-finance-income";

    return <span className={`font-mono font-semibold ${toneClass}`}>{formatCentsDecimal(Math.abs(signedCents))}</span>;
  };

  return (
    <Card variant="elevated" className="overflow-hidden p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-xs font-bold uppercase tracking-[0.1em] text-canvas-500 select-none">File preview</div>
        <div className="rounded-full border border-canvas-200 bg-canvas-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-canvas-500 select-none">
          {amountHint}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-canvas-200 bg-canvas-50/80">
        <table className="w-full border-collapse" data-testid="mapping-table">
          <thead>
            <tr className="bg-canvas-100/85">
              {columns.map(({ header, index }) => {
                const role = getHeaderRole(mapping, header);
                const amountMapping = mapping.csv.amountMapping;
                const amountWithType = amountMapping.type === "amountWithType" ? amountMapping : null;
                const isMoneyColumn = role === "money";
                const isDirectionColumn = role === "direction";
                const showInvert = isMoneyColumn && amountMapping.type === "single" && amountMapping.column === header;
                const showDirectionValues = isDirectionColumn && amountWithType && amountWithType.typeColumn === header;

                return (
                  <th
                    key={`${header}-${index}`}
                    data-column-header={header}
                    className="min-w-[170px] border-r border-canvas-200 px-3.5 py-3.5 align-top text-left last:border-r-0"
                  >
                    <div className="mb-2 truncate text-sm font-semibold text-canvas-700">{header}</div>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <Select
                          value={role}
                          onChange={(event) => onRoleChange(header, event.target.value as ColumnRole)}
                          options={roleOptions}
                          className="w-full !rounded-xl !border-canvas-300 !bg-canvas-50 !px-2.5 !py-2 !text-sm"
                        />
                        {showInvert && (
                          <button
                            type="button"
                            onClick={onInvertToggle}
                            className={`rounded-full border px-2 py-1 text-[11px] font-bold transition-colors ${
                              mapping.csv.amountMapping.invertSign
                                ? "border-brand/30 bg-brand/10 text-brand"
                                : "border-canvas-200 bg-canvas-50 text-canvas-500"
                            }`}
                            title="Flip sign"
                          >
                            ±
                          </button>
                        )}
                      </div>

                      {showDirectionValues && amountWithType && (
                        <div className="grid gap-2 rounded-xl border border-canvas-200 bg-canvas-50 p-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-canvas-500">
                              Out
                            </span>
                            <Input
                              value={amountWithType.negativeValue ?? "debit"}
                              onChange={(event) => onDirectionValueChange("negativeValue", event.target.value)}
                              className="text-xs"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-canvas-500">
                              In
                            </span>
                            <Input
                              value={amountWithType.positiveValue ?? "credit"}
                              onChange={(event) => onDirectionValueChange("positiveValue", event.target.value)}
                              className="text-xs"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-8 text-center text-sm italic text-canvas-500"
                  colSpan={Math.max(columns.length, 1)}
                >
                  No preview rows available.
                </td>
              </tr>
            ) : (
              rows.map((row, rowIdx) => (
                <tr key={rowIdx} className="border-t border-canvas-200 odd:bg-canvas-50/70 hover:bg-brand/[0.04]">
                  {columns.map(({ header }, colIdx) => (
                    <td key={`${header}-${colIdx}`} className="px-3.5 py-2.5 text-sm text-canvas-700">
                      {renderCellValue(header, row[colIdx] ?? "", row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default ImportFlowPreviewTable;
