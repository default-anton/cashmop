import { useEffect, useMemo, useRef, useState } from 'react';

type FuzzySearchIndex<T> = {
  labels: string[];
  lookup: Map<string, T>;
};

const buildIndex = <T,>(items: T[], buildLabel: (item: T) => string): FuzzySearchIndex<T> => {
  const labels: string[] = [];
  const lookup = new Map<string, T>();
  items.forEach((item) => {
    const label = buildLabel(item);
    labels.push(label);
    lookup.set(label, item);
  });
  return { labels, lookup };
};

const runFuzzySearch = async (query: string, labels: string[], requestId: number, requestRef: { current: number }) => {
  const ranked: string[] = await (window as any).go.main.App.FuzzySearch(query, labels);
  if (requestId !== requestRef.current) return null;
  return ranked;
};

export const useFuzzySearch = <T,>(
  items: T[],
  buildLabel: (item: T) => string,
  query: string
) => {
  const searchRequestId = useRef(0);
  const [results, setResults] = useState<T[]>(items);

  const index = useMemo(() => buildIndex(items, buildLabel), [buildLabel, items]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults(items);
      return;
    }

    const requestId = ++searchRequestId.current;
    runFuzzySearch(trimmed, index.labels, requestId, searchRequestId).then((ranked) => {
      if (!ranked) return;
      const next = ranked
        .map((label) => index.lookup.get(label))
        .filter((item): item is T => !!item);
      setResults(next);
    });
  }, [index, items, query]);

  return results;
};
