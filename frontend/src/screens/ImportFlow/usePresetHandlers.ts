import { useCallback } from "react";

import type { ImportMapping, SavedMapping } from "./components/ColumnMapperTypes";
import { defaultMapping } from "./components/useColumnMapping";
import { NONE_PRESET_VALUE } from "./constants";
import { applyPresetToHeaders, suggestMappingName } from "./helpers";
import { heuristicPrefillMapping } from "./mappingDetection";
import type { ParsedFile } from "./types";

type UpdateCurrentFile = (updater: (file: ParsedFile) => ParsedFile) => void;

type PresetHandlersArgs = {
  currentFile: ParsedFile | null;
  savedMappings: SavedMapping[];
  defaultCurrency: string;
  updateCurrentFile: UpdateCurrentFile;
  setMapping: (mapping: ImportMapping) => void;
};

export const usePresetHandlers = ({
  currentFile,
  savedMappings,
  defaultCurrency,
  updateCurrentFile,
  setMapping,
}: PresetHandlersArgs) => {
  const handlePresetSelection = useCallback(
    (value: string) => {
      if (!currentFile) return;

      if (value === NONE_PRESET_VALUE) {
        const base = defaultMapping(defaultCurrency);
        const shouldPrefill =
          currentFile.hasHeader && !currentFile.autoMatchedMappingId && !currentFile.heuristicApplied;
        const mappingForFile = shouldPrefill ? heuristicPrefillMapping(currentFile.headers, base) : base;

        updateCurrentFile((file) => ({
          ...file,
          mapping: mappingForFile,
          userSelectedPresetId: null,
          heuristicApplied: file.heuristicApplied || shouldPrefill,
          mappingTouched: false,
          rememberMappingChoice: "off",
          rememberMappingTouched: false,
          rememberMappingError: null,
          rememberMappingName: file.rememberMappingName || suggestMappingName(file),
        }));
        setMapping(mappingForFile);
        return;
      }

      const id = Number(value);
      const selected = savedMappings.find((m) => m.id === id);
      if (!selected) return;

      const mappingForFile = applyPresetToHeaders(selected.mapping, currentFile.headers);
      updateCurrentFile((file) => ({
        ...file,
        mapping: mappingForFile,
        userSelectedPresetId: id,
        heuristicApplied: false,
        mappingTouched: false,
        rememberMappingChoice: "off",
        rememberMappingTouched: false,
        rememberMappingError: null,
        rememberMappingName: file.rememberMappingName || suggestMappingName(file),
      }));
      setMapping(mappingForFile);
    },
    [currentFile, defaultCurrency, savedMappings, setMapping, updateCurrentFile],
  );

  const handlePresetSubmit = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;
      if (trimmed.toLowerCase() === "none" || trimmed.toLowerCase() === "none (start fresh)") {
        handlePresetSelection(NONE_PRESET_VALUE);
        return;
      }

      const matched = savedMappings.find((m) => m.name.toLowerCase() === trimmed.toLowerCase());
      if (matched) {
        handlePresetSelection(String(matched.id));
      }
    },
    [handlePresetSelection, savedMappings],
  );

  return { handlePresetSelection, handlePresetSubmit };
};
