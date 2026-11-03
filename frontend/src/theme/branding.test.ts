import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BRANDING_STORAGE_KEY,
  FALLBACK_BRANDING,
  applyBrandingVars,
  cacheBranding,
  isResolvedBranding,
  readCachedBranding,
  type ResolvedBranding,
} from './branding';

const sample: ResolvedBranding = {
  preset: 'emerald',
  accent: '#047857',
  font: 'kufi',
  density: 'compact',
  stack: '"Noto Kufi Arabic", sans-serif',
  scale: 0.875,
  palette: {
    light: {
      accent: '#047857',
      accentHover: '#03624a',
      accentSubtle: '#e8f4f0',
      onAccent: '#ffffff',
      contrast: 4.9,
      meetsAA: true,
      surfaceContrast: 4.3,
      meetsUIContrast: true,
      adapted: false,
    },
    dark: {
      accent: '#3ba882',
      accentHover: '#5cb795',
      accentSubtle: '#0d2a23',
      onAccent: '#06142c',
      contrast: 7.2,
      meetsAA: true,
      surfaceContrast: 4.8,
      meetsUIContrast: true,
      adapted: true,
    },
  },
};

describe('isResolvedBranding', () => {
  it('accepts a complete record', () => {
    expect(isResolvedBranding(sample)).toBe(true);
    expect(isResolvedBranding(FALLBACK_BRANDING)).toBe(true);
  });

  it('rejects anything that is not an object', () => {
    expect(isResolvedBranding(null)).toBe(false);
    expect(isResolvedBranding(undefined)).toBe(false);
    expect(isResolvedBranding('#047857')).toBe(false);
    expect(isResolvedBranding(7)).toBe(false);
  });

  it('rejects a record missing half the palette', () => {
    // The reason this guard exists: a missing field leaves `var()` pointing
    // at `undefined`, which drops the declaration rather than falling back
    // to the stylesheet — every button would render unstyled.
    expect(isResolvedBranding({ ...sample, palette: { light: sample.palette.light } }))
      .toBe(false);
  });

  it('rejects a palette whose colours are not strings', () => {
    expect(isResolvedBranding({
      ...sample,
      palette: { light: { ...sample.palette.light, accent: 0x047857 }, dark: sample.palette.dark },
    })).toBe(false);
  });

  it('rejects a scale that would collapse the layout', () => {
    expect(isResolvedBranding({ ...sample, scale: 0 })).toBe(false);
    expect(isResolvedBranding({ ...sample, scale: -1 })).toBe(false);
    expect(isResolvedBranding({ ...sample, scale: Number.NaN })).toBe(false);
    expect(isResolvedBranding({ ...sample, scale: '0.875' })).toBe(false);
  });
});

describe('applyBrandingVars', () => {
  let element: HTMLElement;

  beforeEach(() => {
    element = document.createElement('div');
  });

  it('paints the four accent tokens for the light theme', () => {
    applyBrandingVars(element, sample, 'light');
    expect(element.style.getPropertyValue('--kp-brand')).toBe('#047857');
    expect(element.style.getPropertyValue('--kp-brand-hover')).toBe('#03624a');
    expect(element.style.getPropertyValue('--kp-brand-subtle')).toBe('#e8f4f0');
    expect(element.style.getPropertyValue('--kp-on-brand')).toBe('#ffffff');
  });

  it('paints the dark variant for the dark theme', () => {
    // Not the same colour: an accent chosen against a white page can be
    // invisible on a near-black one, so the dark palette is a lifted version.
    applyBrandingVars(element, sample, 'dark');
    expect(element.style.getPropertyValue('--kp-brand')).toBe('#3ba882');
    expect(element.style.getPropertyValue('--kp-on-brand')).toBe('#06142c');
  });

  it('switches cleanly between themes, leaving nothing from the other', () => {
    applyBrandingVars(element, sample, 'dark');
    applyBrandingVars(element, sample, 'light');
    expect(element.style.getPropertyValue('--kp-brand')).toBe('#047857');
    expect(element.style.getPropertyValue('--kp-brand-subtle')).toBe('#e8f4f0');
  });

  it('sets the font stack and the density scale', () => {
    applyBrandingVars(element, sample, 'light');
    expect(element.style.getPropertyValue('--font-sans')).toBe('"Noto Kufi Arabic", sans-serif');
    expect(element.style.getPropertyValue('--kp-density-scale')).toBe('0.875');
  });

  it('removes the font override when the branding carries no stack', () => {
    // Writing an empty string would blank the font rather than defer to the
    // stylesheet, and the fallback branding has no stack of its own.
    applyBrandingVars(element, sample, 'light');
    applyBrandingVars(element, FALLBACK_BRANDING, 'light');
    expect(element.style.getPropertyValue('--font-sans')).toBe('');
  });
});

describe('readCachedBranding', () => {
  afterEach(() => {
    window.localStorage.removeItem(BRANDING_STORAGE_KEY);
  });

  it('returns the fallback when nothing is cached', () => {
    expect(readCachedBranding()).toEqual(FALLBACK_BRANDING);
  });

  it('round-trips a cached record', () => {
    cacheBranding(sample);
    expect(readCachedBranding()).toEqual(sample);
  });

  it('falls back on malformed JSON rather than throwing on first paint', () => {
    window.localStorage.setItem(BRANDING_STORAGE_KEY, '{not json');
    expect(readCachedBranding()).toEqual(FALLBACK_BRANDING);
  });

  it('falls back on a record written by a build with a different shape', () => {
    window.localStorage.setItem(BRANDING_STORAGE_KEY, JSON.stringify({ accent: '#047857' }));
    expect(readCachedBranding()).toEqual(FALLBACK_BRANDING);
  });

  it('ships a fallback that is itself valid', () => {
    // It is applied directly on first paint, so it has to satisfy the guard.
    expect(isResolvedBranding(FALLBACK_BRANDING)).toBe(true);
  });
});
