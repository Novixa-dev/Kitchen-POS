import { createContext } from 'react';
import type { CurrencyFormat, DateStyle } from './format';
import type {
  Direction,
  Locale,
  NumeralSystem,
  TranslationKey,
  TranslationValues,
} from './types';

/**
 * Locale is mirrored in `localStorage` as well as `electron-store`.
 *
 * The store is authoritative, but it is read over async IPC. Without a
 * synchronous hint the first paint would use the default locale and then
 * visibly flip — including the page direction. `localStorage` gives us the
 * last known locale before the first render.
 */
export const LOCALE_STORAGE_KEY = 'kpos.locale';
export const NUMERALS_STORAGE_KEY = 'kpos.numerals';

export interface I18nContextValue {
  locale: Locale;
  dir: Direction;
  numerals: NumeralSystem;
  currency: CurrencyFormat;
  /** False until persisted settings have been read. */
  ready: boolean;

  setLocale: (locale: Locale) => Promise<void>;
  setNumerals: (numerals: NumeralSystem) => Promise<void>;

  /** Translate a key, with optional `{placeholder}` values. */
  t: (key: TranslationKey, values?: TranslationValues) => string;
  /** Translate a CLDR plural set by its base key. */
  tPlural: (base: string, count: number, values?: TranslationValues) => string;

  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatCurrency: (value: number, options?: { showSymbol?: boolean }) => string;
  formatPercent: (rate: number) => string;
  formatDate: (value: Date | string | number, style?: DateStyle) => string;
  formatTime: (value: Date | string | number, options?: { withSeconds?: boolean }) => string;
  formatDateTime: (value: Date | string | number, style?: DateStyle) => string;
  formatRelativeTime: (value: Date | string | number) => string;
  formatElapsed: (since: Date | string | number) => string;
}

export const I18nContext = createContext<I18nContextValue | null>(null);

