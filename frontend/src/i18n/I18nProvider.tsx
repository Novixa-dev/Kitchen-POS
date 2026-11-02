import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/ipc';
import {
  DEFAULT_CURRENCY,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatElapsed,
  formatNumber,
  formatPercent,
  formatRelativeTime,
  formatTime,
  type CurrencyFormat,
  type FormatContext,
} from './format';
import { translate, translatePlural } from './translate';
import {
  I18nContext,
  LOCALE_STORAGE_KEY,
  NUMERALS_STORAGE_KEY,
  type I18nContextValue,
} from './context';
import {
  DEFAULT_LOCALE,
  LOCALE_META,
  directionOf,
  isLocale,
  type Direction,
  type Locale,
  type NumeralSystem,
} from './types';

function readStoredLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(stored)) { return stored; }
  } catch {
    // Private mode or a locked-down profile — fall through to the default.
  }
  return DEFAULT_LOCALE;
}

function readStoredNumerals(): NumeralSystem {
  try {
    const stored = window.localStorage.getItem(NUMERALS_STORAGE_KEY);
    if (stored === 'arab' || stored === 'latn') { return stored; }
  } catch {
    // ignore
  }
  // Latin digits by default: operators read prices faster in them, and they
  // match what most receipt printers and payment terminals show.
  return 'latn';
}

function persistLocal(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Non-fatal: electron-store remains the source of truth.
  }
}

/** Keep `<html>` in sync so CSS logical properties and fonts resolve correctly. */
function applyDocumentLocale(locale: Locale, dir: Direction): void {
  const root = document.documentElement;
  root.lang = LOCALE_META[locale].tag;
  root.dir = dir;
  root.dataset.locale = locale;
}

interface StoredSettings {
  locale?: unknown;
  numerals?: unknown;
  currency_code?: unknown;
  currency_symbol?: unknown;
  currency_decimals?: unknown;
  currency_position?: unknown;
}

function currencyFromSettings(settings: StoredSettings): CurrencyFormat {
  const decimals = Number(settings.currency_decimals);
  return {
    code: typeof settings.currency_code === 'string' && settings.currency_code
      ? settings.currency_code
      : DEFAULT_CURRENCY.code,
    symbol: typeof settings.currency_symbol === 'string' && settings.currency_symbol
      ? settings.currency_symbol
      : DEFAULT_CURRENCY.symbol,
    decimals: Number.isInteger(decimals) && decimals >= 0 && decimals <= 4
      ? decimals
      : DEFAULT_CURRENCY.decimals,
    position: settings.currency_position === 'before' ? 'before' : 'after',
  };
}

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale);
  const [numerals, setNumeralsState] = useState<NumeralSystem>(readStoredNumerals);
  const [currency, setCurrency] = useState<CurrencyFormat>(DEFAULT_CURRENCY);
  const [ready, setReady] = useState(false);

  const dir = directionOf(locale);

  // Apply the direction before paint so the first frame is already correct.
  useEffect(() => {
    applyDocumentLocale(locale, dir);
  }, [locale, dir]);

  // electron-store is authoritative; reconcile once on mount.
  useEffect(() => {
    let cancelled = false;
    void api.settings
      .get()
      .then((res) => {
        if (cancelled || !res.success || !res.data) { return; }
        const settings = res.data as StoredSettings;
        if (isLocale(settings.locale)) {
          setLocaleState(settings.locale);
          persistLocal(LOCALE_STORAGE_KEY, settings.locale);
        }
        if (settings.numerals === 'arab' || settings.numerals === 'latn') {
          setNumeralsState(settings.numerals);
          persistLocal(NUMERALS_STORAGE_KEY, settings.numerals);
        }
        setCurrency(currencyFromSettings(settings));
      })
      .catch(() => {
        // Keep the localStorage values; the app stays usable.
      })
      .finally(() => {
        if (!cancelled) { setReady(true); }
      });
    return () => { cancelled = true; };
  }, []);

  // Other parts of the app already broadcast `settings-updated` after saving.
  useEffect(() => {
    const reload = () => {
      void api.settings.get().then((res) => {
        if (!res.success || !res.data) { return; }
        const settings = res.data as StoredSettings;
        if (isLocale(settings.locale)) { setLocaleState(settings.locale); }
        if (settings.numerals === 'arab' || settings.numerals === 'latn') {
          setNumeralsState(settings.numerals);
        }
        setCurrency(currencyFromSettings(settings));
      }).catch(() => { /* non-fatal */ });
    };
    window.addEventListener('settings-updated', reload);
    return () => { window.removeEventListener('settings-updated', reload); };
  }, []);

  const setLocale = useCallback(async (next: Locale) => {
    setLocaleState(next);
    persistLocal(LOCALE_STORAGE_KEY, next);
    applyDocumentLocale(next, directionOf(next));
    try {
      await api.settings.save({ locale: next });
    } catch {
      // The UI already switched; the store will catch up on the next save.
    }
  }, []);

  const setNumerals = useCallback(async (next: NumeralSystem) => {
    setNumeralsState(next);
    persistLocal(NUMERALS_STORAGE_KEY, next);
    try {
      await api.settings.save({ numerals: next });
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo<I18nContextValue>(() => {
    const ctx: FormatContext = { locale, numerals, currency };
    return {
      locale,
      dir,
      numerals,
      currency,
      ready,
      setLocale,
      setNumerals,
      t: (key, values) => translate(locale, key, values),
      tPlural: (base, count, values) => translatePlural(locale, base, count, values),
      formatNumber: (v, options) => formatNumber(v, ctx, options),
      formatCurrency: (v, options) => formatCurrency(v, ctx, options),
      formatPercent: (r) => formatPercent(r, ctx),
      formatDate: (v, style) => formatDate(v, ctx, style),
      formatTime: (v, options) => formatTime(v, ctx, options),
      formatDateTime: (v, style) => formatDateTime(v, ctx, style),
      formatRelativeTime: (v) => formatRelativeTime(v, ctx),
      formatElapsed: (v) => formatElapsed(v, ctx),
    };
  }, [locale, dir, numerals, currency, ready, setLocale, setNumerals]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};
