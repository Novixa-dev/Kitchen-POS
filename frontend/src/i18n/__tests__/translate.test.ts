import { describe, expect, it } from 'vitest';
import { ar } from '../locales/ar';
import { en } from '../locales/en';
import { dictionaries, hasKey, interpolate, translate, translatePlural } from '../translate';
import { DEFAULT_LOCALE, LOCALES, directionOf, isLocale } from '../types';

describe('dictionary integrity', () => {
  it('ships a dictionary for every declared locale', () => {
    for (const locale of LOCALES) {
      expect(dictionaries[locale]).toBeTypeOf('object');
    }
  });

  it('defines exactly the same keys in Arabic as in English', () => {
    const enKeys = Object.keys(en).sort();
    const arKeys = Object.keys(ar).sort();
    expect(arKeys).toEqual(enKeys);
  });

  it('has no empty translations', () => {
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(dictionaries[locale])) {
        expect(value.trim(), `${locale}:${key} is blank`).not.toBe('');
      }
    }
  });

  it('keeps placeholders consistent between locales', () => {
    const placeholders = (s: string) =>
      [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      // `{count}` is injected by tPlural, so a locale may legitimately omit it
      // when its plural form spells the number out (Arabic dual, for example).
      if (key.includes('.one') || key.includes('.two') || key.includes('.zero')) { continue; }
      expect(placeholders(ar[key]), `placeholders differ for ${key}`)
        .toEqual(placeholders(en[key]));
    }
  });

  it('defaults to Arabic', () => {
    expect(DEFAULT_LOCALE).toBe('ar');
  });
});

describe('isLocale / directionOf', () => {
  it('accepts supported locales and rejects anything else', () => {
    expect(isLocale('ar')).toBe(true);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('fr')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale(42)).toBe(false);
  });

  it('maps Arabic to RTL and English to LTR', () => {
    expect(directionOf('ar')).toBe('rtl');
    expect(directionOf('en')).toBe('ltr');
  });
});

describe('interpolate', () => {
  it('substitutes named placeholders', () => {
    expect(interpolate('Hello {name}', { name: 'Sara' })).toBe('Hello Sara');
  });

  it('substitutes the same placeholder more than once', () => {
    expect(interpolate('{a}-{a}', { a: 1 })).toBe('1-1');
  });

  it('leaves unknown placeholders untouched rather than printing undefined', () => {
    expect(interpolate('Hello {name}', { other: 'x' })).toBe('Hello {name}');
  });

  it('returns the template unchanged when no values are given', () => {
    expect(interpolate('Hello {name}')).toBe('Hello {name}');
  });

  it('does not treat a literal "undefined" value as missing', () => {
    expect(interpolate('{v}', { v: 0 })).toBe('0');
  });
});

describe('translate', () => {
  it('resolves a key in Arabic', () => {
    expect(translate('ar', 'nav.dashboard')).toBe('لوحة التحكم');
  });

  it('resolves a key in English', () => {
    expect(translate('en', 'nav.dashboard')).toBe('Dashboard');
  });

  it('interpolates values', () => {
    expect(translate('en', 'auth.loggedInAs', { name: 'Omar' })).toBe('Signed in as Omar');
    expect(translate('ar', 'auth.loggedInAs', { name: 'عمر' })).toContain('عمر');
  });

  it('falls back to the key when it is absent at runtime', () => {
    // Cast past the compile-time guarantee to exercise the runtime fallback.
    expect(translate('en', 'does.not.exist' as never)).toBe('does.not.exist');
  });
});

describe('translatePlural', () => {
  it('uses the English singular and plural forms', () => {
    expect(translatePlural('en', 'order.itemCount', 1)).toBe('1 item');
    expect(translatePlural('en', 'order.itemCount', 5)).toBe('5 items');
  });

  it('uses the English zero form', () => {
    // English has no CLDR `zero` category, so 0 selects `other`.
    expect(translatePlural('en', 'order.itemCount', 0)).toBe('0 items');
  });

  it('selects the Arabic dual form for two', () => {
    expect(translatePlural('ar', 'order.itemCount', 2)).toBe('صنفان');
  });

  it('selects the Arabic singular for one', () => {
    expect(translatePlural('ar', 'order.itemCount', 1)).toBe('صنف واحد');
  });

  it('selects the Arabic zero form for zero', () => {
    expect(translatePlural('ar', 'order.itemCount', 0)).toBe('لا توجد أصناف');
  });

  it('distinguishes the Arabic few and many categories', () => {
    // CLDR Arabic: 3-10 -> few, 11-99 -> many.
    expect(translatePlural('ar', 'order.itemCount', 3)).toBe('3 أصناف');
    expect(translatePlural('ar', 'order.itemCount', 11)).toBe('11 صنفًا');
  });

  it('falls back to the base key for an unknown plural set', () => {
    expect(translatePlural('en', 'nope.nothing', 3)).toBe('nope.nothing');
  });
});

describe('hasKey', () => {
  it('reports presence per locale', () => {
    expect(hasKey('ar', 'nav.settings')).toBe(true);
    expect(hasKey('en', 'nav.settings')).toBe(true);
    expect(hasKey('en', 'nav.nope')).toBe(false);
  });
});
