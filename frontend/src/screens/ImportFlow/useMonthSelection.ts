import { useEffect, useMemo } from "react";
import type { ImportMapping } from "./components/ColumnMapperTypes";
import { computeMonthsFromMapping } from "./helpers";
import type { ParsedFile } from "./types";

type UpdateCurrentFile = (updater: (file: ParsedFile) => ParsedFile) => void;

type UseMonthSelectionArgs = {
  currentFile: ParsedFile | null;
  mapping: ImportMapping;
  updateCurrentFile: UpdateCurrentFile;
};

export const useMonthSelection = ({ currentFile, mapping, updateCurrentFile }: UseMonthSelectionArgs) => {
  const monthOptions = useMemo(() => {
    if (!currentFile || !mapping?.csv?.date) return [] as ReturnType<typeof computeMonthsFromMapping>;
    return computeMonthsFromMapping(mapping, currentFile);
  }, [currentFile, mapping]);

  useEffect(() => {
    if (!currentFile) return;
    if (!mapping?.csv?.date) {
      if ((currentFile.selectedMonths && currentFile.selectedMonths.length > 0) || currentFile.monthSelectionTouched) {
        updateCurrentFile((file) => ({ ...file, selectedMonths: [], monthSelectionTouched: false }));
      }
      return;
    }

    if (!currentFile.selectedMonths || currentFile.selectedMonths.length === 0) return;

    const available = new Set(monthOptions.map((m) => m.key));
    const selected = currentFile.selectedMonths.filter((key) => available.has(key));
    if (selected.length !== currentFile.selectedMonths.length) {
      updateCurrentFile((file) => ({ ...file, selectedMonths: selected }));
    }
  }, [currentFile, mapping?.csv?.date, monthOptions, updateCurrentFile]);

  const rawSelectedMonths = useMemo(() => {
    if (!currentFile || !mapping?.csv?.date) return [];
    if (!currentFile.selectedMonths || currentFile.selectedMonths.length === 0) return [];
    const available = new Set(monthOptions.map((m) => m.key));
    return currentFile.selectedMonths.filter((key) => available.has(key));
  }, [currentFile, mapping?.csv?.date, monthOptions]);

  const defaultMonths = monthOptions.length > 0 ? [monthOptions[monthOptions.length - 1].key] : [];
  const selectionTouched = currentFile?.monthSelectionTouched ?? false;
  const selectedMonths =
    rawSelectedMonths.length > 0 ? rawSelectedMonths : selectionTouched ? [] : mapping?.csv?.date ? defaultMonths : [];
  const selectedMonthKeys = useMemo(() => new Set(selectedMonths), [selectedMonths]);

  const toggleMonth = (key: string) => {
    updateCurrentFile((file) => {
      const next = new Set(selectedMonths);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { ...file, selectedMonths: Array.from(next), monthSelectionTouched: true };
    });
  };

  const selectAllMonths = () => {
    if (!monthOptions.length) return;
    updateCurrentFile((file) => ({
      ...file,
      selectedMonths: monthOptions.map((m) => m.key),
      monthSelectionTouched: true,
    }));
  };

  const clearMonths = () => {
    updateCurrentFile((file) => ({ ...file, selectedMonths: [], monthSelectionTouched: true }));
  };

  return { monthOptions, selectedMonths, selectedMonthKeys, toggleMonth, selectAllMonths, clearMonths };
};
