/**
 * Colour maths for the branding settings.
 *
 * An outlet picks its own accent colour, and the app has to keep text legible
 * on top of it. Letting someone choose a pale yellow accent and then painting
 * white text on it produces a button nobody can read — so the accent is
 * validated against WCAG contrast, and the foreground is chosen rather than
 * assumed.
 *
 * Pure and dependency-free, so the rules are unit-testable.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** WCAG AA for normal-size text. */
export const AA_NORMAL = 4.5;
/** WCAG AA for large text, which is what a button label usually is. */
export const AA_LARGE = 3;

/**
 * The floor on contrast that `foregroundFor` guarantees.
 *
 * Because it returns whichever of white or near-black reads better, rather
 * than defaulting to white, no accent can drop below this. Measured by
 * sweeping the colour space: the worst case is `#118888` at 4.28:1. That is
 * why the palette reports `meetsAA` but no large-text flag — a large-text
 * check against 3:1 could never fail, and a flag that cannot fail implies a
 * risk that is not there.
 */
export const GUARANTEED_MIN_CONTRAST = 4.28;

const HEX_SHORT = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const HEX_LONG = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

/** Parse `#abc` or `#aabbcc`. Returns null for anything else. */
export function parseHex(value: string): Rgb | null {
  const text = value.trim();

  const short = HEX_SHORT.exec(text);
  if (short) {
    // Each digit is doubled: #abc means #aabbcc.
    return {
      r: Number.parseInt(short[1] + short[1], 16),
      g: Number.parseInt(short[2] + short[2], 16),
      b: Number.parseInt(short[3] + short[3], 16),
    };
  }

  const long = HEX_LONG.exec(text);
  if (long) {
    return {
      r: Number.parseInt(long[1], 16),
      g: Number.parseInt(long[2], 16),
      b: Number.parseInt(long[3], 16),
    };
  }

  return null;
}

