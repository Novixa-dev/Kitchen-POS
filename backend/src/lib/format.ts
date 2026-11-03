/**
 * Locale-aware formatting for the main process.
 *
 * Mirrors `frontend/src/i18n/format.ts` so a receipt reads the same as the
 * screen it was printed from. `Intl` ships with the runtime, so this stays
 * offline-safe.
 */

import type { CurrencySettings, Locale, NumeralSystem } from './settings';

export interface FormatOptions {
  locale: Locale;
  numerals: NumeralSystem;
  currency: CurrencySettings;
}

export function intlTag(locale: Locale, numerals: NumeralSystem): string {
  return `${locale}-u-nu-${numerals}`;
}

export function formatNumber(
  value: number,
  opts: FormatOptions,
  options: Intl.NumberFormatOptions = {},
): string {
  if (!Number.isFinite(value)) { return '-'; }
  return new Intl.NumberFormat(intlTag(opts.locale, opts.numerals), options).format(value);
}

/**
 * Format money for printing.
 *
 * The symbol is placed manually rather than via `style: 'currency'` so the
 * receipt matches whatever symbol the outlet configured.
 */
export function formatCurrency(
  value: number,
  opts: FormatOptions,
  options: { showSymbol?: boolean } = {},
): string {
  const { showSymbol = true } = options;
  const amount = formatNumber(Number.isFinite(value) ? value : 0, opts, {
    minimumFractionDigits: opts.currency.decimals,
    maximumFractionDigits: opts.currency.decimals,
  });
  if (!showSymbol) { return amount; }

  const symbol = opts.currency.symbol || opts.currency.code;
  return opts.currency.position === 'before' ? `${symbol} ${amount}` : `${amount} ${symbol}`;
}

export function formatDateTime(value: Date | string | number, opts: FormatOptions): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) { return '-'; }
  return new Intl.DateTimeFormat(intlTag(opts.locale, opts.numerals), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatPercent(rate: number, opts: FormatOptions): string {
  return formatNumber(rate / 100, opts, {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
