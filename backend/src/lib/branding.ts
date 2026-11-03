/**
 * Branding: the accent colour, typeface, density and named presets.
 *
 * An outlet should be able to make the app look like theirs without a
 * designer, so this ships a small catalogue of presets that are complete
 * looks rather than colour swatches — picking one sets the accent, the
 * typeface and the density together. Changing anything afterwards turns the
 * selection into `custom` while keeping the values, which is the
 * "duplicate and edit" path: start from a preset, then adjust.
 *
 * Pure and dependency-free. The accent maths lives in `colour.ts`; this file
 * is the catalogue and the validation around it.
 */

import { deriveThemedPalette, parseHex, type ThemedPalette } from './colour';

/**
 * Typeface choice.
 *
 * The app is offline and fetches no webfont, so a choice here selects a
 * *stack* of families the operating system may already ship, not a font the
 * app can guarantee. Every stack ends in the system stack, so an absent
 * family degrades to something that renders Arabic and Latin correctly
 * rather than to a browser default that renders Arabic badly.
 */
export type FontChoice = 'system' | 'naskh' | 'kufi';

export type Density = 'compact' | 'comfortable';

/** The system stack every other stack falls back to. */
const SYSTEM_FALLBACK =
  '"Segoe UI", "SF Arabic", "Noto Sans Arabic", Tahoma, "Helvetica Neue", Arial, system-ui, sans-serif';

export const FONT_STACKS: Record<FontChoice, string> = {
  /** What the app has always used: whatever the OS ships for Arabic + Latin. */
  system: SYSTEM_FALLBACK,
  /**
   * Traditional naskh, for an outlet that wants a more formal receipt.
   * Windows ships Traditional Arabic; macOS Al Bayan; Linux Noto Naskh.
   */
  naskh: `"Traditional Arabic", "Noto Naskh Arabic", "Al Bayan", "Times New Roman", ${SYSTEM_FALLBACK}`,
  /** Geometric kufi, which reads as more modern on signage and menus. */
  kufi: `"Noto Kufi Arabic", "Segoe UI Variable Display", "SF Arabic Rounded", ${SYSTEM_FALLBACK}`,
};

/**
 * Spacing multiplier.
 *
 * Compact is not a cosmetic preference: on a 1366×768 till screen it is the
 * difference between nine menu items visible and six, and an order taker
 * scrolling during a queue is the thing to avoid.
 */
export const DENSITY_SCALE: Record<Density, number> = {
  compact: 0.875,
  comfortable: 1,
};

export interface BrandingSettings {
  /** A preset id, or `custom` once any field has been changed by hand. */
  preset: string;
  /** The chosen accent, as 6-digit hex. */
  accent: string;
  font: FontChoice;
  density: Density;
}

export interface ThemePreset {
  id: string;
  /** Translation key, so the catalogue stays bilingual. */
  nameKey: string;
  accent: string;
  font: FontChoice;
  density: Density;
}

export const CUSTOM_PRESET = 'custom';

/**
 * The bundled presets.
 *
 * Each accent clears 3:1 against the light page, so none of them lands an
 * outlet in a warned state on first pick — a preset that immediately shows a
 * contrast warning would read as a bug in the preset, not as advice.
 */
export const THEME_PRESETS: readonly ThemePreset[] = [
  {
    id: 'classic-blue',
    nameKey: 'preset.classicBlue',
    accent: '#2563eb',
    font: 'system',
    density: 'comfortable',
  },
  {
    id: 'emerald',
    nameKey: 'preset.emerald',
    accent: '#047857',
    font: 'system',
    density: 'comfortable',
  },
  {
    id: 'saffron',
    nameKey: 'preset.saffron',
    accent: '#b45309',
    font: 'kufi',
    density: 'comfortable',
  },
  {
    id: 'grill',
    nameKey: 'preset.grill',
    accent: '#b91c1c',
    font: 'system',
    density: 'comfortable',
  },
  {
    id: 'midnight',
    nameKey: 'preset.midnight',
    accent: '#4f46e5',
    font: 'kufi',
    density: 'compact',
  },
  {
    id: 'espresso',
    nameKey: 'preset.espresso',
    accent: '#78350f',
    font: 'naskh',
    density: 'comfortable',
  },
];

