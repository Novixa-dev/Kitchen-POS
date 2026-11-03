/**
 * Locale-aware formatting.
 *
 * Everything the user reads as a number — money, counts, dates, times —
 * goes through here, so switching locale or currency changes the whole app
 * rather than 60 call sites.
 *
 * `Intl` is part of the JS runtime, so this stays offline-safe.
 */

import { LOCALE_META, type Locale, type NumeralSystem } from './types';

export interface CurrencyFormat {
  /** ISO 4217 code, e.g. `SAR`, `AED`, `INR`, `USD`. */
  code: string;
  /** What to print. Falls back to `code` when empty. */
  symbol: string;
  /** Minor-unit digits. 2 for most currencies, 0 for e.g. JPY. */
  decimals: number;
  /** Where the symbol sits relative to the amount. */
  position: 'before' | 'after';
}

export const DEFAULT_CURRENCY: CurrencyFormat = {
  code: 'SAR',
  symbol: 'ر.س',
  decimals: 2,
  position: 'after',
};

export interface FormatContext {
  locale: Locale;
  numerals: NumeralSystem;
  currency: CurrencyFormat;
  /** IANA zone, or undefined for the system zone. */
  timeZone?: string;
}

/**
 * Build the BCP-47 tag used for `Intl`, including the numbering system.
 *
 * Arabic locales default to Arabic-Indic digits (٠١٢…). POS operators
 * generally read prices faster in Latin digits, so the numeral system is an
 * explicit choice rather than an accident of the locale.
 */
export function intlTag(locale: Locale, numerals: NumeralSystem): string {
  return `${LOCALE_META[locale].tag}-u-nu-${numerals}`;
}

// `Intl.*Format` construction is not free, and the POS re-renders large
// grids on every keystroke, so instances are memoised per option set.
const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();

function numberFormat(tag: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `n:${tag}:${JSON.stringify(options)}`;
  let cached = cache.get(key);
  if (!cached) {
    cached = new Intl.NumberFormat(tag, options);
    cache.set(key, cached);
  }
  return cached as Intl.NumberFormat;
}

function dateFormat(tag: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `d:${tag}:${JSON.stringify(options)}`;
  let cached = cache.get(key);
  if (!cached) {
    cached = new Intl.DateTimeFormat(tag, options);
    cache.set(key, cached);
  }
  return cached as Intl.DateTimeFormat;
}

/** Format a plain number. */
export function formatNumber(
  value: number,
  ctx: FormatContext,
  options: Intl.NumberFormatOptions = {},
): string {
  if (!Number.isFinite(value)) { return '—'; }
  return numberFormat(intlTag(ctx.locale, ctx.numerals), options).format(value);
}

/**
 * Format a money amount using the configured currency.
 *
 * The symbol is placed manually rather than via `style: 'currency'` because
 * outlets routinely want a custom symbol (`ر.س` vs `SAR` vs `﷼`) and a
 * specific side, which the CLDR default does not let them choose.
 */
export function formatCurrency(
  value: number,
  ctx: FormatContext,
  options: { showSymbol?: boolean } = {},
): string {
  const { showSymbol = true } = options;
  const amount = formatNumber(Number.isFinite(value) ? value : 0, ctx, {
    minimumFractionDigits: ctx.currency.decimals,
    maximumFractionDigits: ctx.currency.decimals,
  });

  if (!showSymbol) { return amount; }

  const symbol = ctx.currency.symbol || ctx.currency.code;
  // U+00A0 keeps the symbol from wrapping away from its amount.
  return ctx.currency.position === 'before'
    ? `${symbol}\u00A0${amount}`
    : `${amount}\u00A0${symbol}`;
}

/** Format a percentage from a whole-number rate (15 → "15%"). */
export function formatPercent(rate: number, ctx: FormatContext): string {
  return formatNumber(rate / 100, ctx, {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/** Coerce the various date shapes used across IPC into a `Date`. */
export function toDate(value: Date | string | number): Date | null {
  if (value instanceof Date) { return Number.isNaN(value.getTime()) ? null : value; }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export type DateStyle = 'short' | 'medium' | 'long' | 'weekday' | 'monthYear';

const DATE_OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  short: { year: 'numeric', month: '2-digit', day: '2-digit' },
  medium: { year: 'numeric', month: 'short', day: 'numeric' },
  long: { year: 'numeric', month: 'long', day: 'numeric' },
  weekday: { weekday: 'short', month: 'short', day: 'numeric' },
  monthYear: { year: 'numeric', month: 'long' },
};

export function formatDate(
  value: Date | string | number,
  ctx: FormatContext,
  style: DateStyle = 'medium',
): string {
  const date = toDate(value);
  if (!date) { return '—'; }
  return dateFormat(intlTag(ctx.locale, ctx.numerals), {
    ...DATE_OPTIONS[style],
    timeZone: ctx.timeZone,
  }).format(date);
}

export function formatTime(
  value: Date | string | number,
  ctx: FormatContext,
  options: { withSeconds?: boolean } = {},
): string {
  const date = toDate(value);
  if (!date) { return '—'; }
  return dateFormat(intlTag(ctx.locale, ctx.numerals), {
    hour: '2-digit',
    minute: '2-digit',
    ...(options.withSeconds ? { second: '2-digit' } : {}),
    timeZone: ctx.timeZone,
  }).format(date);
}

export function formatDateTime(
  value: Date | string | number,
  ctx: FormatContext,
  style: DateStyle = 'medium',
): string {
  const date = toDate(value);
  if (!date) { return '—'; }
  return `${formatDate(date, ctx, style)} · ${formatTime(date, ctx)}`;
}

/**
 * Human-readable elapsed time, e.g. "5 minutes ago" / "قبل ٥ دقائق".
 * Used by the KDS to show ticket age.
 */
export function formatRelativeTime(value: Date | string | number, ctx: FormatContext): string {
  const date = toDate(value);
  if (!date) { return '—'; }

  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['day', 86_400],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1],
  ];

  const rtf = new Intl.RelativeTimeFormat(intlTag(ctx.locale, ctx.numerals), {
    numeric: 'auto',
  });

  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size || unit === 'second') {
      return rtf.format(Math.round(seconds / size), unit);
    }
  }
  return rtf.format(0, 'second');
}

/** Elapsed minutes as `MM:SS`, for kitchen ticket timers. */
export function formatElapsed(since: Date | string | number, ctx: FormatContext): string {
  const date = toDate(since);
  if (!date) { return '—'; }
  const total = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  const pad = (n: number) => formatNumber(n, ctx, { minimumIntegerDigits: 2, useGrouping: false });
  return `${pad(mm)}:${pad(ss)}`;
}
