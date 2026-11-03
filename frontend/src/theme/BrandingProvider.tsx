import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/ipc';
import { useTheme } from './useTheme';
import { BrandingContext, type BrandingContextValue } from './brandingContext';
import {
  applyBrandingVars,
  cacheBranding,
  isResolvedBranding,
  readCachedBranding,
  type Density,
  type FontChoice,
  type ResolvedBranding,
  type ThemePresetDTO,
} from './branding';

/** How long a colour picker must settle before the main process is asked. */
const PREVIEW_DEBOUNCE_MS = 60;

/**
 * Applies the outlet's accent, typeface and density.
 *
 * Sits inside `ThemeProvider` because the palette to paint depends on the
 * resolved theme: the dark variant is a lifted version of the same brand
 * colour, since an accent chosen against a white page can be invisible on a
 * near-black one.
 *
 * The saved branding is cached in `localStorage` for a correct first paint,
 * exactly as the theme and locale are, and `electron-store` stays the source
 * of truth.
 */
export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { theme } = useTheme();

  const [branding, setBrandingState] = useState<ResolvedBranding>(readCachedBranding);
  const [presets, setPresets] = useState<readonly ThemePresetDTO[]>([]);
  const [loading, setLoading] = useState(true);

  // An unsaved colour the user is still dragging, and the palette the main
  // process derived for it. Kept apart from the saved branding so abandoning
  // the drag needs no undo.
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [previewed, setPreviewed] = useState<ResolvedBranding | null>(null);

  const timer = useRef<number | null>(null);

  // What is actually on screen: the preview while one is in flight.
  const applied = previewed ?? branding;

  useEffect(() => {
    applyBrandingVars(document.documentElement, applied, theme);
  }, [applied, theme]);

  const adopt = useCallback((next: unknown) => {
    if (!isResolvedBranding(next)) { return; }
    setBrandingState(next);
    cacheBranding(next);
    // A save supersedes any preview that produced it.
    setPreviewing(null);
    setPreviewed(null);
  }, []);

  // Load the catalogue and the saved branding once. The fetch is kept out of
  // the state updates: everything is applied inside `.then`, so no effect
  // writes state during render.
  useEffect(() => {
    let cancelled = false;

    void api.branding.list().then((res) => {
      if (cancelled) { return; }
      if (res.success && res.data) {
        setPresets(res.data.presets);
        if (isResolvedBranding(res.data.current)) {
          setBrandingState(res.data.current);
          cacheBranding(res.data.current);
        }
      }
      setLoading(false);
    }).catch(() => {
      // Keep the cached look; the stylesheet's defaults are a valid fallback.
      if (!cancelled) { setLoading(false); }
    });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => () => {
    if (timer.current !== null) { window.clearTimeout(timer.current); }
  }, []);

  const applyPreset = useCallback(async (id: string) => {
    const res = await api.branding.applyPreset(id);
    if (res.success) { adopt(res.data); }
  }, [adopt]);

  const setBranding = useCallback(async (patch: {
    accent?: string;
    font?: FontChoice;
    density?: Density;
  }) => {
    const res = await api.branding.set(patch);
    if (res.success) { adopt(res.data); }
  }, [adopt]);

  /**
   * Ask what a colour would look like, debounced.
   *
   * A colour input fires on every frame of a drag; without this each frame
   * would cross the bridge. Sixty milliseconds is below the threshold where
   * the swatch feels detached from the cursor.
   */
  const preview = useCallback((accent: string | null) => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }

    if (accent === null) {
      setPreviewing(null);
      setPreviewed(null);
      return;
    }

    setPreviewing(accent);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      void api.branding.preview({ accent }).then((res) => {
        if (res.success && isResolvedBranding(res.data)) {
          setPreviewed(res.data);
        }
      }).catch(() => {
        // The swatch keeps showing the raw colour; nothing was stored.
      });
    }, PREVIEW_DEBOUNCE_MS);
  }, []);

  const value = useMemo<BrandingContextValue>(
    () => ({ branding: applied, presets, loading, applyPreset, setBranding, preview, previewing }),
    [applied, presets, loading, applyPreset, setBranding, preview, previewing],
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
};
