import { useContext } from 'react';
import { I18nContext, type I18nContextValue } from './context';

/**
 * Access the active locale, translator and formatters.
 *
 * Throws rather than falling back silently: a component rendering outside the
 * provider would otherwise show untranslated keys in production.
 */
export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used inside <I18nProvider>.');
  }
  return ctx;
}

/** Shorthand for components that only need the translator. */
export function useT(): I18nContextValue['t'] {
  return useI18n().t;
}
