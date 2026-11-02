import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_CURRENCY,
  formatCurrency,
  formatDate,
  formatElapsed,
  formatNumber,
  formatPercent,
  formatRelativeTime,
  formatTime,
  intlTag,
  toDate,
  type FormatContext,
} from '../format';

const arLatn: FormatContext = { locale: 'ar', numerals: 'latn', currency: DEFAULT_CURRENCY };
const arArab: FormatContext = { locale: 'ar', numerals: 'arab', currency: DEFAULT_CURRENCY };
const enLatn: FormatContext = { locale: 'en', numerals: 'latn', currency: DEFAULT_CURRENCY };

describe('intlTag', () => {
  it('encodes the numbering system in the BCP-47 tag', () => {
    expect(intlTag('ar', 'latn')).toBe('ar-u-nu-latn');
    expect(intlTag('ar', 'arab')).toBe('ar-u-nu-arab');
    expect(intlTag('en', 'latn')).toBe('en-u-nu-latn');
  });
});

describe('formatNumber', () => {
  it('uses Latin digits when asked', () => {
    expect(formatNumber(1234.5, enLatn)).toBe('1,234.5');
  });

  it('uses Arabic-Indic digits when asked', () => {
    const out = formatNumber(123, arArab);
    expect(out).toMatch(/[٠-٩]/);
    expect(out).not.toMatch(/[0-9]/);
  });

  it('keeps Latin digits for Arabic when the numeral system is latn', () => {
    expect(formatNumber(123, arLatn)).toMatch(/^123$/);
  });

  it('renders a placeholder for non-finite values instead of "NaN"', () => {
    expect(formatNumber(Number.NaN, enLatn)).toBe('—');
    expect(formatNumber(Number.POSITIVE_INFINITY, enLatn)).toBe('—');
  });
});

describe('formatCurrency', () => {
  it('places the symbol after the amount by default', () => {
    // U+00A0 keeps symbol and amount together.
    expect(formatCurrency(10, enLatn)).toBe('10.00 ر.س');
  });

  it('places the symbol before the amount when configured', () => {
    const ctx: FormatContext = {
      ...enLatn,
      currency: { code: 'USD', symbol: '$', decimals: 2, position: 'before' },
    };
    expect(formatCurrency(10, ctx)).toBe('$ 10.00');
  });

  it('honours the configured decimal places', () => {
    const ctx: FormatContext = {
      ...enLatn,
      currency: { code: 'JPY', symbol: '¥', decimals: 0, position: 'before' },
    };
    expect(formatCurrency(1500, ctx)).toBe('¥ 1,500');
  });

  it('falls back to the ISO code when no symbol is configured', () => {
    const ctx: FormatContext = {
      ...enLatn,
      currency: { code: 'AED', symbol: '', decimals: 2, position: 'after' },
    };
    expect(formatCurrency(5, ctx)).toBe('5.00 AED');
  });

  it('can omit the symbol for table cells that have their own header', () => {
    expect(formatCurrency(10, enLatn, { showSymbol: false })).toBe('10.00');
  });

  it('treats a non-finite amount as zero rather than printing NaN', () => {
    expect(formatCurrency(Number.NaN, enLatn, { showSymbol: false })).toBe('0.00');
  });

  it('rounds to the configured precision', () => {
    expect(formatCurrency(10.005, enLatn, { showSymbol: false })).toBe('10.01');
    expect(formatCurrency(10.004, enLatn, { showSymbol: false })).toBe('10.00');
  });
});

describe('formatPercent', () => {
  it('formats a whole-number rate', () => {
    expect(formatPercent(15, enLatn)).toBe('15%');
  });

  it('keeps fractional rates', () => {
    expect(formatPercent(2.5, enLatn)).toBe('2.5%');
  });
});

describe('toDate', () => {
  it('passes a valid Date through', () => {
    const d = new Date('2026-03-01T10:00:00Z');
    expect(toDate(d)).toBe(d);
  });

  it('parses ISO strings and epoch numbers', () => {
    expect(toDate('2026-03-01T10:00:00Z')?.getTime()).toBe(Date.UTC(2026, 2, 1, 10));
    expect(toDate(0)?.getTime()).toBe(0);
  });

  it('returns null for unparseable input', () => {
    expect(toDate('not a date')).toBeNull();
    expect(toDate(new Date('nope'))).toBeNull();
  });
});

describe('formatDate / formatTime', () => {
  const when = new Date('2026-03-01T13:05:00Z');

  it('formats a date in English', () => {
    expect(formatDate(when, { ...enLatn, timeZone: 'UTC' }, 'medium')).toBe('Mar 1, 2026');
  });

  it('formats a date in Arabic script', () => {
    const out = formatDate(when, { ...arLatn, timeZone: 'UTC' }, 'long');
    expect(out).toMatch(/[؀-ۿ]/);
  });

  it('formats a time in the given zone', () => {
    expect(formatTime(when, { ...enLatn, timeZone: 'UTC' })).toMatch(/01:05/);
  });

  it('can include seconds', () => {
    expect(formatTime(when, { ...enLatn, timeZone: 'UTC' }, { withSeconds: true }))
      .toMatch(/01:05:00/);
  });

  it('renders a placeholder for an invalid date', () => {
    expect(formatDate('nope', enLatn)).toBe('—');
    expect(formatTime('nope', enLatn)).toBe('—');
  });
});

describe('formatRelativeTime', () => {
  it('describes a past instant', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T12:00:00Z'));
    expect(formatRelativeTime(new Date('2026-03-01T11:00:00Z'), enLatn)).toBe('1 hour ago');
    vi.useRealTimers();
  });

  it('describes a future instant', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T12:00:00Z'));
    expect(formatRelativeTime(new Date('2026-03-03T12:00:00Z'), enLatn)).toBe('in 2 days');
    vi.useRealTimers();
  });

  it('renders a placeholder for an invalid date', () => {
    expect(formatRelativeTime('nope', enLatn)).toBe('—');
  });
});

describe('formatElapsed', () => {
  it('renders mm:ss since the given instant', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T12:03:07Z'));
    expect(formatElapsed(new Date('2026-03-01T12:00:00Z'), enLatn)).toBe('03:07');
    vi.useRealTimers();
  });

  it('clamps a future instant to zero rather than showing negative time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T12:00:00Z'));
    expect(formatElapsed(new Date('2026-03-01T12:05:00Z'), enLatn)).toBe('00:00');
    vi.useRealTimers();
  });

  it('keeps counting past an hour', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T13:30:00Z'));
    expect(formatElapsed(new Date('2026-03-01T12:00:00Z'), enLatn)).toBe('90:00');
    vi.useRealTimers();
  });
});
