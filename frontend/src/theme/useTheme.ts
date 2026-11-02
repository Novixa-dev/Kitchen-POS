import { useContext } from 'react';
import { ThemeContext, type ThemeContextValue } from './context';

/**
 * Access the active theme and the user's preference.
 *
 * Throws rather than defaulting: a component rendered outside the provider
 * would silently disagree with the rest of the UI.
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside <ThemeProvider>.');
  }
  return ctx;
}
