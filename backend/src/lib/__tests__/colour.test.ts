import { describe, expect, it } from 'vitest';
import {
  AA_LARGE,
  AA_NORMAL,
  DARK_SURFACE,
  GUARANTEED_MIN_CONTRAST,
  LIGHT_SURFACE,
  UI_MIN_CONTRAST,
  contrastRatio,
  derivePalette,
  derivePaletteForSurface,
  deriveThemedPalette,
  foregroundFor,
  liftForSurface,
  luminance,
  mix,
  parseHex,
  shade,
  toHex,
} from '../colour';

describe('parseHex', () => {
  it('parses six-digit hex', () => {
    expect(parseHex('#2563eb')).toEqual({ r: 0x25, g: 0x63, b: 0xeb });
  });

  it('parses three-digit hex by doubling each digit', () => {
    expect(parseHex('#abc')).toEqual({ r: 0xaa, g: 0xbb, b: 0xcc });
  });

  it('accepts a missing hash and surrounding space', () => {
    expect(parseHex('  2563eb ')).toEqual({ r: 0x25, g: 0x63, b: 0xeb });
  });

  it('is case-insensitive', () => {
    expect(parseHex('#2563EB')).toEqual(parseHex('#2563eb'));
  });

  it('rejects anything that is not a hex colour', () => {
    expect(parseHex('')).toBeNull();
    expect(parseHex('blue')).toBeNull();
    expect(parseHex('#12345')).toBeNull();
    expect(parseHex('#1234567')).toBeNull();
    expect(parseHex('rgb(0,0,0)')).toBeNull();
    expect(parseHex('#xyzxyz')).toBeNull();
  });
});

describe('toHex', () => {
  it('round-trips a parsed colour', () => {
    expect(toHex(parseHex('#2563eb')!)).toBe('#2563eb');
  });

  it('pads single-digit channels', () => {
    expect(toHex({ r: 1, g: 2, b: 3 })).toBe('#010203');
  });

  it('clamps out-of-range channels rather than wrapping', () => {
    expect(toHex({ r: -20, g: 300, b: 128 })).toBe('#00ff80');
  });

  it('rounds fractional channels, which `shade` produces', () => {
    expect(toHex({ r: 10.6, g: 10.4, b: 10.5 })).toBe('#0b0a0b');
  });
});

describe('luminance', () => {
  it('is 0 for black and 1 for white', () => {
    expect(luminance({ r: 0, g: 0, b: 0 })).toBe(0);
    expect(luminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 10);
  });

  it('weights green most heavily, as the spec does', () => {
    const red = luminance({ r: 255, g: 0, b: 0 });
    const green = luminance({ r: 0, g: 255, b: 0 });
    const blue = luminance({ r: 0, g: 0, b: 255 });
    expect(green).toBeGreaterThan(red);
    expect(red).toBeGreaterThan(blue);
  });
});

describe('contrastRatio', () => {
  it('gives 21 for black on white, the spec maximum', () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }))
      .toBeCloseTo(21, 2);
  });

  it('gives 1 for a colour against itself', () => {
    expect(contrastRatio({ r: 37, g: 99, b: 235 }, { r: 37, g: 99, b: 235 }))
      .toBeCloseTo(1, 10);
  });

  it('is symmetric', () => {
    const a = parseHex('#2563eb')!;
    const b = parseHex('#ffffff')!;
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 10);
  });
});

describe('foregroundFor', () => {
  it('chooses white on a dark accent', () => {
    expect(foregroundFor(parseHex('#1d4ed8')!).hex).toBe('#ffffff');
  });

  it('chooses near-black on a pale accent', () => {
    // This is the case that makes the whole module worth having: defaulting to
    // white here would produce a button nobody can read.
    expect(foregroundFor(parseHex('#fde047')!).hex).toBe('#06142c');
  });

  it('reports the contrast it achieved', () => {
    const result = foregroundFor(parseHex('#ffffff')!);
    expect(result.hex).toBe('#06142c');
    expect(result.ratio).toBeGreaterThan(AA_NORMAL);
  });
});

describe('shade', () => {
  it('darkens towards black for a negative amount', () => {
    const darker = shade({ r: 100, g: 100, b: 100 }, -0.5);
    expect(darker).toEqual({ r: 50, g: 50, b: 50 });
  });

  it('lightens towards white for a positive amount', () => {
    const lighter = shade({ r: 100, g: 100, b: 100 }, 0.5);
    expect(lighter.r).toBeCloseTo(177.5, 5);
  });

  it('returns the colour unchanged for zero', () => {
    expect(shade({ r: 10, g: 20, b: 30 }, 0)).toEqual({ r: 10, g: 20, b: 30 });
  });

  it('clamps the amount, so a wild value cannot overshoot', () => {
    expect(toHex(shade({ r: 100, g: 100, b: 100 }, 5))).toBe('#ffffff');
    expect(toHex(shade({ r: 100, g: 100, b: 100 }, -5))).toBe('#000000');
  });
});

