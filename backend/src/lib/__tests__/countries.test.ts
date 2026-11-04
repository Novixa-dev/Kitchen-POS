import { describe, expect, it } from 'vitest';
import {
  COUNTRIES,
  OTHER_COUNTRY,
  defaultsFor,
  getCountry,
  isCountryCode,
  validateCountries,
} from '../countries';
import { round } from '../money';

describe('catalogue integrity', () => {
  it('has no duplicates, malformed codes or self-contradicting tax', () => {
    expect(validateCountries()).toEqual([]);
  });

  it('offers enough countries to be useful without being a list of 249', () => {
    expect(COUNTRIES.length).toBeGreaterThan(15);
    expect(COUNTRIES.length).toBeLessThan(60);
  });

  it('covers the Gulf, which is the app default locale region', () => {
    const codes = COUNTRIES.map(c => c.code);
    for (const code of ['SA', 'AE', 'KW', 'QA', 'BH', 'OM']) {
      expect(codes, code).toContain(code);
    }
  });

  it('defaults the Arabic-speaking countries to Arabic', () => {
    for (const code of ['SA', 'AE', 'EG', 'MA', 'IQ']) {
      expect(getCountry(code)?.defaultLocale, code).toBe('ar');
    }
  });
});

describe('minor units', () => {
  it('gives the Gulf dinars three decimals, since they divide into 1000 fils', () => {
    // This reaches the rounding rule, so a wrong value here is wrong money on
    // every bill rather than a cosmetic slip.
    for (const code of ['KW', 'BH', 'OM', 'JO', 'TN', 'LY']) {
      expect(getCountry(code)?.currency.decimals, code).toBe(3);
    }
  });

  it('gives the currencies with no minor unit in practice zero decimals', () => {
    for (const code of ['IQ', 'LB', 'PK']) {
      expect(getCountry(code)?.currency.decimals, code).toBe(0);
    }
  });

  it('rounds to the declared precision, for every profile', () => {
    // The contract between this table and the money rule: a price rounded to
    // a currency's own decimals must survive a round trip.
    for (const country of COUNTRIES) {
      const decimals = country.currency.decimals;
      const value = round(12.3456789, decimals);
      expect(round(value, decimals), country.code).toBe(value);
    }
  });

  it('rounds a three-decimal currency to the fils, not the halala', () => {
    const kuwait = getCountry('KW');
    expect(round(1.23456, kuwait!.currency.decimals)).toBe(1.235);
  });
});

describe('tax defaults', () => {
  it('sets the Saudi rate, which is the app shipped default', () => {
    const saudi = getCountry('SA');
    expect(saudi?.tax).toEqual({ mode: 'vat', rate: 15, inclusive: true });
  });

  it('keeps India on GST, since the app began as an Indian build', () => {
    // Existing installs migrate onto this profile, and the CGST/SGST split
    // is not the same calculation as a single VAT line.
    expect(getCountry('IN')?.tax.mode).toBe('gst');
  });

  it('charges nothing by default where tax is set below the national level', () => {
    // A national default for the United States would be wrong everywhere,
    // since the rate is set per state and city.
    expect(getCountry('US')?.tax).toEqual({ mode: 'none', rate: 0, inclusive: false });
  });

  it('never pairs a rate with no regime, or a regime with no rate', () => {
    for (const country of COUNTRIES) {
      if (country.tax.mode === 'none') {
        expect(country.tax.rate, country.code).toBe(0);
      } else {
        expect(country.tax.rate, country.code).toBeGreaterThan(0);
      }
    }
  });
});

describe('defaultsFor', () => {
  it('returns currency, tax and locale together', () => {
    expect(defaultsFor('SA')).toEqual({
      currency: { code: 'SAR', symbol: 'ر.س', decimals: 2, position: 'after' },
      tax: { mode: 'vat', rate: 15, inclusive: true },
      locale: 'ar',
    });
  });

  it('accepts a lowercase code', () => {
    expect(defaultsFor('ae')?.currency.code).toBe('AED');
  });

  it('returns null for "not listed", so nothing is filled in with a guess', () => {
    expect(defaultsFor(OTHER_COUNTRY)).toBeNull();
    expect(defaultsFor('XX')).toBeNull();
    expect(defaultsFor('')).toBeNull();
  });

  it('returns a copy, so a caller mutating it cannot edit the catalogue', () => {
    const first = defaultsFor('SA');
    first!.tax.rate = 99;
    expect(defaultsFor('SA')?.tax.rate).toBe(15);
  });
});

describe('isCountryCode', () => {
  it('recognises a listed country and rejects anything else', () => {
    expect(isCountryCode('SA')).toBe(true);
    expect(isCountryCode('sa')).toBe(true);
    expect(isCountryCode(OTHER_COUNTRY)).toBe(false);
    expect(isCountryCode('Saudi Arabia')).toBe(false);
    expect(isCountryCode(undefined)).toBe(false);
  });
});