export const DEFAULT_BRANDING: BrandingSettings = {
  preset: 'classic-blue',
  accent: '#2563eb',
  font: 'system',
  density: 'comfortable',
};

export function getPreset(id: string): ThemePreset | undefined {
  return THEME_PRESETS.find(p => p.id === id);
}

export function isFontChoice(value: unknown): value is FontChoice {
  return value === 'system' || value === 'naskh' || value === 'kufi';
}

export function isDensity(value: unknown): value is Density {
  return value === 'compact' || value === 'comfortable';
}

/** The stack for a choice, falling back to the system stack. */
export function fontStack(choice: unknown): string {
  return isFontChoice(choice) ? FONT_STACKS[choice] : FONT_STACKS.system;
}

/**
 * Validate a stored branding record.
 *
 * The store is schemaless, so any field can be missing, the wrong type, or
 * written by a build that knew a preset this one does not. A bad accent is
 * the one that matters: an unparseable colour reaching the CSS variables
 * leaves every button unstyled, so it falls back to the default rather than
 * being passed through.
 */
export function sanitiseBranding(raw: unknown): BrandingSettings {
  const d = DEFAULT_BRANDING;
  if (raw === null || typeof raw !== 'object') { return { ...d }; }

  const value = raw as Partial<Record<keyof BrandingSettings, unknown>>;

  const accentRgb = typeof value.accent === 'string' ? parseHex(value.accent) : null;
  const accent = accentRgb
    ? // Normalise: `#abc` is stored as `#aabbcc` so comparisons are textual.
      `#${[accentRgb.r, accentRgb.g, accentRgb.b]
        .map(c => c.toString(16).padStart(2, '0'))
        .join('')}`
    : d.accent;

  const preset = typeof value.preset === 'string' && value.preset !== ''
    ? value.preset
    : d.preset;

  return {
    // An unknown preset id becomes `custom` rather than the default preset:
    // the accent and font stored alongside it are still the admin's choices,
    // and resetting the name is better than overwriting the look.
    preset: preset === CUSTOM_PRESET || getPreset(preset) ? preset : CUSTOM_PRESET,
    accent,
    font: isFontChoice(value.font) ? value.font : d.font,
    density: isDensity(value.density) ? value.density : d.density,
  };
}

/** Apply a preset wholesale. Unknown ids leave the branding untouched. */
export function applyPreset(current: BrandingSettings, id: string): BrandingSettings {
  const preset = getPreset(id);
  if (!preset) { return current; }
  return {
    preset: preset.id,
    accent: preset.accent,
    font: preset.font,
    density: preset.density,
  };
}

/**
 * Change one field by hand.
 *
 * The selection becomes `custom` as soon as the result stops matching the
 * preset it came from — so the admin can start from Saffron, darken the
 * accent, and the UI stops claiming they are still on Saffron. Setting a
 * field back to the preset's own value restores the name.
 */
export function editBranding(
  current: BrandingSettings,
  patch: Partial<Omit<BrandingSettings, 'preset'>>,
): BrandingSettings {
  const next = sanitiseBranding({ ...current, ...patch, preset: CUSTOM_PRESET });

  const match = THEME_PRESETS.find(
    p => p.accent === next.accent && p.font === next.font && p.density === next.density,
  );

  return { ...next, preset: match ? match.id : CUSTOM_PRESET };
}

export interface ResolvedBranding extends BrandingSettings {
  palette: ThemedPalette;
  stack: string;
  scale: number;
}

/**
 * Everything the UI needs to paint the chosen branding.
 *
 * The accent is sanitised first, so this cannot fail — a corrupted store
 * produces the default look rather than a null palette the caller has to
 * handle at every call site.
 */
export function resolveBranding(raw: unknown): ResolvedBranding {
  const branding = sanitiseBranding(raw);
  // Non-null: `sanitiseBranding` guarantees a parseable accent.
  const palette = deriveThemedPalette(branding.accent) as ThemedPalette;

  return {
    ...branding,
    palette,
    stack: FONT_STACKS[branding.font],
    scale: DENSITY_SCALE[branding.density],
  };
}
