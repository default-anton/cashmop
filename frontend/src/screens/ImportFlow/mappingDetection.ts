import { type ImportMapping, type SavedMapping } from './components/ColumnMapperTypes';

type FileForMappingDetection = {
  headers: string[];
  hasHeader: boolean;
  headerSource: 'auto' | 'manual';
};

export type PickedMapping = { mapping: ImportMapping; id: number; name: string };

export const normalizeHeader = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

export const normalizedHeaders = (headers: string[]) => headers.map(normalizeHeader).filter((h) => h.length > 0);

export const uniqueSortedNormalizedHeaders = (headers: string[]) =>
  Array.from(new Set(normalizedHeaders(headers))).sort((a, b) => a.localeCompare(b));

export const headersSignature = (headers: string[]) => uniqueSortedNormalizedHeaders(headers).join('\u0000');

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
    const key = h ? normalizeHeader(h) : '';
    if (!key) return h;
    return map.get(key) ?? h;
  };

  const csv = m.csv;
  const amountMapping = (() => {
    const am = csv.amountMapping;
    if (am.type === 'single') return { ...am, column: resolve(am.column) || am.column };
    if (am.type === 'debitCredit') {
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
      owner: csv.owner ? resolve(csv.owner) : undefined,
      currency: csv.currency ? resolve(csv.currency) : undefined,
      amountMapping,
    },
  };
};

const MIN_HEADERS_FOR_SUBSET_MATCH = 4;

export const pickBestMapping = (file: FileForMappingDetection, entries: SavedMapping[]): PickedMapping | null => {
  if (!file.hasHeader) return null;
  if (file.headerSource !== 'auto') return null;
  if (hasAmbiguousNormalizedHeaders(file.headers)) return null;

  const fileSig = headersSignature(file.headers);

  for (const sm of entries) {
    const sig = sm.mapping.meta?.headers ? headersSignature(sm.mapping.meta.headers) : '';
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

    const wants = (v?: string) => (v ? normalizeHeader(v) : '');
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
    if (am.type === 'single') {
      possible += 1;
      amountMatch = headerSet.has(wants(am.column));
      if (amountMatch) score += 1;
    } else if (am.type === 'debitCredit') {
      const debit = wants(am.debitColumn);
      const credit = wants(am.creditColumn);
      if (debit) possible += 1;
      if (credit) possible += 1;
      const debitOk = debit ? headerSet.has(debit) : false;
      const creditOk = credit ? headerSet.has(credit) : false;
      amountMatch = debitOk || creditOk;
      if (debitOk) score += 1;
      if (creditOk) score += 1;
    } else if (am.type === 'amountWithType') {
      possible += 2;
      const amountOk = headerSet.has(wants(am.amountColumn));
      const typeOk = headerSet.has(wants(am.typeColumn));
      amountMatch = amountOk && typeOk;
      if (amountOk) score += 1;
      if (typeOk) score += 1;
    }

    for (const extra of [m.csv.account, m.csv.owner, m.csv.currency]) {
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
