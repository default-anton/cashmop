import type { ImportMapping } from "./components/ColumnMapperTypes";
import { rebindMappingToHeaders } from "./mappingDetection";
import type { ColumnRole, MonthOption, ParsedFile } from "./types";
import { createAmountParser, parseDateLoose } from "./utils";

export const suggestMappingName = (file: { file: File }) => {
  const base = file.file.name.replace(/\.[^.]+$/, "");
  const cleaned = base
    .replace(/[_-]+/g, " ")
    .replace(/\b\d{4}[-_]\d{2}([-_]\d{2})?\b/g, "")
    .replace(/\b\d{1,2}[-_]\d{1,2}[-_]\d{2,4}\b/g, "")
    .replace(/\b\d{4}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || base.trim() || "Import mapping";
};

export const computeMonthsFromMapping = (m: ImportMapping, pf: ParsedFile): MonthOption[] => {
  const buckets = new Map<string, { year: number; month: number; count: number }>();

  const dateHeader = m.csv.date;
  const idx = pf.headers.indexOf(dateHeader);
  if (idx === -1) return [];

  for (const row of pf.rows) {
    const d = parseDateLoose(row[idx] ?? "");
    if (!d) continue;

    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const key = `${year}-${String(month).padStart(2, "0")}`;

    const cur = buckets.get(key);
    if (cur) cur.count += 1;
    else buckets.set(key, { year, month, count: 1 });
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => {
      const label = new Date(v.year, v.month - 1, 1).toLocaleString("en-US", { month: "short", year: "numeric" });
      return { key, label, count: v.count };
    });
};

export const getMappedHeaders = (mapping: ImportMapping) => {
  const set = new Set<string>();
  const { csv } = mapping;
  if (csv.date) set.add(csv.date);
  if (csv.account) set.add(csv.account);
  if (csv.currency) set.add(csv.currency);
  for (const h of csv.description) {
    set.add(h);
  }

  const am = csv.amountMapping;
  if (am.type === "single" && am.column) set.add(am.column);
  if (am.type === "debitCredit") {
    if (am.debitColumn) set.add(am.debitColumn);
    if (am.creditColumn) set.add(am.creditColumn);
  }
  if (am.type === "amountWithType") {
    if (am.amountColumn) set.add(am.amountColumn);
    if (am.typeColumn) set.add(am.typeColumn);
  }

  return set;
};

export const getVisibleColumnIndexes = (headers: string[], rows: string[][], mappedHeaders: Set<string>) => {
  if (headers.length === 0) return [];
  if (rows.length === 0) return headers.map((_, idx) => idx);

  const filtered = headers
    .map((header, idx) => ({ header, idx }))
    .filter(({ header, idx }) => {
      const hasValue = rows.some((row) => (row[idx] ?? "").trim().length > 0);
      const isMapped = header ? mappedHeaders.has(header) : false;
      return hasValue || isMapped;
    })
    .map(({ idx }) => idx);

  return filtered.length > 0 ? filtered : headers.map((_, idx) => idx);
};

export const amountHintForMapping = (mapping: ImportMapping) => {
  const am = mapping.csv.amountMapping;
  if (am.type === "single") {
    if (!am.column) return "Pick the column(s) that contain money.";
    return "Use the ± button if the preview colors look flipped.";
  }

  if (am.type === "debitCredit") {
    if (!am.debitColumn && !am.creditColumn) return "Pick the column(s) that contain money.";
    return "We ignore the sign in the file. Out becomes -, in becomes +.";
  }

  if (!am.amountColumn && !am.typeColumn) return "Pick the column(s) that contain money.";
  if (!am.amountColumn) return "Pick the money column that pairs with Direction.";
  if (!am.typeColumn) return "Pick the Direction (in/out) column.";
  return "Signed or unsigned is fine — we ignore the sign and use Direction to choose +/-.";
};

export const getHeaderRole = (mapping: ImportMapping, header: string): ColumnRole => {
  if (mapping.csv.date === header) return "date";
  if (mapping.csv.description.includes(header)) return "description";
  if (mapping.csv.account === header) return "account";
  if (mapping.csv.currency === header) return "currency";

  const am = mapping.csv.amountMapping;
  if (am.type === "single" && am.column === header) return "money";
  if (am.type === "debitCredit") {
    if (am.debitColumn === header) return "moneyOut";
    if (am.creditColumn === header) return "moneyIn";
  }
  if (am.type === "amountWithType") {
    if (am.amountColumn === header) return "money";
    if (am.typeColumn === header) return "direction";
  }

  return "ignore";
};

export const buildRoleOptions = (hasDirection: boolean) => {
  const moneyLabel = hasDirection ? "Money (signed/unsigned)" : "Money (signed)";
  const options = [
    { value: "ignore", label: "Not mapped" },
    { value: "date", label: "Date" },
    { value: "description", label: "Description" },
    { value: "account", label: "Account" },
    { value: "currency", label: "Currency" },
    { value: "money", label: moneyLabel },
    { value: "moneyOut", label: "Money out" },
    { value: "moneyIn", label: "Money in" },
    { value: "direction", label: "Direction (in/out)" },
  ];
  return options.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
};

export const applyPresetToHeaders = (mapping: ImportMapping, headers: string[]) => {
  const rebound = rebindMappingToHeaders(mapping, headers);
  const headerSet = new Set(headers);
  const csv = rebound.csv;

  const nextAmountMapping = (() => {
    const am = csv.amountMapping;
    if (am.type === "single") {
      const column = headerSet.has(am.column) ? am.column : "";
      return { ...am, column };
    }
    if (am.type === "debitCredit") {
      return {
        ...am,
        debitColumn: am.debitColumn && headerSet.has(am.debitColumn) ? am.debitColumn : undefined,
        creditColumn: am.creditColumn && headerSet.has(am.creditColumn) ? am.creditColumn : undefined,
      };
    }
    return {
      ...am,
      amountColumn: headerSet.has(am.amountColumn) ? am.amountColumn : "",
      typeColumn: headerSet.has(am.typeColumn) ? am.typeColumn : "",
    };
  })();

  return {
    ...rebound,
    csv: {
      ...csv,
      date: headerSet.has(csv.date) ? csv.date : "",
      description: (csv.description || []).filter((d) => headerSet.has(d)),
      account: csv.account && headerSet.has(csv.account) ? csv.account : undefined,
      currency: csv.currency && headerSet.has(csv.currency) ? csv.currency : undefined,
      amountMapping: nextAmountMapping,
    },
  };
};

export const normalizeAmountMapping = (mapping: ImportMapping): ImportMapping => {
  const am = mapping.csv.amountMapping;
  if (am.type === "amountWithType" && !am.typeColumn) {
    if (am.amountColumn) {
      return {
        ...mapping,
        csv: {
          ...mapping.csv,
          amountMapping: {
            type: "single",
            column: am.amountColumn,
            invertSign: am.invertSign ?? false,
          },
        },
      };
    }
    return {
      ...mapping,
      csv: {
        ...mapping.csv,
        amountMapping: {
          type: "single",
          column: "",
          invertSign: am.invertSign ?? false,
        },
      },
    };
  }

  if (am.type === "debitCredit" && !am.debitColumn && !am.creditColumn) {
    return {
      ...mapping,
      csv: {
        ...mapping.csv,
        amountMapping: {
          type: "single",
          column: "",
          invertSign: am.invertSign ?? false,
        },
      },
    };
  }

  return mapping;
};

export const parseAmountValue = (raw: string) => {
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  if (!cleaned) return null;
  const parsed = parseFloat(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
};

export const applyRoleChange = (prev: ImportMapping, header: string, role: ColumnRole): ImportMapping => {
  const next: ImportMapping = JSON.parse(JSON.stringify(prev));

  next.csv.description = next.csv.description.filter((h) => h !== header);
  if (next.csv.date === header) next.csv.date = "";
  if (next.csv.account === header) delete next.csv.account;
  if (next.csv.currency === header) delete next.csv.currency;

  const am = next.csv.amountMapping;
  if (am.type === "single" && am.column === header) {
    next.csv.amountMapping = { type: "single", column: "", invertSign: am.invertSign ?? false };
  }
  if (am.type === "debitCredit") {
    if (am.debitColumn === header) {
      next.csv.amountMapping = { ...am, debitColumn: undefined };
    }
    if (am.creditColumn === header) {
      next.csv.amountMapping = { ...am, creditColumn: undefined };
    }
  }
  if (am.type === "amountWithType") {
    if (am.amountColumn === header) {
      next.csv.amountMapping = { ...am, amountColumn: "" };
    }
    if (am.typeColumn === header) {
      next.csv.amountMapping = { ...am, typeColumn: "" };
    }
  }

  const prevAm = prev.csv.amountMapping;
  const invertSign = prevAm.invertSign ?? false;
  const directionMapped = prevAm.type === "amountWithType" && !!prevAm.typeColumn;

  if (role === "date") {
    next.csv.date = header;
    return normalizeAmountMapping(next);
  }

  if (role === "description") {
    if (!next.csv.description.includes(header)) {
      next.csv.description = [...next.csv.description, header];
    }
    return normalizeAmountMapping(next);
  }

  if (role === "account") {
    next.csv.account = header;
    next.account = "";
    return normalizeAmountMapping(next);
  }

  if (role === "currency") {
    next.csv.currency = header;
    return normalizeAmountMapping(next);
  }

  if (role === "money") {
    if (directionMapped) {
      const existing = prevAm.type === "amountWithType" ? prevAm : null;
      const typeColumn = existing?.typeColumn && existing.typeColumn !== header ? existing.typeColumn : "";
      next.csv.amountMapping = {
        type: "amountWithType",
        amountColumn: header,
        typeColumn,
        negativeValue: existing?.negativeValue ?? "debit",
        positiveValue: existing?.positiveValue ?? "credit",
        invertSign,
      };
    } else {
      next.csv.amountMapping = { type: "single", column: header, invertSign };
    }
    return next;
  }

  if (role === "moneyOut") {
    const existing = prevAm.type === "debitCredit" ? prevAm : null;
    const creditColumn = existing?.creditColumn && existing.creditColumn !== header ? existing.creditColumn : undefined;
    next.csv.amountMapping = {
      type: "debitCredit",
      debitColumn: header,
      creditColumn,
      invertSign,
    };
    return next;
  }

  if (role === "moneyIn") {
    const existing = prevAm.type === "debitCredit" ? prevAm : null;
    const debitColumn = existing?.debitColumn && existing.debitColumn !== header ? existing.debitColumn : undefined;
    next.csv.amountMapping = {
      type: "debitCredit",
      debitColumn,
      creditColumn: header,
      invertSign,
    };
    return next;
  }

  if (role === "direction") {
    const existing = prevAm.type === "amountWithType" ? prevAm : null;
    const prevAmount = existing?.amountColumn || (prevAm.type === "single" ? prevAm.column : "");
    const amountColumn = prevAmount && prevAmount !== header ? prevAmount : "";
    next.csv.amountMapping = {
      type: "amountWithType",
      amountColumn: amountColumn || "",
      typeColumn: header,
      negativeValue: existing?.negativeValue ?? "debit",
      positiveValue: existing?.positiveValue ?? "credit",
      invertSign,
    };
    return next;
  }

  return normalizeAmountMapping(next);
};

export const normalizeTransactions = (pf: ParsedFile, m: ImportMapping, months: string[]) => {
  const out: any[] = [];
  const selectedSet = new Set(months);

  const headers = pf.headers;
  const dateIdx = headers.indexOf(m.csv.date);
  const descIdxs = m.csv.description.map((d) => headers.indexOf(d)).filter((i) => i !== -1);

  const amountFn = createAmountParser(m, headers);

  const accountIdx = m.csv.account ? headers.indexOf(m.csv.account) : -1;
  const currencyIdx = m.csv.currency ? headers.indexOf(m.csv.currency) : -1;

  for (const row of pf.rows) {
    const dStr = row[dateIdx];
    const dateObj = parseDateLoose(dStr ?? "");
    if (!dateObj) continue;

    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;
    const key = `${year}-${String(month).padStart(2, "0")}`;
    if (!selectedSet.has(key)) continue;

    const desc = descIdxs
      .map((i) => row[i])
      .filter(Boolean)
      .join(" ");

    const amount = amountFn(row);

    const rawCurrency = currencyIdx !== -1 ? row[currencyIdx] : "";
    const currency = (rawCurrency || m.currencyDefault || "").trim().toUpperCase();

    const y = dateObj.getFullYear();
    const mo = String(dateObj.getMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getDate()).padStart(2, "0");

    out.push({
      date: `${y}-${mo}-${day}`,
      description: desc,
      amount: amount,
      category: "",
      account: accountIdx !== -1 ? row[accountIdx] : m.account,
      owner: m.owner || "Unassigned",
      currency: currency || m.currencyDefault,
    });
  }

  return out;
};
