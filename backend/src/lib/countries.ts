/**
 * Country profiles: the starting point for currency and tax.
 *
 * Setting up a till should not begin with "what are your currency's decimal
 * places" and "is your tax inclusive". Picking a country answers both, plus
 * the tax regime, the usual rate and where the currency symbol sits.
 *
 * **These are defaults to confirm, not authority.** Tax rates change, vary by
 * item and sometimes by region, and a restaurant may be registered
 * differently from the headline rate — Indian GST on restaurant service is
 * not the rate on packaged goods, and US sales tax is set per state and city
 * rather than nationally. So the wizard shows what it filled in and asks the
 * outlet to check it, and every value stays editable afterwards in Settings.
 * The alternative — asking for nine fields cold — is how a till ends up
 * printing 0% tax for a year.
 *
 * Pure and dependency-free.
 */

import type { TaxMode } from '../services/tax';

export type Locale = 'ar' | 'en';
export type SymbolPosition = 'before' | 'after';

export interface CountryProfile {
  /** ISO 3166-1 alpha-2. */
  code: string;
  /** Translation key, so the picker is bilingual. */
  nameKey: string;
  currency: {
    /** ISO 4217. */
    code: string;
    symbol: string;
    /**
     * Minor units, per ISO 4217. Three for the Gulf dinars, which divide
     * into 1000 fils; zero where there is no minor unit in practice.
     */
    decimals: number;
    position: SymbolPosition;
  };
  tax: {
    mode: TaxMode;
    /** The usual headline rate on restaurant service, as a percentage. */
    rate: number;
    /** Whether menu prices normally include the tax. */
    inclusive: boolean;
  };
  /** The language a new install in this country most likely wants. */
  defaultLocale: Locale;
}

/**
 * The shipped list.
 *
 * Deliberately curated rather than all 249 ISO entries: a picker of 249 is
 * worse to use than one of 25, and a profile is only worth having if its tax
 * and currency defaults are right. "Somewhere else" covers the rest and
 * leaves the fields blank for the outlet to fill in.
 */
export const COUNTRIES: readonly CountryProfile[] = [
  // ── Gulf ──────────────────────────────────────────────────────────────
  { code: 'SA', nameKey: 'country.SA', currency: { code: 'SAR', symbol: 'ر.س', decimals: 2, position: 'after' }, tax: { mode: 'vat', rate: 15, inclusive: true }, defaultLocale: 'ar' },
  { code: 'AE', nameKey: 'country.AE', currency: { code: 'AED', symbol: 'د.إ', decimals: 2, position: 'after' }, tax: { mode: 'vat', rate: 5, inclusive: true }, defaultLocale: 'ar' },
  { code: 'KW', nameKey: 'country.KW', currency: { code: 'KWD', symbol: 'د.ك', decimals: 3, position: 'after' }, tax: { mode: 'none', rate: 0, inclusive: true }, defaultLocale: 'ar' },
  { code: 'QA', nameKey: 'country.QA', currency: { code: 'QAR', symbol: 'ر.ق', decimals: 2, position: 'after' }, tax: { mode: 'none', rate: 0, inclusive: true }, defaultLocale: 'ar' },
  { code: 'BH', nameKey: 'country.BH', currency: { code: 'BHD', symbol: 'د.ب', decimals: 3, position: 'after' }, tax: { mode: 'vat', rate: 10, inclusive: true }, defaultLocale: 'ar' },
  { code: 'OM', nameKey: 'country.OM', currency: { code: 'OMR', symbol: 'ر.ع', decimals: 3, position: 'after' }, tax: { mode: 'vat', rate: 5, inclusive: true }, defaultLocale: 'ar' },

  // ── Wider Arab world ──────────────────────────────────────────────────
  { code: 'EG', nameKey: 'country.EG', currency: { code: 'EGP', symbol: 'ج.م', decimals: 2, position: 'after' }, tax: { mode: 'vat', rate: 14, inclusive: true }, defaultLocale: 'ar' },
  { code: 'JO', nameKey: 'country.JO', currency: { code: 'JOD', symbol: 'د.أ', decimals: 3, position: 'after' }, tax: { mode: 'vat', rate: 16, inclusive: true }, defaultLocale: 'ar' },
  { code: 'IQ', nameKey: 'country.IQ', currency: { code: 'IQD', symbol: 'د.ع', decimals: 0, position: 'after' }, tax: { mode: 'none', rate: 0, inclusive: true }, defaultLocale: 'ar' },
  { code: 'LB', nameKey: 'country.LB', currency: { code: 'LBP', symbol: 'ل.ل', decimals: 0, position: 'after' }, tax: { mode: 'vat', rate: 11, inclusive: true }, defaultLocale: 'ar' },
  { code: 'SY', nameKey: 'country.SY', currency: { code: 'SYP', symbol: 'ل.س', decimals: 0, position: 'after' }, tax: { mode: 'none', rate: 0, inclusive: true }, defaultLocale: 'ar' },
  { code: 'YE', nameKey: 'country.YE', currency: { code: 'YER', symbol: 'ر.ي', decimals: 0, position: 'after' }, tax: { mode: 'none', rate: 0, inclusive: true }, defaultLocale: 'ar' },
  { code: 'SD', nameKey: 'country.SD', currency: { code: 'SDG', symbol: 'ج.س', decimals: 2, position: 'after' }, tax: { mode: 'vat', rate: 17, inclusive: true }, defaultLocale: 'ar' },
  { code: 'LY', nameKey: 'country.LY', currency: { code: 'LYD', symbol: 'د.ل', decimals: 3, position: 'after' }, tax: { mode: 'none', rate: 0, inclusive: true }, defaultLocale: 'ar' },
  { code: 'MA', nameKey: 'country.MA', currency: { code: 'MAD', symbol: 'د.م', decimals: 2, position: 'after' }, tax: { mode: 'vat', rate: 20, inclusive: true }, defaultLocale: 'ar' },
  { code: 'TN', nameKey: 'country.TN', currency: { code: 'TND', symbol: 'د.ت', decimals: 3, position: 'after' }, tax: { mode: 'vat', rate: 19, inclusive: true }, defaultLocale: 'ar' },
  { code: 'DZ', nameKey: 'country.DZ', currency: { code: 'DZD', symbol: 'د.ج', decimals: 2, position: 'after' }, tax: { mode: 'vat', rate: 19, inclusive: true }, defaultLocale: 'ar' },

  // ── Elsewhere ─────────────────────────────────────────────────────────
  { code: 'TR', nameKey: 'country.TR', currency: { code: 'TRY', symbol: '₺', decimals: 2, position: 'before' }, tax: { mode: 'vat', rate: 10, inclusive: true }, defaultLocale: 'en' },
  { code: 'PK', nameKey: 'country.PK', currency: { code: 'PKR', symbol: 'Rs', decimals: 0, position: 'before' }, tax: { mode: 'vat', rate: 16, inclusive: true }, defaultLocale: 'en' },
  // GST, kept because the app began as an Indian build and existing installs
  // migrate onto this profile.
  { code: 'IN', nameKey: 'country.IN', currency: { code: 'INR', symbol: '₹', decimals: 2, position: 'before' }, tax: { mode: 'gst', rate: 5, inclusive: true }, defaultLocale: 'en' },
  { code: 'GB', nameKey: 'country.GB', currency: { code: 'GBP', symbol: '£', decimals: 2, position: 'before' }, tax: { mode: 'vat', rate: 20, inclusive: true }, defaultLocale: 'en' },
  { code: 'DE', nameKey: 'country.DE', currency: { code: 'EUR', symbol: '€', decimals: 2, position: 'after' }, tax: { mode: 'vat', rate: 19, inclusive: true }, defaultLocale: 'en' },
  { code: 'FR', nameKey: 'country.FR', currency: { code: 'EUR', symbol: '€', decimals: 2, position: 'after' }, tax: { mode: 'vat', rate: 10, inclusive: true }, defaultLocale: 'en' },
  // No national sales tax: it is set per state and city, so a national
  // default would be wrong everywhere. Left at none for the outlet to set.
  { code: 'US', nameKey: 'country.US', currency: { code: 'USD', symbol: '$', decimals: 2, position: 'before' }, tax: { mode: 'none', rate: 0, inclusive: false }, defaultLocale: 'en' },
  { code: 'CA', nameKey: 'country.CA', currency: { code: 'CAD', symbol: '$', decimals: 2, position: 'before' }, tax: { mode: 'vat', rate: 5, inclusive: false }, defaultLocale: 'en' },
];

