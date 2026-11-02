import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/ipc';
import {
  isThemePreference,
  prefersDark,
  readStoredThemePreference,
  THEME_STORAGE_KEY,
  ThemeContext,
  type ResolvedTheme,
  type ThemeContextValue,
  type ThemePreference,
} from './context';

/**
 * Applies the user's theme choice to `<html data-theme>`.
 *
 * As with the locale, the choice is mirrored in `localStorage` for a correct
 * first paint and persisted to `electron-store` as the source of truth.
 */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredThemePreference);

  // Only the OS signal is state. The applied theme is derived from it and the
  // preference, so there is no effect writing state back on every change.
  const [systemIsDark, setSystemIsDark] = useState(prefersDark);

  const systemTheme: ResolvedTheme = systemIsDark ? 'dark' : 'light';
  const theme: ResolvedTheme = preference === 'system' ? systemTheme : preference;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Track the OS setting unconditionally — cheap, and it keeps the listener
  // out of the preference's dependency list.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => { setSystemIsDark(e.matches); };
    mq.addEventListener('change', onChange);
    return () => { mq.removeEventListener('change', onChange); };
  }, []);

  // Reconcile with the persisted settings once on mount.
  useEffect(() => {
    let cancelled = false;
    void api.settings.get().then((res) => {
      if (cancelled || !res.success || !res.data) { return; }
      const stored = (res.data as { theme?: unknown }).theme;
      if (isThemePreference(stored)) { setPreferenceState(stored); }
    }).catch(() => { /* keep the localStorage value */ });
    return () => { cancelled = true; };
  }, []);

  const setPreference = useCallback(async (next: ThemePreference) => {
    setPreferenceState(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // non-fatal: electron-store remains the source of truth
    }
    try {
      await api.settings.save({ theme: next });
    } catch {
      // The UI already switched; the store catches up on the next save.
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, theme, setPreference }),
    [preference, theme, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
