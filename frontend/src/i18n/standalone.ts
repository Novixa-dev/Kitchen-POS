import { translate } from './translate';
import { DEFAULT_LOCALE, isLocale, type Locale, type TranslationKey, type TranslationValues } from './types';

/**
 * Translation without React context.
 *
 * Error boundaries are the one place that cannot use `useI18n()`: the root
 * boundary wraps the provider, so if the provider itself is what threw, the
 * hook would throw again inside the fallback and leave the user with a blank
 * screen instead of an error message.
 *
 * The locale is read from `<html lang>`, which `I18nProvider` keeps current
 * and `index.html` seeds before React mounts.
 */
export function currentLocale(): Locale {
  try {
    const lang = document.documentElement.lang;
    return isLocale(lang) ? lang : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

/** `t()` for code that runs outside the provider. */
export function tStandalone(key: TranslationKey, values?: TranslationValues): string {
  return translate(currentLocale(), key, values);
}
