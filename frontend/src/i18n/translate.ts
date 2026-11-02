/**
 * Pure translation lookup — no React, so it is cheap to unit test and can be
 * reused by non-component code (e.g. building a receipt payload).
 */

import { ar } from './locales/ar';
import { en } from './locales/en';
import {
  DEFAULT_LOCALE,
  LOCALE_META,
  type Dictionary,
  type Locale,
  type TranslationKey,
  type TranslationValues,
} from './types';

/**
 * Lookups are typed as possibly-undefined even though `Dictionary` is total:
 * a key can arrive from untyped runtime data (a persisted setting, a `never`
 * cast in a test), and a missing entry must not blank the UI.
 */
type LooseDictionary = Partial<Record<TranslationKey, string>>;

export const dictionaries: Record<Locale, Dictionary> = { ar, en };

const loose: Record<Locale, LooseDictionary> = dictionaries;

const PLACEHOLDER = /\{(\w+)\}/g;

/** Substitute `{name}` placeholders. Unknown placeholders are left intact. */
export function interpolate(template: string, values?: TranslationValues): string {
  if (!values) { return template; }
  return template.replace(PLACEHOLDER, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match,
  );
}

/**
 * Resolve a key for a locale.
 *
 * Falls back to the default locale, then to the key itself. A missing key is
 * normally impossible (the dictionary type enforces completeness), but the
 * fallback keeps a bad runtime value from blanking the UI.
 */
export function translate(
  locale: Locale,
  key: TranslationKey,
  values?: TranslationValues,
): string {
  const template = loose[locale][key] ?? loose[DEFAULT_LOCALE][key] ?? key;
  return interpolate(template, values);
}

const pluralRulesCache = new Map<string, Intl.PluralRules>();

function pluralRules(locale: Locale): Intl.PluralRules {
  const tag = LOCALE_META[locale].tag;
  let rules = pluralRulesCache.get(tag);
  if (!rules) {
    rules = new Intl.PluralRules(tag);
    pluralRulesCache.set(tag, rules);
  }
  return rules;
}

/**
 * Resolve a plural set.
 *
 * Arabic has six plural categories (zero/one/two/few/many/other) against
 * English's two, so the category comes from `Intl.PluralRules` rather than a
 * hand-rolled `count === 1` check. `.other` is the required fallback.
 *
 * `count` is injected as `{count}` on top of any explicit values.
 */
export function translatePlural(
  locale: Locale,
  base: string,
  count: number,
  values?: TranslationValues,
): string {
  const category = pluralRules(locale).select(count);
  const dict = loose[locale];
  const fallback = loose[DEFAULT_LOCALE];

  const template =
    dict[`${base}.${category}` as TranslationKey] ??
    dict[`${base}.other` as TranslationKey] ??
    fallback[`${base}.other` as TranslationKey] ??
    base;

  return interpolate(template, { count, ...values });
}

/** True when a key exists in the given locale — useful in tests and tooling. */
export function hasKey(locale: Locale, key: string): key is TranslationKey {
  return Object.prototype.hasOwnProperty.call(dictionaries[locale], key);
}
