import { Check, ChevronDown, X } from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Card, Input, Tooltip } from "@/components";
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
  missingRequiredFields: string[];
  isMonthMissing: boolean;
  onRoleChange: (header: string, role: ColumnRole) => void;
  onInvertToggle: () => void;
  onDirectionValueChange: (field: "negativeValue" | "positiveValue", value: string) => void;
};

type ColumnRoleDropdownProps = {
  columnKey: string;
  header: string;
  role: ColumnRole;
  roleLabel: string;
  isMapped: boolean;
  roleOptions: Array<{ value: string; label: string }>;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onRoleSelect: (role: ColumnRole) => void;
};

const requiredMappingFields = ["Date", "Amount", "Description", "Account"];

const ColumnRoleDropdown: React.FC<ColumnRoleDropdownProps> = ({
  columnKey,
  header,
  role,
  roleLabel,
  isMapped,
  roleOptions,
  isOpen,
  onOpenChange,
  onRoleSelect,
}) => {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 280 });

  const updatePosition = () => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const viewportPadding = 10;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const width = Math.max(triggerRef.current.offsetWidth, 280);
    const heightEstimate = dropdownRef.current?.offsetHeight ?? roleOptions.length * 40 + 52;

    let left = rect.left;
    if (left + width > viewportWidth - viewportPadding) {
      left = viewportWidth - width - viewportPadding;
    }
    if (left < viewportPadding) {
      left = viewportPadding;
    }

    let top = rect.bottom + 6;
    if (top + heightEstimate > viewportHeight - viewportPadding) {
      top = rect.top - heightEstimate - 6;
    }
    if (top < viewportPadding) {
      top = viewportPadding;
    }

    setPosition({ top, left, width });
  };

  useEffect(() => {
    if (!isOpen) return;

    updatePosition();
    const rafId = requestAnimationFrame(updatePosition);

    const handleWindowChange = () => updatePosition();
    window.addEventListener("resize", handleWindowChange);
    window.addEventListener("scroll", handleWindowChange, true);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", handleWindowChange);
      window.removeEventListener("scroll", handleWindowChange, true);
    };
  }, [isOpen, roleOptions.length]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || dropdownRef.current?.contains(target)) {
        return;
      }
      onOpenChange(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onOpenChange]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onOpenChange]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onOpenChange(!isOpen);
        }}
        aria-label={`Column role for ${header}`}
        className={`flex w-full items-center justify-between rounded-xl border px-2.5 py-2 text-sm font-medium transition-colors ${
          isMapped
            ? "border-brand/25 bg-brand/[0.08] text-brand"
            : "border-canvas-300 bg-canvas-50 text-canvas-700 hover:border-canvas-400 hover:bg-canvas-100"
        }`}
        data-testid="column-role-trigger"
        data-column-role-key={columnKey}
      >
        <span className="truncate text-left">{roleLabel}</span>
        <ChevronDown className={`h-3.5 w-3.5 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{ position: "fixed", top: position.top, left: position.left, width: position.width }}
            className="z-[100] overflow-hidden rounded-2xl border border-canvas-200/90 bg-canvas-50/95 shadow-glass backdrop-blur-md"
            data-testid="column-role-options"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="space-y-2 p-3">
              <div className="px-1 text-xs font-bold uppercase tracking-[0.1em] text-canvas-600 select-none">
                Map column
              </div>
              <div className="space-y-1">
                {roleOptions.map((option) => {
                  const isSelected = option.value === role;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        onRoleSelect(option.value as ColumnRole);
                        onOpenChange(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-colors select-none ${
                        isSelected
                          ? "bg-brand/10 font-semibold text-brand"
                          : "text-canvas-700 hover:bg-canvas-100 hover:text-canvas-900"
                      }`}
                    >
                      <span>{option.label}</span>
                      {isSelected && <Check className="h-4 w-4" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};

