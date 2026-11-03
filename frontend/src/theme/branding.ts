/**
 * Branding contract and the CSS variables it paints.
 *
 * Mirrors `backend/src/lib/branding.ts`. The colour maths stays in the main
 * process — only the derived palette crosses the bridge — so this file
 * carries the shape of what arrives and the rules for applying it, not a
 * second copy of the contrast calculations.
 */

export type FontChoice = 'system' | 'naskh' | 'kufi';
export type Density = 'compact' | 'comfortable';

export interface SurfacePalette {
  accent: string;
  accentHover: string;
  accentSubtle: string;
  onAccent: string;
  /** Contrast of `onAccent` against `accent`. */
  contrast: number;
  /** Whether a label on the accent clears AA for normal text. */
  meetsAA: boolean;
  /** Contrast of the accent against the page behind it. */
  surfaceContrast: number;
  /** Whether the accent clears the 3:1 a UI component needs. */
  meetsUIContrast: boolean;
  /** True when the accent was adapted to stand clear of this page. */
  adapted: boolean;
}

export interface ThemedPalette {
  light: SurfacePalette;
  dark: SurfacePalette;
}

export interface ResolvedBranding {
  /** A preset id, or `custom` once a field has been changed by hand. */
  preset: string;
  accent: string;
  font: FontChoice;
  density: Density;
  palette: ThemedPalette;
  /** The font-family stack for the chosen typeface. */
  stack: string;
  /** Spacing multiplier for the chosen density. */
  scale: number;
}

export interface ThemePresetDTO {
  id: string;
  nameKey: string;
  accent: string;
  font: FontChoice;
  density: Density;
  palette: ThemedPalette;
}

export const CUSTOM_PRESET = 'custom';

/** Cached so the first paint is already branded, as with theme and locale. */
export const BRANDING_STORAGE_KEY = 'kpos.branding';

/**
 * The fallback look: the shipped default, with the palette the stylesheet
 * already declares. Used until the main process answers, and whenever the
 * cached value is unusable.
 */
export const FALLBACK_BRANDING: ResolvedBranding = {
  preset: 'classic-blue',
  accent: '#2563eb',
  font: 'system',
  density: 'comfortable',
  stack: '',
  scale: 1,
  palette: {
    light: {
      accent: '#2563eb',
      accentHover: '#1d4ed8',
      accentSubtle: '#eff6ff',
      onAccent: '#ffffff',
      contrast: 8.59,
      meetsAA: true,
      surfaceContrast: 4.58,
      meetsUIContrast: true,
      adapted: false,
    },
    dark: {
      accent: '#5b93f7',
      accentHover: '#7aa9f9',
      accentSubtle: '#16243c',
      onAccent: '#06142c',
      contrast: 8.1,
      meetsAA: true,
      surfaceContrast: 5.3,
      meetsUIContrast: true,
      adapted: true,
    },
  },
};

function isSurfacePalette(value: unknown): value is SurfacePalette {
  if (value === null || typeof value !== 'object') { return false; }
  const p = value as Record<string, unknown>;
  return (
    typeof p.accent === 'string' &&
    typeof p.accentHover === 'string' &&
    typeof p.accentSubtle === 'string' &&
    typeof p.onAccent === 'string'
  );
}

/**
 * Narrow what came over the bridge.
 *
 * The renderer paints CSS variables from this, and a missing field would
 * leave a `var()` referencing `undefined` — which does not fall back to the
 * stylesheet value, it drops the declaration and leaves buttons unstyled.
 */
export function isResolvedBranding(value: unknown): value is ResolvedBranding {
  if (value === null || typeof value !== 'object') { return false; }
  const b = value as Record<string, unknown>;
  if (typeof b.accent !== 'string' || typeof b.stack !== 'string') { return false; }
  if (typeof b.scale !== 'number' || !Number.isFinite(b.scale) || b.scale <= 0) { return false; }
  if (b.palette === null || typeof b.palette !== 'object') { return false; }

  const palette = b.palette as Record<string, unknown>;
  return isSurfacePalette(palette.light) && isSurfacePalette(palette.dark);
}

export function readCachedBranding(): ResolvedBranding {
  try {
    const raw = window.localStorage.getItem(BRANDING_STORAGE_KEY);
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw);
      if (isResolvedBranding(parsed)) { return parsed; }
    }
  } catch {
    // Locked-down profile, or a cache written by an older build.
  }
  return FALLBACK_BRANDING;
}

export function cacheBranding(branding: ResolvedBranding): void {
  try {
    window.localStorage.setItem(BRANDING_STORAGE_KEY, JSON.stringify(branding));
  } catch {
    // Non-fatal: the store remains the source of truth.
  }
}

/**
 * Paint the branding onto an element's inline style.
 *
 * Inline custom properties beat the stylesheet's `:root` rules, so this
 * overrides the four accent tokens without touching the rest of the theme —
 * surfaces, borders and text still come from `data-theme`.
 *
 * The palette is chosen by the *resolved* theme, not the preference: the dark
 * variant is a lifted version of the same brand colour, because the accent an
 * outlet picked against a white page can be invisible on a near-black one.
 */
export function applyBrandingVars(
  element: HTMLElement,
  branding: ResolvedBranding,
  theme: 'light' | 'dark',
): void {
  const palette = theme === 'dark' ? branding.palette.dark : branding.palette.light;
  const style = element.style;

  style.setProperty('--kp-brand', palette.accent);
  style.setProperty('--kp-brand-hover', palette.accentHover);
  style.setProperty('--kp-brand-subtle', palette.accentSubtle);
  style.setProperty('--kp-on-brand', palette.onAccent);

  // An empty stack means "whatever the stylesheet declares" — the fallback
  // branding carries no stack of its own, and writing '' would blank the font.
  if (branding.stack !== '') {
    style.setProperty('--font-sans', branding.stack);
  } else {
    style.removeProperty('--font-sans');
  }

  style.setProperty('--kp-density-scale', String(branding.scale));
}
