import { useState, useMemo } from 'react';
import { ImportMapping, CsvFieldKey, AmountMapping } from './ColumnMapperTypes';

export const defaultMapping = (): ImportMapping => ({
  csv: {
    date: '',
    description: [],
    amount: '',
    amountMapping: { type: 'single', column: '' },
  },
  account: '',
  currencyDefault: 'CAD',
});

export const useColumnMapping = (initialMapping?: ImportMapping) => {
  const [mapping, setMapping] = useState<ImportMapping>(initialMapping || defaultMapping());

  const usedHeaders = useMemo(() => {
    const used = new Set<string>();
    if (mapping.csv.date) used.add(mapping.csv.date);
    if (mapping.csv.amount) used.add(mapping.csv.amount);
    if (mapping.csv.owner) used.add(mapping.csv.owner);
    if (mapping.csv.account) used.add(mapping.csv.account);
    if (mapping.csv.currency) used.add(mapping.csv.currency);
    mapping.csv.description.forEach((h) => used.add(h));
    // Add columns from amountMapping
    const am = mapping.csv.amountMapping;
    if (am) {
      if (am.type === 'single' && am.column) used.add(am.column);
      if (am.type === 'debitCredit') {
        if (am.debitColumn) used.add(am.debitColumn);
        if (am.creditColumn) used.add(am.creditColumn);
      }
      if (am.type === 'amountWithType') {
        if (am.amountColumn) used.add(am.amountColumn);
        if (am.typeColumn) used.add(am.typeColumn);
      }
    }
    return used;
  }, [mapping]);

  const isAmountMappingValid = useMemo(() => {
    const am = mapping.csv.amountMapping;
    if (!am) return mapping.csv.amount.trim().length > 0; // legacy
    switch (am.type) {
      case 'single':
        return am.column.trim().length > 0;
      case 'debitCredit':
        return !!(am.debitColumn || am.creditColumn);
      case 'amountWithType':
        return !!(am.amountColumn && am.typeColumn);
    }
  }, [mapping.csv.amountMapping, mapping.csv.amount]);

  const isMissing = (key: 'date' | 'description' | 'amount' | 'account') => {
    if (key === 'account') return mapping.account.trim().length === 0 && (mapping.csv.account ?? '').trim().length === 0;
    if (key === 'description') return mapping.csv.description.length === 0;
    if (key === 'amount') return !isAmountMappingValid;
    return (mapping.csv[key] ?? '').trim().length === 0;
  };

  const canProceed = useMemo(() => {
    const dateOk = mapping.csv.date.trim().length > 0;
    const descriptionOk = mapping.csv.description.length > 0;
    const amountOk = isAmountMappingValid;
    const accountOk = mapping.account.trim().length > 0 || (mapping.csv.account ?? '').trim().length > 0;
    return dateOk && descriptionOk && amountOk && accountOk;
  }, [mapping.csv.date, mapping.csv.description, mapping.account, mapping.csv.account, isAmountMappingValid]);

  const removeHeaderEverywhere = (header: string) => {
    if (!header) return;

    setMapping((prev) => {
      const next: ImportMapping = {
        ...prev,
        csv: {
          ...prev.csv,
          description: prev.csv.description.filter((h) => h !== header),
        },
      };

      if (next.csv.date === header) next.csv.date = '';
      if (next.csv.amount === header) next.csv.amount = '';
      if (next.csv.owner === header) delete next.csv.owner;
      if (next.csv.account === header) delete next.csv.account;
      if (next.csv.currency === header) delete next.csv.currency;

      // Clear from amountMapping
      const am = next.csv.amountMapping;
      if (am) {
        switch (am.type) {
          case 'single':
            if (am.column === header) {
              next.csv.amountMapping = { type: 'single', column: '' };
              next.csv.amount = '';
            }
            break;
          case 'debitCredit':
            if (am.debitColumn === header) {
              next.csv.amountMapping = { ...am, debitColumn: undefined };
            }
            if (am.creditColumn === header) {
              next.csv.amountMapping = { ...am, creditColumn: undefined };
            }
            break;
          case 'amountWithType':
            if (am.amountColumn === header) {
              next.csv.amountMapping = { ...am, amountColumn: '' };
            }
            if (am.typeColumn === header) {
              next.csv.amountMapping = { ...am, typeColumn: '' };
            }
            break;
        }
      }

      return next;
    });
  };

  const assignHeaderToField = (field: CsvFieldKey, header: string) => {
    if (!header) return;

    setMapping((prev) => {
      const next: ImportMapping = JSON.parse(JSON.stringify(prev));

      // Ensure one-to-one mapping across fields (Description can be multi)
      const clearHeader = (h: string) => {
        if (next.csv.date === h) next.csv.date = '';
        if (next.csv.amount === h) next.csv.amount = '';
        if (next.csv.owner === h) delete next.csv.owner;
        if (next.csv.account === h) delete next.csv.account;
        if (next.csv.currency === h) delete next.csv.currency;
        next.csv.description = next.csv.description.filter((x: string) => x !== h);
        // Clear from amountMapping
        const am = next.csv.amountMapping;
        if (am) {
          switch (am.type) {
            case 'single':
              if (am.column === h) {
                next.csv.amountMapping = { type: 'single', column: '' };
                next.csv.amount = '';
              }
              break;
            case 'debitCredit':
              if (am.debitColumn === h) {
                next.csv.amountMapping = { ...am, debitColumn: undefined };
              }
              if (am.creditColumn === h) {
                next.csv.amountMapping = { ...am, creditColumn: undefined };
              }
              break;
            case 'amountWithType':
              if (am.amountColumn === h) {
                next.csv.amountMapping = { ...am, amountColumn: '' };
              }
              if (am.typeColumn === h) {
                next.csv.amountMapping = { ...am, typeColumn: '' };
              }
              break;
          }
        }
      };

      clearHeader(header);

      if (field === 'description') {
        next.csv.description = [...next.csv.description, header];
        return next;
      }

      if (field === 'date') {
        next.csv.date = header;
        return next;
      }

      if (field === 'amount') {
        // Update amountMapping to single column
        next.csv.amount = header;
        next.csv.amountMapping = { type: 'single', column: header };
        return next;
      }

      if (field === 'owner') {
        next.csv.owner = header;
        return next;
      }

      if (field === 'account') {
        next.csv.account = header;
        return next;
      }

      if (field === 'currency') {
        next.csv.currency = header;
        return next;
      }

      return next;
    });
  };

  const reorderDescription = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setMapping((prev) => {
      const newDescription = [...prev.csv.description];
      const [removed] = newDescription.splice(fromIndex, 1);
      newDescription.splice(toIndex, 0, removed);
      return {
        ...prev,
        csv: {
          ...prev.csv,
          description: newDescription,
        },
      };
    });
  };

  const handleAmountMappingTypeChange = (newType: AmountMapping['type']) => {
    setMapping((prev) => {
      const prevAm = prev.csv.amountMapping;
      let newAm: AmountMapping;
      // Preserve existing columns where applicable
      switch (newType) {
        case 'single':
          const column = prevAm?.type === 'single' ? prevAm.column : '';
          newAm = { type: 'single', column };
          break;
        case 'debitCredit':
          const debitColumn = prevAm?.type === 'debitCredit' ? prevAm.debitColumn : undefined;
          const creditColumn = prevAm?.type === 'debitCredit' ? prevAm.creditColumn : undefined;
          newAm = { type: 'debitCredit', debitColumn, creditColumn };
          break;
        case 'amountWithType':
          const amountColumn = prevAm?.type === 'amountWithType' ? prevAm.amountColumn : '';
          const typeColumn = prevAm?.type === 'amountWithType' ? prevAm.typeColumn : '';
          const negativeValue = prevAm?.type === 'amountWithType' ? prevAm.negativeValue ?? 'debit' : 'debit';
          const positiveValue = prevAm?.type === 'amountWithType' ? prevAm.positiveValue ?? 'credit' : 'credit';
          newAm = { type: 'amountWithType', amountColumn, typeColumn, negativeValue, positiveValue };
          break;
      }
      return {
        ...prev,
        csv: {
          ...prev.csv,
          amountMapping: newAm,
          // Keep legacy amount field in sync for single type
          amount: newAm.type === 'single' ? newAm.column : prev.csv.amount,
        },
      };
    });
  };

  const assignAmountMappingColumn = (field: 'column' | 'debitColumn' | 'creditColumn' | 'amountColumn' | 'typeColumn', header: string) => {
    if (!header) return;
    setMapping((prev) => {
      const prevAm = prev.csv.amountMapping ?? { type: 'single', column: '' };
      let newAm: AmountMapping;
      switch (prevAm.type) {
        case 'single':
          newAm = { ...prevAm, column: header };
          break;
        case 'debitCredit':
          newAm = { ...prevAm, [field]: header };
          break;
        case 'amountWithType':
          newAm = { ...prevAm, [field]: header };
          break;
        default:
          newAm = prevAm;
      }
      return {
        ...prev,
        csv: {
          ...prev.csv,
          amountMapping: newAm,
          amount: newAm.type === 'single' ? newAm.column : prev.csv.amount,
        },
      };
    });
  };

  const updateAmountWithTypeValues = (field: 'negativeValue' | 'positiveValue', value: string) => {
    setMapping((prev) => {
      const prevAm = prev.csv.amountMapping;
      if (!prevAm || prevAm.type !== 'amountWithType') return prev;
      const newAm = { ...prevAm, [field]: value };
      return {
        ...prev,
        csv: {
          ...prev.csv,
          amountMapping: newAm,
        },
      };
    });
  };

  return {
    mapping,
    setMapping,
    usedHeaders,
    isAmountMappingValid,
    isMissing,
    canProceed,
    removeHeaderEverywhere,
    assignHeaderToField,
    reorderDescription,
    handleAmountMappingTypeChange,
    assignAmountMappingColumn,
    updateAmountWithTypeValues,
  };
};