const ImportFlowPreviewTable: React.FC<PreviewTableProps> = ({
  headers,
  columns,
  rows,
  mapping,
  roleOptions,
  amountHint,
  missingRequiredFields,
  isMonthMissing,
  onRoleChange,
  onInvertToggle,
  onDirectionValueChange,
}) => {
  const [openRoleColumnKey, setOpenRoleColumnKey] = useState<string | null>(null);

  const roleLabelByValue = useMemo(() => {
    return new Map(roleOptions.map((option) => [option.value, option.label]));
  }, [roleOptions]);

  const missingRequiredSet = useMemo(() => new Set(missingRequiredFields), [missingRequiredFields]);

  const keyedRows = useMemo(() => {
    const rowKeyCounts = new Map<string, number>();

    return rows.map((row) => {
      const baseRowKey = row.join("\u0001") || "__empty_row__";
      const seen = rowKeyCounts.get(baseRowKey) ?? 0;
      rowKeyCounts.set(baseRowKey, seen + 1);
      return { key: `${baseRowKey}-${seen}`, row };
    });
  }, [rows]);

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
      <div className="mb-4 space-y-3">
        <div className="text-xs font-bold uppercase tracking-[0.1em] text-canvas-500 select-none">File preview</div>

        <div
          className="rounded-2xl border border-canvas-200 bg-canvas-50/95 px-3.5 py-3"
          data-testid="required-mapping-fields"
        >
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-bold uppercase tracking-[0.1em] text-canvas-600 select-none">
              Required mapping
            </span>
            {requiredMappingFields.map((field) => {
              const missing = missingRequiredSet.has(field);
              return (
                <span
                  key={field}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs ${
                    missing
                      ? "border-canvas-200 bg-canvas-100 text-canvas-600"
                      : "border-finance-income/25 bg-finance-income/10 text-finance-income"
                  }`}
                >
                  <span className="font-semibold select-none">{field}</span>
                  <span className="font-medium uppercase tracking-[0.06em] select-none">
                    {missing ? "Needed" : "Mapped"}
                  </span>
                </span>
              );
            })}

            {isMonthMissing && <span className="text-xs text-canvas-500 select-none">Month needed before import</span>}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-canvas-200 bg-canvas-50/80">
        <table className="w-full border-collapse" data-testid="mapping-table">
          <thead>
            <tr className="bg-canvas-100/85">
              {columns.map(({ header, index }) => {
                const role = getHeaderRole(mapping, header);
                const roleLabel = roleLabelByValue.get(role) || "Not mapped";
                const amountMapping = mapping.csv.amountMapping;
                const amountWithType = amountMapping.type === "amountWithType" ? amountMapping : null;
                const isMoneyColumn = role === "money";
                const isDirectionColumn = role === "direction";
                const showInvert = isMoneyColumn && amountMapping.type === "single" && amountMapping.column === header;
                const showDirectionValues = isDirectionColumn && amountWithType && amountWithType.typeColumn === header;
                const isMappedColumn = role !== "ignore";
                const columnKey = `${header}-${index}`;

                return (
                  <th
                    key={columnKey}
                    data-column-header={header}
                    className={`min-w-[170px] border-r border-canvas-200 px-3.5 py-3.5 align-top text-left transition-colors last:border-r-0 ${
                      isMappedColumn ? "bg-brand/[0.05]" : ""
                    }`}
                  >
                    <div className="mb-1 truncate text-sm font-semibold text-canvas-800">{header}</div>
                    <div className="mb-2 text-xs text-canvas-500 select-none">
                      {isMappedColumn ? "Mapped" : "Not mapped"}
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <ColumnRoleDropdown
                            columnKey={columnKey}
                            header={header}
                            role={role}
                            roleLabel={roleLabel}
                            isMapped={isMappedColumn}
                            roleOptions={roleOptions}
                            isOpen={openRoleColumnKey === columnKey}
                            onOpenChange={(open) => setOpenRoleColumnKey(open ? columnKey : null)}
                            onRoleSelect={(nextRole) => onRoleChange(header, nextRole)}
                          />
                        </div>
                        {isMappedColumn && (
                          <button
                            type="button"
                            onClick={() => onRoleChange(header, "ignore")}
                            className="self-center rounded-full p-1.5 text-canvas-400 transition-colors hover:bg-brand/10 hover:text-brand"
                            aria-label={`Unmap ${header} column`}
                            title="Unmap column"
                            data-testid="column-role-clear"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {showInvert && (
                          <Tooltip content={amountHint}>
                            <button
                              type="button"
                              onClick={onInvertToggle}
                              className={`self-center rounded-full border px-2 py-1 text-[11px] font-bold transition-colors ${
                                mapping.csv.amountMapping.invertSign
                                  ? "border-brand/30 bg-brand/10 text-brand"
                                  : "border-canvas-200 bg-canvas-50 text-canvas-500"
                              }`}
                              title={amountHint}
                              aria-label="Flip amount sign"
                            >
                              ±
                            </button>
                          </Tooltip>
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
              keyedRows.map(({ key, row }) => (
                <tr key={key} className="border-t border-canvas-200 odd:bg-canvas-50/70 hover:bg-brand/[0.04]">
                  {columns.map(({ header, index: visibleColumnIndex }, colIdx) => {
                    const isMappedColumn = getHeaderRole(mapping, header) !== "ignore";
                    return (
                      <td
                        key={`${header}-${visibleColumnIndex}`}
                        className={`px-3.5 py-2.5 text-sm text-canvas-700 ${isMappedColumn ? "bg-brand/[0.03]" : ""}`}
                      >
                        {renderCellValue(header, row[colIdx] ?? "", row)}
                      </td>
                    );
                  })}
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
