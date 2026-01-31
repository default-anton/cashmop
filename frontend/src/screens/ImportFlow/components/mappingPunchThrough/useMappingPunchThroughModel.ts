import { useEffect, useMemo, useRef, useState } from "react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { sampleUniqueRows } from "../../utils";
import type { AmountMapping, ImportMapping } from "../ColumnMapperTypes";
import { useColumnMapping } from "../useColumnMapping";

import { STEPS } from "./steps";
import type { MappingPunchThroughProps, StepKey } from "./types";

export type AmountAssignTarget = "single" | "debitColumn" | "creditColumn" | "amountColumn" | "typeColumn";

export const useMappingPunchThroughModel = ({
  csvHeaders,
  rows,
  fileCount,
  fileIndex,
  hasHeader,
  detectedHasHeader,
  headerSource,
  onHeaderChange,
  onComplete,
  initialMapping,
  detectedMappingName,
  suggestedSaveName,
  onSaveMapping,
}: MappingPunchThroughProps) => {
  const { currencyOptions, mainCurrency } = useCurrency();
  const {
    mapping,
    setMapping,
    assignHeaderToField,
    removeHeaderEverywhere,
    canProceed,
    isMissing,
    isAmountMappingValid,
    handleAmountMappingTypeChange,
    assignAmountMappingColumn,
    updateAmountWithTypeValues,
  } = useColumnMapping(initialMapping || undefined, mainCurrency || "CAD");

  const [currencyInput, setCurrencyInput] = useState(mainCurrency || "CAD");

  const mappingRef = useRef(mapping);
  useEffect(() => {
    mappingRef.current = mapping;
  }, [mapping]);

  useEffect(() => {
    if (!mapping?.currencyDefault) return;
    const label =
      currencyOptions.find((option) => option.value === mapping.currencyDefault)?.label || mapping.currencyDefault;
    setCurrencyInput(label);
  }, [currencyOptions, mapping?.currencyDefault]);

  const getStartStepIdx = (m: ImportMapping) => {
    const idx = (key: StepKey) =>
      Math.max(
        0,
        STEPS.findIndex((s) => s.key === key),
      );

    if (!m.csv.date) return idx("date");

    const am = m.csv.amountMapping;
    const amountOk = (() => {
      if (am.type === "single") return am.column.trim().length > 0;
      if (am.type === "debitCredit") return !!(am.debitColumn || am.creditColumn);
      return !!(am.amountColumn && am.typeColumn);
    })();

    if (!amountOk) return idx("amount");
    if (m.csv.description.length === 0) return idx("description");

    const hasAccount = m.account.trim().length > 0 || (m.csv.account ?? "").trim().length > 0;
    if (!hasAccount) return idx("account");

    return idx("owner");
  };

  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [hoveredColIdx, setHoveredColIdx] = useState<number | null>(null);

  const [rememberMapping, setRememberMapping] = useState(false);
  const [mappingName, setMappingName] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!initialMapping) {
      setCurrentStepIdx(0);
      return;
    }
    setCurrentStepIdx(getStartStepIdx(initialMapping));
  }, [initialMapping]);

  useEffect(() => {
    // Reset per file.
    const detected = (detectedMappingName ?? "").trim();
    if (detected) {
      setRememberMapping(false);
      setMappingName(detected);
      setSaveError(null);
      return;
    }

    setRememberMapping(true);
    setMappingName((suggestedSaveName || "Import mapping").trim());
    setSaveError(null);
  }, [fileIndex, detectedMappingName, suggestedSaveName]);

  const currentStep = STEPS[Math.min(currentStepIdx, STEPS.length - 1)];

  const mappedHeaders = useMemo(() => {
    const set = new Set<string>();
    const { csv } = mapping;
    if (csv.date) set.add(csv.date);
    if (csv.account) set.add(csv.account);
    if (csv.currency) set.add(csv.currency);
    csv.description.forEach((h) => {
      set.add(h);
    });
    const am = csv.amountMapping;
    if (am) {
      if (am.type === "single" && am.column) set.add(am.column);
      if (am.type === "debitCredit") {
        if (am.debitColumn) set.add(am.debitColumn);
        if (am.creditColumn) set.add(am.creditColumn);
      }
      if (am.type === "amountWithType") {
        if (am.amountColumn) set.add(am.amountColumn);
        if (am.typeColumn) set.add(am.typeColumn);
      }
    }
    return set;
  }, [mapping]);

  const visibleColumnIndexes = useMemo(() => {
    if (csvHeaders.length === 0) return [];
    if (rows.length === 0) return csvHeaders.map((_, idx) => idx);

    const filtered = csvHeaders
      .map((header, idx) => ({ header, idx }))
      .filter(({ header, idx }) => {
        const hasValue = rows.some((row) => (row[idx] ?? "").trim().length > 0);
        const isMapped = header ? mappedHeaders.has(header) : false;
        return hasValue || isMapped;
      })
      .map(({ idx }) => idx);

    return filtered.length > 0 ? filtered : csvHeaders.map((_, idx) => idx);
  }, [csvHeaders, rows, mappedHeaders]);

  const visibleColumns = useMemo(
    () => visibleColumnIndexes.map((idx) => ({ header: csvHeaders[idx], index: idx })),
    [visibleColumnIndexes, csvHeaders],
  );

  const previewRows = useMemo(() => {
    const unique = sampleUniqueRows(rows, 5, (r) => r.join("\u0000"));
    return unique.map((r) => visibleColumnIndexes.map((idx) => r[idx] ?? ""));
  }, [rows, visibleColumnIndexes]);

  const [amountAssignTarget, setAmountAssignTarget] = useState<AmountAssignTarget>("single");

  useEffect(() => {
    if (currentStep.key !== "amount") return;

    const am = mapping.csv.amountMapping;
    if (am.type === "single") {
      setAmountAssignTarget("single");
      return;
    }

    if (am.type === "debitCredit") {
      if (!am.debitColumn) setAmountAssignTarget("debitColumn");
      else if (!am.creditColumn) setAmountAssignTarget("creditColumn");
      else setAmountAssignTarget("debitColumn");
      return;
    }

    if (am.type === "amountWithType") {
      if (!am.amountColumn) setAmountAssignTarget("amountColumn");
      else if (!am.typeColumn) setAmountAssignTarget("typeColumn");
      else setAmountAssignTarget("amountColumn");
    }
  }, [currentStep.key, mapping.csv.amountMapping]);

  const [availableAccounts, setAvailableAccounts] = useState<string[]>([]);
  const [availableOwners, setAvailableOwners] = useState<string[]>([]);

  const [accountInput, setAccountInput] = useState("");
  const [ownerInput, setOwnerInput] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const [dbAccounts, dbOwners]: [string[], string[]] = await Promise.all([
          (window as any).go.main.App.GetAccounts(),
          (window as any).go.main.App.GetOwners(),
        ]);
        setAvailableAccounts(dbAccounts || []);
        setAvailableOwners(dbOwners || []);
      } catch (e) {
        console.error("Failed to load accounts/owners", e);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (currentStep.key === "account") {
      setAccountInput(mapping.account || "");
    }
    if (currentStep.key === "owner") {
      setOwnerInput(mapping.owner || "");
    }
  }, [currentStep.key, mapping.account, mapping.owner]);

  const handleAdvance = async () => {
    if (currentStep.key === "account") {
      const name = accountInput.trim();
      if (name && !availableAccounts.includes(name)) {
        try {
          await (window as any).go.main.App.CreateAccount(name);
          setAvailableAccounts((prev) => [...prev, name].sort((a, b) => a.localeCompare(b)));
        } catch (e) {
          console.error("Failed to create account", e);
        }
      }
    }

    if (currentStep.key === "owner") {
      const name = ownerInput.trim();
      if (name && !availableOwners.includes(name)) {
        try {
          await (window as any).go.main.App.CreateOwner(name);
          setAvailableOwners((prev) => [...prev, name].sort((a, b) => a.localeCompare(b)));
        } catch (e) {
          console.error("Failed to create owner", e);
        }
      }
    }

    if (currentStepIdx >= STEPS.length - 1) {
      if (rememberMapping && onSaveMapping) {
        const name = mappingName.trim();
        if (!name) {
          setSaveError("Please provide a mapping name.");
          return;
        }

        setSaveBusy(true);
        setSaveError(null);
        try {
          await onSaveMapping(name, mappingRef.current, { headers: csvHeaders, hasHeader });
        } catch (e) {
          console.error("Failed to save mapping", e);
          setSaveError(e instanceof Error ? e.message : "Failed to save mapping");
          setSaveBusy(false);
          return;
        }
        setSaveBusy(false);
      }

      onComplete(mappingRef.current);
      return;
    }
    setCurrentStepIdx((prev) => prev + 1);
  };

  const handleBack = () => {
    if (currentStepIdx > 0) setCurrentStepIdx((prev) => prev - 1);
  };

  const getColumnStatus = (header: string): "current" | "other" | "none" => {
    if (!header) return "none";

    const { csv } = mapping;

    const isMappedTo = (step: StepKey): boolean => {
      if (step === "date") return csv.date === header;
      if (step === "description") return csv.description.includes(header);
      if (step === "account") return csv.account === header;
      if (step === "currency") return csv.currency === header;
      if (step === "amount") {
        const am = csv.amountMapping;
        if (am.type === "single") return am.column === header;
        if (am.type === "debitCredit") return am.debitColumn === header || am.creditColumn === header;
        if (am.type === "amountWithType") return am.amountColumn === header || am.typeColumn === header;
      }
      return false;
    };

    const isTarget = (): boolean => {
      if (currentStep.key === "amount") {
        const am = csv.amountMapping;
        if (am.type === "single") return am.column === header;
        if (am.type === "debitCredit") {
          return amountAssignTarget === "debitColumn" ? am.debitColumn === header : am.creditColumn === header;
        }
        if (am.type === "amountWithType") {
          return amountAssignTarget === "amountColumn" ? am.amountColumn === header : am.typeColumn === header;
        }
      }
      return isMappedTo(currentStep.key);
    };

    if (isTarget()) return "current";
    if (STEPS.some((s) => isMappedTo(s.key))) return "other";

    return "none";
  };

  const getHeaderLabel = (header: string) => {
    if (mapping.csv.date === header) return "Date";

    const am = mapping.csv.amountMapping;
    if (am?.type === "single" && am.column === header) return "Amount";
    if (am?.type === "debitCredit") {
      if (am.debitColumn === header) return "Debit";
      if (am.creditColumn === header) return "Credit";
    }
    if (am?.type === "amountWithType") {
      if (am.amountColumn === header) return "Amount";
      if (am.typeColumn === header) return "Type";
    }

    if (mapping.csv.description.includes(header)) return "Desc";
    if (mapping.csv.account === header) return "Account";
    if (mapping.csv.currency === header) return "Currency";

    return null;
  };

  const handleHeaderClick = (header: string) => {
    if (!header) return;

    const status = getColumnStatus(header);
    if (status === "other") return;

    if (status === "current") {
      removeHeaderEverywhere(header);
      return;
    }

    if (currentStep.key === "date") {
      assignHeaderToField("date", header);
      return;
    }

    if (currentStep.key === "amount") {
      const am: AmountMapping = mapping.csv.amountMapping;

      if (am.type === "single") {
        assignHeaderToField("amount", header);
        return;
      }

      if (am.type === "debitCredit") {
        const target = amountAssignTarget === "creditColumn" ? "creditColumn" : "debitColumn";
        assignAmountMappingColumn(target, header);
        return;
      }

      if (am.type === "amountWithType") {
        const target = amountAssignTarget === "typeColumn" ? "typeColumn" : "amountColumn";
        assignAmountMappingColumn(target, header);
        return;
      }

      return;
    }

    if (currentStep.key === "description") {
      assignHeaderToField("description", header);
      return;
    }

    if (currentStep.key === "account") {
      assignHeaderToField("account", header);
      return;
    }

    if (currentStep.key === "currency") {
      assignHeaderToField("currency", header);
    }
  };

  const toggleInvertSign = () => {
    setMapping((prev) => {
      const prevAm: AmountMapping = prev.csv.amountMapping;
      const nextAm: AmountMapping = { ...prevAm, invertSign: !prevAm.invertSign };
      return {
        ...prev,
        csv: {
          ...prev.csv,
          amountMapping: nextAm,
        },
      };
    });
  };

  const canGoNext = useMemo(() => {
    if (currentStep.key === "date") return !isMissing("date");
    if (currentStep.key === "amount") return isAmountMappingValid;
    if (currentStep.key === "description") return !isMissing("description");
    if (currentStep.key === "account") return !isMissing("account");
    if (currentStep.key === "owner" || currentStep.key === "currency") {
      if (currentStepIdx === STEPS.length - 1 && rememberMapping && onSaveMapping) {
        return canProceed && mappingName.trim().length > 0;
      }
      return canProceed;
    }
    return true;
  }, [
    currentStep.key,
    currentStepIdx,
    isAmountMappingValid,
    isMissing,
    canProceed,
    rememberMapping,
    mappingName,
    onSaveMapping,
  ]);

  const amountMappingType = mapping.csv.amountMapping.type;
  const invertSignEnabled = mapping.csv.amountMapping.invertSign ?? false;

  return {
    csvHeaders,
    rows,
    fileCount,
    fileIndex,
    hasHeader,
    detectedHasHeader,
    headerSource,
    onHeaderChange,
    detectedMappingName,

    mapping,
    setMapping,

    currencyOptions,
    currencyInput,
    setCurrencyInput,

    currentStepIdx,
    setCurrentStepIdx,
    currentStep,

    hoveredColIdx,
    setHoveredColIdx,

    visibleColumns,
    previewRows,

    mappedHeaders,

    amountAssignTarget,
    setAmountAssignTarget,

    availableAccounts,
    availableOwners,
    accountInput,
    setAccountInput,
    ownerInput,
    setOwnerInput,

    rememberMapping,
    setRememberMapping,
    mappingName,
    setMappingName,
    saveBusy,
    saveError,

    canProceed,
    canGoNext,

    amountMappingType,
    invertSignEnabled,

    removeHeaderEverywhere,
    handleAmountMappingTypeChange,
    assignAmountMappingColumn,
    updateAmountWithTypeValues,
    toggleInvertSign,

    getColumnStatus,
    getHeaderLabel,
    handleHeaderClick,

    handleBack,
    handleAdvance,
  };
};

export type MappingPunchThroughModel = ReturnType<typeof useMappingPunchThroughModel>;
