import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { EventsOn } from '../../wailsjs/runtime/runtime';
import { GetCurrencySettings, GetFxRateStatus, UpdateCurrencySettings } from '../../wailsjs/go/main/App';
import { database } from '../../wailsjs/go/models';
import { useToast } from './ToastContext';

type CurrencySettings = database.CurrencySettings;
type FxRateStatus = database.FxRateStatus;

type FxWarningTone = 'warning' | 'error';

type FxWarning = {
  tone: FxWarningTone;
  title: string;
  detail: string;
};

type CurrencyContextValue = {
  settings: CurrencySettings | null;
  fxStatus: FxRateStatus | null;
  mainCurrency: string;
  currencyOptions: Array<{ value: string; label: string }>;
  isBaseSupported: boolean;
  latestRateDate: string;
  isStale: boolean;
  staleDays: number;
  warning: FxWarning | null;
  refresh: () => Promise<void>;
  updateSettings: (next: CurrencySettings) => Promise<CurrencySettings>;
};

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);

const supportedBaseCurrencies = new Set(['CAD']);

const getCurrencyCodes = () => {
  const supportedValuesOf = (Intl as { supportedValuesOf?: (type: string) => string[] }).supportedValuesOf;
  if (typeof supportedValuesOf === 'function') {
    return supportedValuesOf('currency').slice().sort();
  }
  return ['CAD'];
};

const buildCurrencyOptions = () => {
  const displayNames = typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames(['en'], { type: 'currency' })
    : null;
  return getCurrencyCodes().map((code: string) => ({
    value: code,
    label: displayNames?.of(code) ? `${code} — ${displayNames.of(code)}` : code,
  }));
};

const parseDate = (date: string) => {
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const toast = useToast();
  const [settings, setSettings] = useState<CurrencySettings | null>(null);
  const [fxStatus, setFxStatus] = useState<FxRateStatus | null>(null);
  const currencyOptions = useMemo(() => buildCurrencyOptions(), []);

  const refresh = useCallback(async () => {
    try {
      const nextSettings = await GetCurrencySettings();
      setSettings(nextSettings);
    } catch (e) {
      console.error('Failed to load currency settings', e);
      setSettings(null);
    }
    try {
      const status = await GetFxRateStatus();
      setFxStatus(status);
    } catch (e) {
      console.error('Failed to load FX status', e);
      setFxStatus(null);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const off = EventsOn('fx-rates-updated', () => {
      toast.showToast('Exchange rates updated', 'success');
      refresh();
    });
    return () => off?.();
  }, [refresh, toast]);

  const updateSettings = useCallback(async (next: CurrencySettings) => {
    const updated = await UpdateCurrencySettings(next);
    setSettings(updated);
    try {
      const status = await GetFxRateStatus();
      setFxStatus(status);
    } catch (e) {
      console.error('Failed to refresh FX status', e);
      setFxStatus(null);
    }
    return updated;
  }, []);

  const mainCurrency = settings?.main_currency || 'CAD';
  const isBaseSupported = supportedBaseCurrencies.has(mainCurrency.toUpperCase());

  const latestRateDate = useMemo(() => {
    if (!fxStatus?.pairs || fxStatus.pairs.length === 0) return '';
    return fxStatus.pairs
      .map((pair) => pair.latest_rate_date)
      .filter(Boolean)
      .sort()
      .slice(-1)[0] || '';
  }, [fxStatus]);

  const maxTxDate = useMemo(() => {
    return fxStatus?.max_tx_date || '';
  }, [fxStatus]);

  const { isStale, staleDays, shouldWarn } = useMemo(() => {
    const parsed = parseDate(latestRateDate);
    const maxTxParsed = parseDate(maxTxDate);

    if (!parsed) {
      return { isStale: false, staleDays: 0, shouldWarn: false };
    }
    const diffMs = Date.now() - parsed.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // Context-aware warning: only warn if we have foreign currency transactions
    // and they are recent (within 30 days)
    let shouldWarn = false;
    if (maxTxParsed) {
      const txAgeDays = Math.floor((Date.now() - maxTxParsed.getTime()) / (1000 * 60 * 60 * 24));
      shouldWarn = days > 7 && txAgeDays <= 30;
    }

    return { isStale: shouldWarn, staleDays: days, shouldWarn };
  }, [latestRateDate, maxTxDate]);

  const warning = useMemo<FxWarning | null>(() => {
    if (!settings) return null;
    if (!isBaseSupported) {
      return {
        tone: 'error',
        title: `Exchange rates unavailable for ${mainCurrency}`,
        detail: 'Select a supported main currency to enable conversions.',
      };
    }
    if (fxStatus?.pairs?.length === 0 && fxStatus?.last_sync) {
      return {
        tone: 'error',
        title: 'Exchange rates missing',
        detail: 'No cached rates were found for your transactions. Sync again or choose a supported currency.',
      };
    }
    if (shouldWarn && latestRateDate) {
      return {
        tone: 'warning',
        title: 'Exchange rates are stale',
        detail: `Latest rate date is ${latestRateDate} (${staleDays} days ago).`,
      };
    }
    return null;
  }, [fxStatus, isBaseSupported, shouldWarn, latestRateDate, mainCurrency, settings, staleDays]);

  const value = useMemo<CurrencyContextValue>(() => ({
    settings,
    fxStatus,
    mainCurrency,
    currencyOptions,
    isBaseSupported,
    latestRateDate,
    isStale,
    staleDays,
    warning,
    refresh,
    updateSettings,
  }), [
    settings,
    fxStatus,
    mainCurrency,
    currencyOptions,
    isBaseSupported,
    latestRateDate,
    isStale,
    staleDays,
    warning,
    refresh,
    updateSettings,
  ]);

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};