describe('derivePalette', () => {
  it('derives hover and subtle variants from one accent', () => {
    const palette = derivePalette('#2563eb');
    expect(palette).not.toBeNull();
    expect(palette!.accent).toBe('#2563eb');
    // Hover is darker, subtle is much lighter.
    expect(luminance(parseHex(palette!.accentHover)!))
      .toBeLessThan(luminance(parseHex(palette!.accent)!));
    expect(luminance(parseHex(palette!.accentSubtle)!))
      .toBeGreaterThan(luminance(parseHex(palette!.accent)!));
  });

  it('normalises a three-digit input', () => {
    expect(derivePalette('#abc')!.accent).toBe('#aabbcc');
  });

  it('reports AA compliance for a strong accent', () => {
    const palette = derivePalette('#1d4ed8')!;
    expect(palette.onAccent).toBe('#ffffff');
    expect(palette.meetsAA).toBe(true);
  });

  it('returns a low-contrast accent with a warning rather than refusing it', () => {
    // An outlet's brand colour is theirs. The honest response is to say the
    // text may be hard to read, not to reject the colour. `#787878` is a
    // measured example: 4.42:1, just under the 4.5:1 AA-normal threshold.
    const palette = derivePalette('#787878')!;
    expect(palette.meetsAA).toBe(false);
    expect(palette.accent).toBe('#787878');
    expect(palette.contrast).toBeLessThan(AA_NORMAL);
  });

  it('never drops below the guaranteed floor, anywhere in the colour space', () => {
    // The property that justifies not reporting a large-text flag. Sweeping
    // every 17th value of each channel (4096 colours) found a worst case of
    // 4.28:1 at #118888, which still clears the 3:1 large-text threshold.
    let worst = Number.POSITIVE_INFINITY;
    let worstHex = '';

    for (let r = 0; r < 256; r += 17) {
      for (let g = 0; g < 256; g += 17) {
        for (let b = 0; b < 256; b += 17) {
          const hex = `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
          const palette = derivePalette(hex);
          expect(palette).not.toBeNull();
          if (palette!.contrast < worst) {
            worst = palette!.contrast;
            worstHex = hex;
          }
        }
      }
    }

    expect(worst).toBeGreaterThanOrEqual(GUARANTEED_MIN_CONTRAST);
    expect(worst).toBeGreaterThanOrEqual(AA_LARGE);
    expect(worstHex).toBe('#118888');
  });

  it('rounds the reported contrast to two decimals', () => {
    expect(derivePalette('#2563eb')!.contrast.toString()).toMatch(/^\d+(\.\d{1,2})?$/);
  });

  it('returns null for input that is not a colour', () => {
    expect(derivePalette('not a colour')).toBeNull();
    expect(derivePalette('')).toBeNull();
  });

  it('produces a palette whose own foreground clears AA for black and white', () => {
    for (const hex of ['#000000', '#ffffff']) {
      const palette = derivePalette(hex)!;
      expect(palette.meetsAA).toBe(true);
    }
  });
});

describe('mix', () => {
  it('returns the endpoints at 0 and 1', () => {
    const a = { r: 10, g: 20, b: 30 };
    const b = { r: 200, g: 210, b: 220 };
    expect(mix(a, b, 0)).toEqual(a);
    expect(mix(a, b, 1)).toEqual(b);
  });

  it('lands halfway at 0.5', () => {
    expect(mix({ r: 0, g: 0, b: 0 }, { r: 100, g: 200, b: 50 }, 0.5))
      .toEqual({ r: 50, g: 100, b: 25 });
  });

  it('clamps the weight, so a wild value cannot overshoot', () => {
    const a = { r: 10, g: 10, b: 10 };
    const b = { r: 20, g: 20, b: 20 };
    expect(mix(a, b, 5)).toEqual(b);
    expect(mix(a, b, -5)).toEqual(a);
  });
});

describe('liftForSurface', () => {
  it('leaves a colour that already stands clear of the surface', () => {
    const accent = parseHex('#2563eb')!;
    expect(liftForSurface(accent, LIGHT_SURFACE)).toEqual(accent);
  });

  it('lightens a dark accent on the dark page', () => {
    // The case this exists for: a navy accent chosen in the light preview is
    // nearly invisible on the dark theme's near-black page.
    const navy = parseHex('#1e2a5a')!;
    expect(contrastRatio(navy, DARK_SURFACE)).toBeLessThan(UI_MIN_CONTRAST);

    const lifted = liftForSurface(navy, DARK_SURFACE);
    expect(luminance(lifted)).toBeGreaterThan(luminance(navy));
    expect(contrastRatio(lifted, DARK_SURFACE)).toBeGreaterThanOrEqual(UI_MIN_CONTRAST);
  });

  it('darkens a pale accent on the light page', () => {
    const pale = parseHex('#fde047')!;
    const lifted = liftForSurface(pale, LIGHT_SURFACE);
    expect(luminance(lifted)).toBeLessThan(luminance(pale));
    expect(contrastRatio(lifted, LIGHT_SURFACE)).toBeGreaterThanOrEqual(UI_MIN_CONTRAST);
  });

  it('stops at the first step that clears the target, staying near the choice', () => {
    // Overshooting would discard more of the outlet's colour than the
    // threshold requires.
    const navy = parseHex('#1e2a5a')!;
    const lifted = liftForSurface(navy, DARK_SURFACE);
    // One step less must still be short of the target.
    const under = mix(navy, { r: 255, g: 255, b: 255 }, 0.05);
    expect(contrastRatio(lifted, DARK_SURFACE)).toBeGreaterThanOrEqual(UI_MIN_CONTRAST);
    expect(contrastRatio(under, DARK_SURFACE)).toBeLessThan(UI_MIN_CONTRAST);
  });

  it('reaches the target for every colour, on either surface', () => {
    for (let r = 0; r < 256; r += 51) {
      for (let g = 0; g < 256; g += 51) {
        for (let b = 0; b < 256; b += 51) {
          for (const surface of [LIGHT_SURFACE, DARK_SURFACE]) {
            const lifted = liftForSurface({ r, g, b }, surface);
            expect(contrastRatio(lifted, surface)).toBeGreaterThanOrEqual(UI_MIN_CONTRAST);
          }
        }
      }
    }
  });
});

describe('derivePaletteForSurface', () => {
  it('moves subtle towards the surface and hover away from it', () => {
    const onLight = derivePaletteForSurface('#2563eb', LIGHT_SURFACE)!;
    const accent = luminance(parseHex(onLight.accent)!);
    expect(luminance(parseHex(onLight.accentSubtle)!)).toBeGreaterThan(accent);
    expect(luminance(parseHex(onLight.accentHover)!)).toBeLessThan(accent);
  });

  it('reverses both directions on a dark surface', () => {
    // The bug this prevents: a subtle chip background derived towards white
    // glows against a near-black page.
    const onDark = derivePaletteForSurface('#5b93f7', DARK_SURFACE)!;
    const accent = luminance(parseHex(onDark.accent)!);
    expect(luminance(parseHex(onDark.accentSubtle)!)).toBeLessThan(accent);
    expect(luminance(parseHex(onDark.accentHover)!)).toBeGreaterThan(accent);
  });

  it('reports contrast against the page, which is a separate question', () => {
    // A pale accent can carry perfectly readable dark text and still be
    // invisible as a button on a white page.
    const pale = derivePaletteForSurface('#fde047', LIGHT_SURFACE)!;
    expect(pale.meetsAA).toBe(true);
    expect(pale.meetsUIContrast).toBe(false);
  });

  it('does not lift unless asked', () => {
    const palette = derivePaletteForSurface('#1e2a5a', DARK_SURFACE)!;
    expect(palette.accent).toBe('#1e2a5a');
    expect(palette.adapted).toBe(false);
  });

  it('returns null for input that is not a colour', () => {
    expect(derivePaletteForSurface('mauve', LIGHT_SURFACE)).toBeNull();
  });
});

describe('deriveThemedPalette', () => {
  it('keeps the chosen colour exactly in light mode', () => {
    // It is what they picked while looking at the swatch; altering it
    // silently would be dishonest.
    const themed = deriveThemedPalette('#1e2a5a')!;
    expect(themed.light.accent).toBe('#1e2a5a');
    expect(themed.light.adapted).toBe(false);
  });

  it('gives the dark theme a visible accent for every colour', () => {
    for (let r = 0; r < 256; r += 51) {
      for (let g = 0; g < 256; g += 51) {
        for (let b = 0; b < 256; b += 51) {
          const hex = `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
          const themed = deriveThemedPalette(hex)!;
          expect(themed.dark.meetsUIContrast, hex).toBe(true);
          expect(themed.dark.contrast, hex).toBeGreaterThanOrEqual(AA_LARGE);
        }
      }
    }
  });

  it('returns null for input that is not a colour', () => {
    expect(deriveThemedPalette('')).toBeNull();
  });
});
