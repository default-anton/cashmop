import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { EventsOn } from '../../wailsjs/runtime/runtime';
import { GetCurrencySettings, GetFxRate, GetFxRateStatus, UpdateCurrencySettings } from '../../wailsjs/go/main/App';
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
  convertAmount: (amount: number, quoteCurrency: string, date: string) => Promise<number | null>;
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

const normalizeCurrency = (code: string) => code.trim().toUpperCase();

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const toast = useToast();
  const [settings, setSettings] = useState<CurrencySettings | null>(null);
  const [fxStatus, setFxStatus] = useState<FxRateStatus | null>(null);
  const currencyOptions = useMemo(() => buildCurrencyOptions(), []);
  const rateCache = useRef<Map<string, database.FxRateLookup | null>>(new Map());

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

  const { isStale, staleDays } = useMemo(() => {
    const parsed = parseDate(latestRateDate);
    if (!parsed) {
      return { isStale: false, staleDays: 0 };
    }
    const diffMs = Date.now() - parsed.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return { isStale: days > 7, staleDays: days };
  }, [latestRateDate]);

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
    if (isStale && latestRateDate) {
      return {
        tone: 'warning',
        title: 'Exchange rates are stale',
        detail: `Latest rate date is ${latestRateDate} (${staleDays} days ago).`,
      };
    }
    return null;
  }, [fxStatus, isBaseSupported, isStale, latestRateDate, mainCurrency, settings, staleDays]);

  const convertAmount = useCallback(async (amount: number, quoteCurrency: string, date: string) => {
    const base = normalizeCurrency(mainCurrency || 'CAD');
    const quote = normalizeCurrency(quoteCurrency || base);
    if (!date) return null;
    const key = `${base}|${quote}|${date}`;
    if (rateCache.current.has(key)) {
      const cached = rateCache.current.get(key);
      return cached ? amount * cached.rate : null;
    }
    try {
      const rate = await GetFxRate(base, quote, date);
      rateCache.current.set(key, rate ?? null);
      return rate ? amount * rate.rate : null;
    } catch (e) {
      console.error('Failed to fetch FX rate', e);
      rateCache.current.set(key, null);
      return null;
    }
  }, [mainCurrency, fxStatus]);

  useEffect(() => {
    rateCache.current.clear();
  }, [mainCurrency, fxStatus]);

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
    convertAmount,
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
    convertAmount,
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
