import { describe, expect, it } from 'vitest';
import {
  CUSTOM_PRESET,
  DEFAULT_BRANDING,
  DENSITY_SCALE,
  FONT_STACKS,
  THEME_PRESETS,
  applyPreset,
  editBranding,
  fontStack,
  getPreset,
  isDensity,
  isFontChoice,
  resolveBranding,
  sanitiseBranding,
} from '../branding';
import { UI_MIN_CONTRAST, contrastRatio, LIGHT_SURFACE, parseHex } from '../colour';

describe('preset catalogue', () => {
  it('gives every preset a unique id', () => {
    const ids = THEME_PRESETS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('never uses the reserved `custom` id', () => {
    expect(THEME_PRESETS.some(p => p.id === CUSTOM_PRESET)).toBe(false);
  });

  it('gives every preset a translation key, so the catalogue stays bilingual', () => {
    for (const p of THEME_PRESETS) {
      expect(p.nameKey).toMatch(/^preset\./);
    }
  });

  it('gives every preset a parseable accent and a known font and density', () => {
    for (const p of THEME_PRESETS) {
      expect(parseHex(p.accent), p.id).not.toBeNull();
      expect(isFontChoice(p.font), p.id).toBe(true);
      expect(isDensity(p.density), p.id).toBe(true);
    }
  });

  it('ships no preset that lands the outlet in a warned state', () => {
    // A preset showing a contrast warning the moment it is picked reads as a
    // broken preset, not as advice, so every bundled accent must clear the
    // 3:1 a UI component needs against the light page.
    for (const p of THEME_PRESETS) {
      const ratio = contrastRatio(parseHex(p.accent)!, LIGHT_SURFACE);
      expect(ratio, `${p.id} (${p.accent})`).toBeGreaterThanOrEqual(UI_MIN_CONTRAST);
    }
  });

  it('matches the shipped default', () => {
    // The default branding must *be* a preset, or the UI opens on "custom"
    // for an install nobody has customised.
    const preset = getPreset(DEFAULT_BRANDING.preset);
    expect(preset).toBeDefined();
    expect(preset!.accent).toBe(DEFAULT_BRANDING.accent);
    expect(preset!.font).toBe(DEFAULT_BRANDING.font);
    expect(preset!.density).toBe(DEFAULT_BRANDING.density);
  });
});

describe('font stacks', () => {
  it('ends every stack in the system stack', () => {
    // The app fetches no webfont, so a named family may simply be absent.
    // Falling back to the system stack keeps Arabic rendering correctly
    // instead of dropping to a browser default.
    for (const [choice, stack] of Object.entries(FONT_STACKS)) {
      if (choice === 'system') { continue; }
      expect(stack.endsWith(FONT_STACKS.system), choice).toBe(true);
    }
  });

  it('falls back for an unknown choice', () => {
    expect(fontStack('comic-sans')).toBe(FONT_STACKS.system);
    expect(fontStack(undefined)).toBe(FONT_STACKS.system);
    expect(fontStack('naskh')).toBe(FONT_STACKS.naskh);
  });

  it('makes compact genuinely tighter than comfortable', () => {
    expect(DENSITY_SCALE.compact).toBeLessThan(DENSITY_SCALE.comfortable);
  });
});

describe('sanitiseBranding', () => {
  it('returns the default for a missing or non-object record', () => {
    expect(sanitiseBranding(undefined)).toEqual(DEFAULT_BRANDING);
    expect(sanitiseBranding(null)).toEqual(DEFAULT_BRANDING);
    expect(sanitiseBranding('classic-blue')).toEqual(DEFAULT_BRANDING);
  });

  it('keeps a valid record', () => {
    const stored = { preset: 'emerald', accent: '#047857', font: 'kufi', density: 'compact' };
    expect(sanitiseBranding(stored)).toEqual(stored);
  });

  it('falls back on an unparseable accent rather than passing it through', () => {
    // An accent that is not a colour reaches the CSS variables and leaves
    // every button unstyled, so this one must not survive.
    expect(sanitiseBranding({ accent: 'brand red' }).accent).toBe(DEFAULT_BRANDING.accent);
    expect(sanitiseBranding({ accent: '' }).accent).toBe(DEFAULT_BRANDING.accent);
    expect(sanitiseBranding({ accent: 42 }).accent).toBe(DEFAULT_BRANDING.accent);
  });

  it('normalises a three-digit accent, so comparisons can be textual', () => {
    expect(sanitiseBranding({ accent: '#abc' }).accent).toBe('#aabbcc');
  });

  it('falls back on an unknown font or density', () => {
    const result = sanitiseBranding({ font: 'papyrus', density: 'roomy' });
    expect(result.font).toBe(DEFAULT_BRANDING.font);
    expect(result.density).toBe(DEFAULT_BRANDING.density);
  });

  it('turns a preset this build does not know into `custom`', () => {
    // Written by a newer build. The accent and font stored with it are still
    // the admin's choices, so the name is dropped and the look is kept.
    const result = sanitiseBranding({
      preset: 'neon-future',
      accent: '#047857',
      font: 'kufi',
      density: 'compact',
    });
    expect(result.preset).toBe(CUSTOM_PRESET);
    expect(result.accent).toBe('#047857');
    expect(result.font).toBe('kufi');
  });

  it('keeps an explicit `custom`', () => {
    expect(sanitiseBranding({ preset: CUSTOM_PRESET, accent: '#123456' }).preset)
      .toBe(CUSTOM_PRESET);
  });
});

describe('applyPreset', () => {
  it('sets accent, font and density together', () => {
    const result = applyPreset(DEFAULT_BRANDING, 'espresso');
    const preset = getPreset('espresso')!;
    expect(result).toEqual({
      preset: 'espresso',
      accent: preset.accent,
      font: preset.font,
      density: preset.density,
    });
  });

  it('leaves the branding untouched for an unknown id', () => {
    expect(applyPreset(DEFAULT_BRANDING, 'nope')).toEqual(DEFAULT_BRANDING);
  });
});

describe('editBranding', () => {
  it('turns the selection into `custom` when a field stops matching', () => {
    // This is the duplicate-and-edit path: start from a preset, adjust it,
    // and the UI must stop claiming the outlet is still on that preset.
    const saffron = applyPreset(DEFAULT_BRANDING, 'saffron');
    const edited = editBranding(saffron, { accent: '#7c2d12' });
    expect(edited.preset).toBe(CUSTOM_PRESET);
    expect(edited.accent).toBe('#7c2d12');
    // The rest of the preset is carried over, not reset.
    expect(edited.font).toBe(saffron.font);
    expect(edited.density).toBe(saffron.density);
  });

  it('restores the preset name when the values match it again', () => {
    const saffron = applyPreset(DEFAULT_BRANDING, 'saffron');
    const away = editBranding(saffron, { accent: '#7c2d12' });
    const back = editBranding(away, { accent: saffron.accent });
    expect(back.preset).toBe('saffron');
  });

  it('recognises a hand-built match to a preset', () => {
    const emerald = getPreset('emerald')!;
    const built = editBranding(
      { preset: CUSTOM_PRESET, accent: '#000000', font: 'system', density: 'comfortable' },
      { accent: emerald.accent, font: emerald.font, density: emerald.density },
    );
    expect(built.preset).toBe('emerald');
  });

  it('sanitises the patch, so a bad value cannot be written by editing', () => {
    const edited = editBranding(DEFAULT_BRANDING, {
      accent: 'not a colour',
      font: 'papyrus' as never,
    });
    expect(edited.accent).toBe(DEFAULT_BRANDING.accent);
    expect(edited.font).toBe(DEFAULT_BRANDING.font);
  });

  it('normalises before comparing, so #abc and #aabbcc are one colour', () => {
    const edited = editBranding(DEFAULT_BRANDING, { accent: '#25f' });
    expect(edited.accent).toBe('#2255ff');
  });
});

describe('resolveBranding', () => {
  it('always produces a palette, even from a corrupted record', () => {
    // The call sites paint CSS variables from this; a null palette would
    // have to be handled at every one of them.
    for (const raw of [undefined, null, {}, { accent: 'nonsense' }, 'x', 7]) {
      const resolved = resolveBranding(raw);
      expect(resolved.palette.light.accent).toMatch(/^#[0-9a-f]{6}$/);
      expect(resolved.palette.dark.accent).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('carries the stack and scale for the chosen font and density', () => {
    const resolved = resolveBranding({ font: 'naskh', density: 'compact', accent: '#2563eb' });
    expect(resolved.stack).toBe(FONT_STACKS.naskh);
    expect(resolved.scale).toBe(DENSITY_SCALE.compact);
  });

  it('keeps the chosen accent in the light palette and adapts it for dark', () => {
    // A deep navy is a reasonable light-mode choice and nearly invisible on
    // the dark page, so the dark palette is allowed to lift it.
    const resolved = resolveBranding({ accent: '#1e2a5a' });
    expect(resolved.palette.light.accent).toBe('#1e2a5a');
    expect(resolved.palette.light.adapted).toBe(false);
    expect(resolved.palette.dark.adapted).toBe(true);
    expect(resolved.palette.dark.meetsUIContrast).toBe(true);
  });

  it('resolves every bundled preset to a usable pair of palettes', () => {
    for (const p of THEME_PRESETS) {
      const resolved = resolveBranding(applyPreset(DEFAULT_BRANDING, p.id));
      expect(resolved.palette.light.meetsUIContrast, `${p.id} light`).toBe(true);
      expect(resolved.palette.dark.meetsUIContrast, `${p.id} dark`).toBe(true);
      expect(resolved.palette.light.meetsAA, `${p.id} label`).toBe(true);
    }
  });
});