/** The id for "my country is not listed", which fills nothing in. */
export const OTHER_COUNTRY = 'ZZ';

export function getCountry(code: string): CountryProfile | undefined {
  return COUNTRIES.find(c => c.code === code.toUpperCase());
}

export function isCountryCode(value: unknown): value is string {
  return typeof value === 'string' && getCountry(value) !== undefined;
}

export interface CountryDefaults {
  currency: CountryProfile['currency'];
  tax: CountryProfile['tax'];
  locale: Locale;
}

/**
 * The settings a country implies.
 *
 * Returns null for an unknown code — including `ZZ` — so the caller leaves
 * the fields as they are rather than filling them with a guess.
 */
export function defaultsFor(code: string): CountryDefaults | null {
  const country = getCountry(code);
  if (!country) { return null; }

  return {
    currency: { ...country.currency },
    tax: { ...country.tax },
    locale: country.defaultLocale,
  };
}

/**
 * Catalogue integrity, asserted by the test suite.
 *
 * The decimal count is the one worth checking hardest: it reaches the
 * rounding rule, so a wrong value there is wrong money on every bill, not a
 * cosmetic slip.
 */
export function validateCountries(): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();

  for (const country of COUNTRIES) {
    if (seen.has(country.code)) { problems.push(`duplicate country ${country.code}`); }
    seen.add(country.code);

    if (!/^[A-Z]{2}$/.test(country.code)) {
      problems.push(`${country.code} is not an ISO 3166-1 alpha-2 code`);
    }
    if (country.code === OTHER_COUNTRY) {
      problems.push(`${country.code} collides with the "not listed" option`);
    }
    if (!/^[A-Z]{3}$/.test(country.currency.code)) {
      problems.push(`${country.code} currency ${country.currency.code} is not ISO 4217`);
    }
    if (![0, 2, 3].includes(country.currency.decimals)) {
      problems.push(`${country.code} has ${country.currency.decimals} decimals`);
    }
    if (country.currency.symbol.trim() === '') {
      problems.push(`${country.code} has no currency symbol`);
    }
    if (country.tax.rate < 0 || country.tax.rate > 100) {
      problems.push(`${country.code} tax rate ${country.tax.rate} is out of range`);
    }
    // A regime with nothing to charge, or a rate with no regime to charge it
    // under, would print a tax line that does not add up.
    if (country.tax.mode === 'none' && country.tax.rate !== 0) {
      problems.push(`${country.code} charges no tax but carries a rate`);
    }
    if (country.tax.mode !== 'none' && country.tax.rate === 0) {
      problems.push(`${country.code} has a tax regime but a zero rate`);
    }
    if (country.nameKey !== `country.${country.code}`) {
      problems.push(`${country.code} name key is ${country.nameKey}`);
    }
  }

  return problems;
}
