import { createContext } from 'react';

/**
 * Theme contract, kept out of the provider module.
 *
 * The user picks `light`, `dark` or `system`. CSS only ever sees the resolved
 * value on `<html data-theme>`, so stylesheets never have to duplicate rules
 * behind a media query.
 */

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

/** Mirrored in localStorage so the first paint is already the right theme. */
export const THEME_STORAGE_KEY = 'kpos.theme';

export interface ThemeContextValue {
  /** What the user chose. */
  preference: ThemePreference;
  /** What is actually applied right now. */
  theme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => Promise<void>;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function readStoredThemePreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemePreference(stored)) { return stored; }
  } catch {
    // Locked-down profile — fall through to the default.
  }
  return 'light';
}

export function prefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}
