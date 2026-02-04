import type { SavedMapping } from "./components/ColumnMapperTypes";
import { defaultMapping } from "./components/useColumnMapping";
import { suggestMappingName } from "./helpers";
import { heuristicPrefillMapping, pickBestMapping } from "./mappingDetection";
import type { ParsedFile } from "./types";
import { type ParsedFileBase, parseFile } from "./utils";

export const parseSelectedFiles = async (files: File[]) => {
  const parsedResults: ParsedFileBase[] = [];
  const errors = new Map<string, string>();

  for (const file of files) {
    try {
      const parsed = await parseFile(file);
      parsedResults.push(parsed);
    } catch (e) {
      errors.set(file.name, e instanceof Error ? e.message : "Failed to parse file");
    }
  }

  return { parsedResults, errors };
};

export const buildFileState = (file: ParsedFileBase, mappings: SavedMapping[], defaultCurrency: string): ParsedFile => {
  const baseMapping = defaultMapping(defaultCurrency);
  let mappingForFile = baseMapping;
  let autoMatchedMappingId: number | undefined;
  let autoMatchedMappingName: string | undefined;
  let heuristicApplied = false;

  if (file.hasHeader) {
    const picked = pickBestMapping(file, mappings);
    if (picked) {
      mappingForFile = picked.mapping;
      autoMatchedMappingId = picked.id;
      autoMatchedMappingName = picked.name;
    } else {
      mappingForFile = heuristicPrefillMapping(file.headers, baseMapping);
      heuristicApplied = true;
    }
  }

  return {
    ...file,
    mapping: mappingForFile,
    autoMatchedMappingId,
    autoMatchedMappingName,
    userSelectedPresetId: undefined,
    heuristicApplied,
    selectedMonths: [],
    monthSelectionTouched: false,
    mappingTouched: false,
    rememberMappingChoice: "off",
    rememberMappingTouched: false,
    rememberMappingName: suggestMappingName(file),
    rememberMappingError: null,
  };
};
