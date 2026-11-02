/**
 * Core i18n types.
 *
 * `en.ts` is the canonical dictionary: it defines the key set. Every other
 * locale is typed as `Dictionary`, so a missing or misspelled key is a
 * compile error rather than a string that silently renders as its own key.
 */

import type { en } from './locales/en';

/** Supported locales. Arabic is the product default. */
export const LOCALES = ['ar', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

export type Direction = 'rtl' | 'ltr';

/** Every translation key, derived from the canonical English dictionary. */
export type TranslationKey = keyof typeof en;

/** A complete dictionary for one locale. */
export type Dictionary = Record<TranslationKey, string>;

/** Values substituted into `{placeholder}` slots. */
export type TranslationValues = Record<string, string | number>;

/** Which digits to render numbers with. */
export type NumeralSystem = 'latn' | 'arab';

export interface LocaleMeta {
  /** BCP-47 tag used for `Intl.*` and the `lang` attribute. */
  tag: string;
  dir: Direction;
  /** Name of the language written in that language. */
  nativeName: string;
  englishName: string;
}

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  ar: { tag: 'ar', dir: 'rtl', nativeName: 'العربية', englishName: 'Arabic' },
  en: { tag: 'en', dir: 'ltr', nativeName: 'English', englishName: 'English' },
};

export const DEFAULT_LOCALE: Locale = 'ar';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function directionOf(locale: Locale): Direction {
  return LOCALE_META[locale].dir;
}
