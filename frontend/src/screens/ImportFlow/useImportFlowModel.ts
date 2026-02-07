import { useEffect, useMemo, useState } from "react";

import { useCurrency } from "@/contexts/CurrencyContext";
import { useToast } from "@/contexts/ToastContext";
import type { ImportMapping, SavedMapping } from "./components/ColumnMapperTypes";
import { useColumnMapping } from "./components/useColumnMapping";
import { NONE_PRESET_VALUE } from "./constants";
import { fetchAccountsOwners, fetchSavedMappings } from "./dataLoaders";
import { buildFileState, parseSelectedFiles } from "./fileParsing";
import {
  amountHintForMapping,
  applyRoleChange,
  buildRoleOptions,
  getMappedHeaders,
  getVisibleColumnIndexes,
  normalizeTransactions,
} from "./helpers";
import { pickBestMapping, uniqueSortedNormalizedHeaders } from "./mappingDetection";
import type { ColumnRole, ParsedFile } from "./types";
import { useMonthSelection } from "./useMonthSelection";
import { usePresetHandlers } from "./usePresetHandlers";
import { sampleUniqueRows } from "./utils";

export const useImportFlowModel = (onImportComplete?: () => void) => {
  const toast = useToast();
  const { warning, refresh, currencyOptions, mainCurrency } = useCurrency();

  const [parseBusy, setParseBusy] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [parsedFiles, setParsedFiles] = useState<ParsedFile[]>([]);
  const [fileErrors, setFileErrors] = useState<Map<string, string>>(new Map());
  const [currentFileIdx, setCurrentFileIdx] = useState(0);

  const [savedMappings, setSavedMappings] = useState<SavedMapping[]>([]);
  const [importComplete, setImportComplete] = useState(false);
  const [importBusy, setImportBusy] = useState(false);

  const [presetInput, setPresetInput] = useState("");
  const [currencyInput, setCurrencyInput] = useState(mainCurrency || "CAD");
  const [availableAccounts, setAvailableAccounts] = useState<string[]>([]);
  const [availableOwners, setAvailableOwners] = useState<string[]>([]);

  const currentFile = parsedFiles[currentFileIdx] ?? null;
  const isLastFile = currentFileIdx >= parsedFiles.length - 1;

  const { mapping, setMapping, isMissing, canProceed, reorderDescription } = useColumnMapping(
    currentFile?.mapping,
    mainCurrency || "CAD",
  );

  useEffect(() => {
    if (!currentFile) return;
    if (!currentFile.mappingTouched && currentFile.mapping && mapping !== currentFile.mapping) {
      return;
    }
    setParsedFiles((prev) => {
      const next = [...prev];
      if (!next[currentFileIdx]) return prev;
      next[currentFileIdx] = { ...next[currentFileIdx], mapping };
      return next;
    });
  }, [currentFileIdx, currentFile, mapping]);

  useEffect(() => {
    const load = async () => {
      try {
        const loaded = await fetchSavedMappings();
        setSavedMappings(loaded);
      } catch (e) {
        console.error("Failed to load saved mappings", e);
      }
    };

    void load();
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const { accounts, owners } = await fetchAccountsOwners();
        setAvailableAccounts(accounts);
        setAvailableOwners(owners);
      } catch (e) {
        console.error("Failed to load accounts/owners", e);
      }
    };

    void load();
  }, []);

  useEffect(() => {
    if (!mapping?.currencyDefault) return;
    const label =
      currencyOptions.find((option) => option.value === mapping.currencyDefault)?.label || mapping.currencyDefault;
    setCurrencyInput(label);
  }, [currencyOptions, mapping?.currencyDefault]);

  const updateCurrentFile = (updater: (file: ParsedFile) => ParsedFile) => {
    setParsedFiles((prev) => {
      const next = [...prev];
      if (!next[currentFileIdx]) return prev;
      next[currentFileIdx] = updater(next[currentFileIdx]);
      return next;
    });
  };

  const markMappingTouched = () => {
    if (!currentFile) return;
    if (currentFile.mappingTouched) return;
    updateCurrentFile((file) => ({ ...file, mappingTouched: true }));
  };

  const presetInfo = useMemo(() => {
    if (!currentFile) {
      return { id: null as number | null, name: "", source: "none" as const };
    }

    if (currentFile.userSelectedPresetId !== undefined) {
      if (currentFile.userSelectedPresetId === null) {
        return { id: null as number | null, name: "None (start fresh)", source: "none" as const };
      }

      const selected = savedMappings.find((m) => m.id === currentFile.userSelectedPresetId);
      return {
        id: currentFile.userSelectedPresetId,
        name: selected?.name || "Unknown mapping",
        source: "user" as const,
      };
    }

    if (currentFile.autoMatchedMappingId) {
      return {
        id: currentFile.autoMatchedMappingId,
        name: currentFile.autoMatchedMappingName || "Auto-matched",
        source: "auto" as const,
      };
    }

    return { id: null as number | null, name: "None (start fresh)", source: "none" as const };
  }, [currentFile, savedMappings]);

  useEffect(() => {
    if (!currentFile) {
      setPresetInput("");
      return;
    }
    setPresetInput(presetInfo.name || "None (start fresh)");
  }, [currentFileIdx, presetInfo.name]);

  useEffect(() => {
    if (!currentFile || !currentFile.mappingTouched) return;
    if (currentFile.rememberMappingTouched) return;
    if ((currentFile.rememberMappingChoice ?? "off") !== "off") return;

    const choice = presetInfo.source === "user" ? "update" : "save";
    updateCurrentFile((file) => ({ ...file, rememberMappingChoice: choice }));
  }, [currentFile, presetInfo.source]);

  useEffect(() => {
    if (!currentFile) return;
    if (currentFile.userSelectedPresetId !== undefined) return;
    if (!currentFile.hasHeader) return;
    if (currentFile.mappingTouched) return;
    if (currentFile.autoMatchedMappingId) return;

    const picked = pickBestMapping(currentFile, savedMappings);
    if (!picked) return;

    updateCurrentFile((file) => ({
      ...file,
      mapping: picked.mapping,
      autoMatchedMappingId: picked.id,
      autoMatchedMappingName: picked.name,
      heuristicApplied: false,
    }));
    setMapping(picked.mapping);
  }, [currentFile, savedMappings, setMapping]);

  const handleFilesSelected = async (files: File[]) => {
    setParseError(null);
    setParseBusy(true);
    setFileErrors(new Map());

    try {
      const { parsedResults, errors } = await parseSelectedFiles(files);
      setFileErrors(errors);

      if (parsedResults.length === 0) {
        setParsedFiles([]);
        setParseError("No files could be parsed. Check errors above.");
        return;
      }

      const mappings = savedMappings.length > 0 ? savedMappings : await fetchSavedMappings();
      if (savedMappings.length === 0) {
        setSavedMappings(mappings);
      }

      setCurrentFileIdx(0);
      setImportComplete(false);
      setParsedFiles(parsedResults.map((file) => buildFileState(file, mappings, mainCurrency || "CAD")));
    } finally {
      setParseBusy(false);
    }
  };

  const { handlePresetSelection, handlePresetSubmit } = usePresetHandlers({
    currentFile,
    savedMappings,
    defaultCurrency: mainCurrency || "CAD",
    updateCurrentFile,
    setMapping,
  });

  const presetOptions = useMemo(
    () => [
      { value: NONE_PRESET_VALUE, label: "None (start fresh)" },
      ...savedMappings.map((m) => ({ value: String(m.id), label: m.name })),
    ],
    [savedMappings],
  );

  const handleRoleChange = (header: string, role: ColumnRole) => {
    if (!header) return;
    markMappingTouched();
    setMapping((prev) => applyRoleChange(prev, header, role));
  };

  const handleDescriptionRemove = (header: string) => {
    if (!header) return;
    markMappingTouched();
    setMapping((prev) => ({
      ...prev,
      csv: {
        ...prev.csv,
        description: prev.csv.description.filter((h) => h !== header),
      },
    }));
  };

  const handleReorderDescription = (fromIndex: number, toIndex: number) => {
    markMappingTouched();
    reorderDescription(fromIndex, toIndex);
  };

  const handleAccountChange = (value: string) => {
    markMappingTouched();
    setMapping((prev) => ({ ...prev, account: value, csv: { ...prev.csv, account: undefined } }));
  };

  const handleOwnerChange = (value: string) => {
    markMappingTouched();
    setMapping((prev) => ({ ...prev, owner: value }));
  };

  const handleCurrencySelect = (value: string) => {
    markMappingTouched();
    setMapping((prev) => ({ ...prev, currencyDefault: value }));
    const label = currencyOptions.find((option) => option.value === value)?.label || value;
    setCurrencyInput(label);
  };

  const handleInvertToggle = () => {
    markMappingTouched();
    setMapping((prev) => {
      const am = prev.csv.amountMapping;
      if (am.type !== "single") return prev;
      return {
        ...prev,
        csv: {
          ...prev.csv,
          amountMapping: { ...am, invertSign: !am.invertSign },
        },
      };
    });
  };

  const handleDirectionValueChange = (field: "negativeValue" | "positiveValue", value: string) => {
    markMappingTouched();
    setMapping((prev) => {
      const am = prev.csv.amountMapping;
      if (am.type !== "amountWithType") return prev;
      return {
        ...prev,
        csv: {
          ...prev.csv,
          amountMapping: { ...am, [field]: value },
        },
      };
    });
  };

  const { monthOptions, selectedMonths, selectedMonthKeys, toggleMonth, selectAllMonths, clearMonths } =
    useMonthSelection({ currentFile, mapping, updateCurrentFile });

  const visibleColumns = useMemo(() => {
    if (!currentFile) return [] as Array<{ header: string; index: number }>;
    const mapped = getMappedHeaders(mapping);
    const visibleIndexes = getVisibleColumnIndexes(currentFile.headers, currentFile.rows, mapped);
    return visibleIndexes.map((idx) => ({ header: currentFile.headers[idx], index: idx }));
  }, [currentFile, mapping]);

  const previewRows = useMemo(() => {
    if (!currentFile) return [] as string[][];
    const visibleIndexes = visibleColumns.map((col) => col.index);
    const unique = sampleUniqueRows(currentFile.rows, 5, (r) => r.join("\u0000"));
    return unique.map((r) => visibleIndexes.map((idx) => r[idx] ?? ""));
  }, [currentFile, visibleColumns]);

  const missingRequiredFields = useMemo(() => {
    const missing: string[] = [];
    if (isMissing("date")) missing.push("Date");
    if (isMissing("amount")) missing.push("Amount");
    if (isMissing("description")) missing.push("Description");
    if (isMissing("account")) missing.push("Account");
    return missing;
  }, [isMissing]);

  const isMonthMissing = selectedMonths.length === 0;
  const canImport = canProceed && !isMonthMissing;

  const handleRememberChoice = (choice: "off" | "save" | "update") => {
    updateCurrentFile((file) => ({
      ...file,
      rememberMappingChoice: choice,
      rememberMappingTouched: true,
      rememberMappingError: null,
    }));
  };

  const handleRememberNameChange = (value: string) => {
    updateCurrentFile((file) => ({
      ...file,
      rememberMappingName: value,
      rememberMappingError: null,
    }));
  };

  const buildMappingWithMeta = (name: string) => {
    if (!currentFile || !mapping) return null;
    const mappingWithMeta: ImportMapping = {
      ...mapping,
      meta: {
        ...(mapping.meta ?? {}),
        headers: uniqueSortedNormalizedHeaders(currentFile.headers),
        hasHeader: currentFile.hasHeader,
      },
    };
    return { name, mapping: mappingWithMeta };
  };

  const saveMappingIfNeeded = async () => {
    if (!currentFile || !mapping) return;
    const choice = currentFile.rememberMappingChoice ?? "off";
    if (choice === "off") return;

    const selectedName = presetInfo.id ? presetInfo.name : "";
    const name = choice === "update" ? selectedName : (currentFile.rememberMappingName || "").trim();
    if (!name) return;

    if (choice === "save") {
      const nameTaken = savedMappings.some((m) => m.name.toLowerCase() === name.toLowerCase());
      if (nameTaken) {
        updateCurrentFile((file) => ({
          ...file,
          rememberMappingError: "That name already exists. Try another one.",
        }));
        return;
      }
    }

    const payload = buildMappingWithMeta(name);
    if (!payload) return;

    try {
      await (window as any).go.main.App.SaveColumnMapping(payload.name, payload.mapping);
      const loaded = await fetchSavedMappings();
      setSavedMappings(loaded);
    } catch (e) {
      console.error("Failed to save mapping", e);
      const errorMsg = e instanceof Error ? e.message : "Failed to save mapping";
      toast.showToast(`Unable to save mapping: ${errorMsg}. Import will continue.`, "error");
    }
  };

  const handleImport = async () => {
    if (!currentFile || !mapping) return;
    if (!canImport || importBusy) return;

    setImportBusy(true);
    try {
      await saveMappingIfNeeded();

      const txs = normalizeTransactions(currentFile, mapping, selectedMonths);
      await (window as any).go.main.App.ImportTransactions(txs);
      await refresh();

      if (!isLastFile) {
        setCurrentFileIdx((prev) => prev + 1);
        return;
      }

      setImportComplete(true);
      if (onImportComplete) {
        onImportComplete();
      }
    } catch (e) {
      console.error(e);
      const errorMsg = e instanceof Error ? e.message : String(e);
      toast.showToast(
        `Unable to import transactions: ${errorMsg}. Please check your file format and try again.`,
        "error",
      );
    } finally {
      setImportBusy(false);
    }
  };

  const amountHint = amountHintForMapping(mapping);
  const directionMapped = mapping.csv.amountMapping.type === "amountWithType" && !!mapping.csv.amountMapping.typeColumn;
  const roleOptions = buildRoleOptions(directionMapped);

  const showAutoMatchBanner = currentFile?.autoMatchedMappingId && currentFile.userSelectedPresetId === undefined;
  const showPrefillBanner =
    currentFile?.heuristicApplied &&
    !currentFile.autoMatchedMappingId &&
    currentFile.userSelectedPresetId === undefined;

  const rememberChoice = currentFile?.rememberMappingChoice ?? "off";
  const rememberName = currentFile?.rememberMappingName ?? "";

  const resetImport = () => {
    setParsedFiles([]);
    setCurrentFileIdx(0);
    setImportComplete(false);
  };

  return {
    warning,
    parseBusy,
    parseError,
    fileErrors,
    parsedFiles,
    currentFile,
    currentFileIdx,
    isLastFile,
    importComplete,
    importBusy,
    mapping,
    presetInput,
    presetOptions,
    presetInfo,
    showAutoMatchBanner: !!showAutoMatchBanner,
    showPrefillBanner: !!showPrefillBanner,
    currencyOptions,
    currencyInput,
    availableAccounts,
    availableOwners,
    amountHint,
    roleOptions,
    visibleColumns,
    previewRows,
    monthOptions,
    selectedMonthKeys,
    rememberChoice,
    rememberName,
    rememberError: currentFile?.rememberMappingError || null,
    canUpdatePreset: !!presetInfo.id,
    canImport,
    missingRequiredFields,
    isMonthMissing,
    handleFilesSelected,
    handlePresetSelection,
    handlePresetSubmit,
    setPresetInput,
    handleRoleChange,
    handleAccountChange,
    handleOwnerChange,
    handleCurrencySelect,
    setCurrencyInput,
    handleDescriptionRemove,
    handleReorderDescription,
    handleInvertToggle,
    handleDirectionValueChange,
    toggleMonth,
    selectAllMonths,
    clearMonths,
    handleRememberChoice,
    handleRememberNameChange,
    handleImport,
    resetImport,
  };
};
