import type { ImportMapping, SavedMapping } from "./components/ColumnMapperTypes";

type FileForMappingDetection = {
  headers: string[];
  hasHeader: boolean;
  headerSource: "auto" | "manual";
};

export type PickedMapping = { mapping: ImportMapping; id: number; name: string };

export const normalizeHeader = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export const normalizedHeaders = (headers: string[]) => headers.map(normalizeHeader).filter((h) => h.length > 0);

export const uniqueSortedNormalizedHeaders = (headers: string[]) =>
  Array.from(new Set(normalizedHeaders(headers))).sort((a, b) => a.localeCompare(b));

export const headersSignature = (headers: string[]) => uniqueSortedNormalizedHeaders(headers).join("\u0000");

export const hasAmbiguousNormalizedHeaders = (headers: string[]) => {
  const seen = new Set<string>();
  for (const h of headers) {
    const key = normalizeHeader(h);
    if (!key) continue;
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
};

export const rebindMappingToHeaders = (m: ImportMapping, fileHeaders: string[]) => {
  const map = new Map<string, string>();
  for (const h of fileHeaders) {
    const key = normalizeHeader(h);
    if (!key) continue;
    if (!map.has(key)) map.set(key, h);
  }

  const resolve = (h?: string) => {
    const key = h ? normalizeHeader(h) : "";
    if (!key) return h;
    return map.get(key) ?? h;
  };

  const csv = m.csv;
  const amountMapping = (() => {
    const am = csv.amountMapping;
    if (am.type === "single") return { ...am, column: resolve(am.column) || am.column };
    if (am.type === "debitCredit") {
      return {
        ...am,
        debitColumn: am.debitColumn ? resolve(am.debitColumn) : undefined,
        creditColumn: am.creditColumn ? resolve(am.creditColumn) : undefined,
      };
    }
    return {
      ...am,
      amountColumn: resolve(am.amountColumn) || am.amountColumn,
      typeColumn: resolve(am.typeColumn) || am.typeColumn,
    };
  })();

  return {
    ...m,
    csv: {
      ...csv,
      date: resolve(csv.date) || csv.date,
      description: (csv.description || []).map((d) => resolve(d) || d),
      account: csv.account ? resolve(csv.account) : undefined,
      currency: csv.currency ? resolve(csv.currency) : undefined,
      amountMapping,
    },
  };
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeForMatch = (value: string) =>
  normalizeHeader(value)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const keywordMatches = (normalized: string, plain: string, keyword: string) => {
  const needle = keyword.trim().toLowerCase();
  if (!needle) return false;

  if (/^[a-z0-9]+$/.test(needle) && needle.length <= 3) {
    const regex = new RegExp(`\\b${escapeRegExp(needle)}\\b`);
    return regex.test(` ${plain} `);
  }

  if (normalized.includes(needle)) return true;
  return plain.includes(needle);
};

const findHeadersByKeywords = (headers: string[], keywords: string[]) => {
  const indexed = headers.map((header, index) => ({
    header,
    index,
    normalized: normalizeHeader(header),
    plain: normalizeForMatch(header),
  }));

  return indexed.filter((entry) => keywords.some((keyword) => keywordMatches(entry.normalized, entry.plain, keyword)));
};

const takeUniqueHeader = (candidates: Array<{ header: string }>, used: Set<string>) => {
  const unique = candidates.map((c) => c.header).filter((header) => !used.has(header));
  if (unique.length !== 1) return "";
  const header = unique[0];
  used.add(header);
  return header;
};

export const heuristicPrefillMapping = (headers: string[], baseMapping: ImportMapping): ImportMapping => {
  const next: ImportMapping = JSON.parse(JSON.stringify(baseMapping));
  next.csv.date = "";
  next.csv.description = [];
  next.csv.account = undefined;
  next.csv.currency = undefined;
  next.csv.amountMapping = { type: "single", column: "", invertSign: next.csv.amountMapping.invertSign ?? false };

  const used = new Set<string>();

  const dateHeader = takeUniqueHeader(findHeadersByKeywords(headers, ["date", "posted", "transaction date"]), used);
  if (dateHeader) {
    next.csv.date = dateHeader;
  }

  const descriptionCandidates = findHeadersByKeywords(headers, [
    "description",
    "desc",
    "memo",
    "payee",
    "merchant",
    "name",
  ])
    .filter((entry) => !used.has(entry.header))
    .sort((a, b) => a.index - b.index);

  next.csv.description = descriptionCandidates.map((entry) => entry.header);
  for (const header of next.csv.description) {
    used.add(header);
  }

  const debitCandidates = findHeadersByKeywords(headers, ["debit", "withdrawal", "out"]);
  const creditCandidates = findHeadersByKeywords(headers, ["credit", "deposit", "in"]);
  const typeCandidates = findHeadersByKeywords(headers, ["type", "dr/cr", "debit/credit", "direction"]);
  const amountCandidates = findHeadersByKeywords(headers, ["amount", "amt", "value"]);

  const debitHeader = takeUniqueHeader(debitCandidates, used);
  const creditHeader = takeUniqueHeader(creditCandidates, used);

  if (debitHeader || creditHeader) {
    next.csv.amountMapping = {
      type: "debitCredit",
      debitColumn: debitHeader || undefined,
      creditColumn: creditHeader || undefined,
      invertSign: next.csv.amountMapping.invertSign ?? false,
    };
  } else {
    const typeHeader = takeUniqueHeader(typeCandidates, used);
    const amountHeader = takeUniqueHeader(amountCandidates, used);

    if (typeHeader || amountHeader) {
      next.csv.amountMapping = {
        type: "amountWithType",
        amountColumn: amountHeader || "",
        typeColumn: typeHeader || "",
        negativeValue: "debit",
        positiveValue: "credit",
        invertSign: next.csv.amountMapping.invertSign ?? false,
      };
    } else {
      const singleAmount = takeUniqueHeader(amountCandidates, used);
      if (singleAmount) {
        next.csv.amountMapping = {
          type: "single",
          column: singleAmount,
          invertSign: next.csv.amountMapping.invertSign ?? false,
        };
      }
    }
  }

  const accountHeader = takeUniqueHeader(findHeadersByKeywords(headers, ["account"]), used);
  if (accountHeader) {
    next.csv.account = accountHeader;
    next.account = "";
  }

  const currencyHeader = takeUniqueHeader(findHeadersByKeywords(headers, ["currency", "ccy"]), used);
  if (currencyHeader) {
    next.csv.currency = currencyHeader;
  }

  return next;
};

const MIN_HEADERS_FOR_SUBSET_MATCH = 4;

export const pickBestMapping = (file: FileForMappingDetection, entries: SavedMapping[]): PickedMapping | null => {
  if (!file.hasHeader) return null;
  if (file.headerSource !== "auto") return null;
  if (hasAmbiguousNormalizedHeaders(file.headers)) return null;

  const fileSig = headersSignature(file.headers);

  for (const sm of entries) {
    const sig = sm.mapping.meta?.headers ? headersSignature(sm.mapping.meta.headers) : "";
    const sigHasHeader = sm.mapping.meta?.hasHeader;
    if (sig && sig === fileSig && (sigHasHeader === undefined || sigHasHeader === file.hasHeader)) {
      return { mapping: rebindMappingToHeaders(sm.mapping, file.headers), id: sm.id, name: sm.name };
    }
  }

  const headerSet = new Set(uniqueSortedNormalizedHeaders(file.headers));

  let best: PickedMapping | null = null;
  let bestScore = -1;
  let bestRatio = -1;
  let bestMetaSize = -1;

  for (const sm of entries) {
    const m = sm.mapping;

    const metaHasHeader = m.meta?.hasHeader;
    if (metaHasHeader !== undefined && metaHasHeader !== file.hasHeader) continue;

    const metaHeaders = m.meta?.headers;
    if (metaHeaders) {
      const metaSet = new Set(uniqueSortedNormalizedHeaders(metaHeaders));

      if (metaSet.size < MIN_HEADERS_FOR_SUBSET_MATCH) {
        continue;
      }

      let subset = true;
      for (const h of metaSet) {
        if (!headerSet.has(h)) {
          subset = false;
          break;
        }
      }
      if (!subset) continue;
    }

    const wants = (v?: string) => (v ? normalizeHeader(v) : "");
    let possible = 0;
    let score = 0;

    const dateNeed = wants(m.csv.date);
    possible += 1;
    const dateMatch = dateNeed.length > 0 && headerSet.has(dateNeed);
    if (dateMatch) score += 1;

    const descNeeds = (m.csv.description || []).map(wants).filter(Boolean);
    possible += descNeeds.length;
    let descMatchCount = 0;
    for (const d of descNeeds) {
      if (headerSet.has(d)) {
        score += 1;
        descMatchCount += 1;
      }
    }

    let amountMatch = false;
    const am = m.csv.amountMapping;
    if (am.type === "single") {
      possible += 1;
      amountMatch = headerSet.has(wants(am.column));
      if (amountMatch) score += 1;
    } else if (am.type === "debitCredit") {
      const debit = wants(am.debitColumn);
      const credit = wants(am.creditColumn);
      if (debit) possible += 1;
      if (credit) possible += 1;
      const debitOk = debit ? headerSet.has(debit) : false;
      const creditOk = credit ? headerSet.has(credit) : false;
      amountMatch = debitOk || creditOk;
      if (debitOk) score += 1;
      if (creditOk) score += 1;
    } else if (am.type === "amountWithType") {
      possible += 2;
      const amountOk = headerSet.has(wants(am.amountColumn));
      const typeOk = headerSet.has(wants(am.typeColumn));
      amountMatch = amountOk && typeOk;
      if (amountOk) score += 1;
      if (typeOk) score += 1;
    }

    for (const extra of [m.csv.account, m.csv.currency]) {
      const need = wants(extra);
      if (!need) continue;
      possible += 1;
      if (headerSet.has(need)) score += 1;
    }

    const ratio = possible > 0 ? score / possible : 0;

    const ok = dateMatch && amountMatch && descMatchCount >= 1;
    if (!ok) continue;

    const metaSize = metaHeaders ? new Set(uniqueSortedNormalizedHeaders(metaHeaders)).size : 0;

    if (
      ratio > bestRatio ||
      (ratio === bestRatio && score > bestScore) ||
      (ratio === bestRatio && score === bestScore && metaSize > bestMetaSize)
    ) {
      bestRatio = ratio;
      bestScore = score;
      bestMetaSize = metaSize;
      best = { mapping: rebindMappingToHeaders(m, file.headers), id: sm.id, name: sm.name };
    }
  }

  if (best && (bestScore >= 3 || bestRatio >= 0.75)) return best;
  return null;
};