export function toHex({ r, g, b }: Rgb): string {
  const part = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

/**
 * Relative luminance, per WCAG 2.1.
 *
 * The 0.03928 threshold and the 2.4 exponent are the specification's, not an
 * approximation — contrast ratios computed any other way do not match what an
 * accessibility audit will report.
 */
export function luminance({ r, g, b }: Rgb): number {
  const channel = (value: number): number => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Contrast ratio between two colours, from 1 (identical) to 21 (black on white). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const NEAR_BLACK: Rgb = { r: 6, g: 20, b: 44 };

/**
 * Pick the foreground that reads best on `background`.
 *
 * Returns whichever of white or near-black has the higher contrast, rather
 * than defaulting to white — which is what makes a pale accent unreadable.
 */
export function foregroundFor(background: Rgb): { hex: string; ratio: number } {
  const onWhite = contrastRatio(background, WHITE);
  const onBlack = contrastRatio(background, NEAR_BLACK);

  return onWhite >= onBlack
    ? { hex: toHex(WHITE), ratio: onWhite }
    : { hex: toHex(NEAR_BLACK), ratio: onBlack };
}

/**
 * Blend `from` towards `to` by `weight` (0 = `from`, 1 = `to`).
 *
 * Used for the accent's hover and subtle variants. Blending towards the
 * *surface* rather than always towards white is what makes those variants
 * work in dark mode: a subtle chip background has to sit just above the page,
 * and on a dark page that means mixing with near-black, not with white.
 */
export function mix(from: Rgb, to: Rgb, weight: number): Rgb {
  const t = Math.max(0, Math.min(1, weight));
  return {
    r: from.r + (to.r - from.r) * t,
    g: from.g + (to.g - from.g) * t,
    b: from.b + (to.b - from.b) * t,
  };
}

/**
 * Shift a colour towards black (`amount` < 0) or white (`amount` > 0).
 *
 * `amount` is a fraction between -1 and 1. Used to derive the hover and
 * subtle variants of an accent from the accent itself, so an outlet only has
 * to choose one colour.
 */
export function shade(colour: Rgb, amount: number): Rgb {
  const t = Math.max(-1, Math.min(1, amount));
  const target = t >= 0 ? 255 : 0;
  const weight = Math.abs(t);
  return {
    r: colour.r + (target - colour.r) * weight,
    g: colour.g + (target - colour.g) * weight,
    b: colour.b + (target - colour.b) * weight,
  };
}

export interface AccentPalette {
  /** The accent itself, normalised to 6-digit hex. */
  accent: string;
  /** Darker, for hover. */
  accentHover: string;
  /** Very light, for a selected row or a chip background. */
  accentSubtle: string;
  /** Text and icons placed on the accent. */
  onAccent: string;
  /** Contrast of `onAccent` against `accent`. */
  contrast: number;
  /**
   * Whether that contrast clears AA for normal text (4.5:1).
   *
   * Large text is not reported separately: picking the better foreground puts
   * the floor at `GUARANTEED_MIN_CONTRAST`, which always clears the 3:1 large
   * -text threshold, so such a flag could never be false.
   */
  meetsAA: boolean;
}

/**
 * Derive a full accent palette from one colour.
 *
 * Returns null if the input is not a colour at all; a *low-contrast* colour is
 * still returned, with `meetsAA` false, so the UI can warn rather than refuse.
 * Refusing would be worse: an outlet's brand colour is theirs, and the honest
 * response is to say the text may be hard to read, not to reject it.
 */
export function derivePalette(hex: string): AccentPalette | null {
  const accent = parseHex(hex);
  if (!accent) { return null; }

  const foreground = foregroundFor(accent);

  return {
    accent: toHex(accent),
    accentHover: toHex(shade(accent, -0.18)),
    accentSubtle: toHex(shade(accent, 0.88)),
    onAccent: foreground.hex,
    contrast: Math.round(foreground.ratio * 100) / 100,
    meetsAA: foreground.ratio >= AA_NORMAL,
  };
}

// ── adapting one accent to both themes ──────────────────────────────────────

/**
 * WCAG 1.4.11: a UI component's own boundary needs 3:1 against what is
 * behind it. This is the threshold the *accent against the page* must clear,
 * which is a different question from the label against the accent.
 */
export const UI_MIN_CONTRAST = 3;

/** The page surfaces the two themes paint, matching `index.css`. */
export const LIGHT_SURFACE: Rgb = { r: 255, g: 255, b: 255 };
export const DARK_SURFACE: Rgb = { r: 15, g: 23, b: 42 };

/**
 * Move `colour` away from `surface` until it stands clear of it.
 *
 * An outlet picks its accent while looking at the light preview, so a deep
 * navy is a reasonable choice there — and nearly invisible on the dark
 * theme's near-black page. Rather than refuse the colour or let the dark
 * theme break, the accent is adapted for that surface, which is exactly what
 * the built-in theme already does by hand (#2563eb becomes #5b93f7).
 *
 * Returns the colour unchanged when it already clears `target`.
 */
export function liftForSurface(
  colour: Rgb,
  surface: Rgb,
  target: number = UI_MIN_CONTRAST,
): Rgb {
  if (contrastRatio(colour, surface) >= target) { return colour; }

  // Away from the surface: lighten on a dark page, darken on a light one.
  const away: Rgb = luminance(surface) < 0.5
    ? { r: 255, g: 255, b: 255 }
    : { r: 0, g: 0, b: 0 };

  // Step in small increments and stop at the first that clears the target, so
  // the result stays as close to the chosen colour as the threshold allows.
  for (let step = 1; step <= 20; step += 1) {
    const candidate = mix(colour, away, step / 20);
    if (contrastRatio(candidate, surface) >= target) { return candidate; }
  }

  // Unreachable in practice: full white or black always clears 3:1 against
  // either surface. Returning the extreme is still the best available answer.
  return away;
}

export interface SurfacePalette extends AccentPalette {
  /** Contrast of `accent` against the page it sits on. */
  surfaceContrast: number;
  /** Whether that clears the 3:1 a UI component needs (WCAG 1.4.11). */
  meetsUIContrast: boolean;
  /** True when the accent had to be adapted to stand clear of the page. */
  adapted: boolean;
}

/**
 * Derive the accent variants for one specific page surface.
 *
 * Hover moves *away* from the surface so it reads as more prominent on both
 * themes, and subtle moves towards it so a chip or selected row sits just
 * above the page rather than glowing white on a dark one.
 */
export function derivePaletteForSurface(
  hex: string,
  surface: Rgb,
  options: { lift?: boolean } = {},
): SurfacePalette | null {
  const chosen = parseHex(hex);
  if (!chosen) { return null; }

  const accent = options.lift === true ? liftForSurface(chosen, surface) : chosen;
  const away: Rgb = luminance(surface) < 0.5
    ? { r: 255, g: 255, b: 255 }
    : { r: 0, g: 0, b: 0 };

  const foreground = foregroundFor(accent);
  const againstSurface = contrastRatio(accent, surface);

  return {
    accent: toHex(accent),
    accentHover: toHex(mix(accent, away, 0.18)),
    accentSubtle: toHex(mix(accent, surface, 0.88)),
    onAccent: foreground.hex,
    contrast: Math.round(foreground.ratio * 100) / 100,
    meetsAA: foreground.ratio >= AA_NORMAL,
    surfaceContrast: Math.round(againstSurface * 100) / 100,
    meetsUIContrast: againstSurface >= UI_MIN_CONTRAST,
    adapted: toHex(accent) !== toHex(chosen),
  };
}

export interface ThemedPalette {
  light: SurfacePalette;
  dark: SurfacePalette;
}

/**
 * Both themes' palettes from the one colour an outlet chose.
 *
 * The light palette keeps the chosen colour exactly — it is what they picked
 * while looking at the swatch, and silently altering it would be dishonest;
 * if it is too pale to stand out, `meetsUIContrast` says so and the UI warns.
 * The dark palette is allowed to adapt, because the alternative is an accent
 * nobody can see on a page they never previewed.
 */
export function deriveThemedPalette(hex: string): ThemedPalette | null {
  const light = derivePaletteForSurface(hex, LIGHT_SURFACE);
  const dark = derivePaletteForSurface(hex, DARK_SURFACE, { lift: true });
  if (!light || !dark) { return null; }
  return { light, dark };
}
