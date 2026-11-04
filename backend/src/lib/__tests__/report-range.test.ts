import { describe, expect, it } from 'vitest';
import { rangeFor } from '../report-range';

describe('rangeFor', () => {
  it('reads today as the local calendar day, not the UTC one', () => {
    const result = rangeFor('daily', 'created_at');
    expect(result.ok).toBe(true);
    if (!result.ok) { return; }
    // Without `'localtime'` the day rolls over three hours early in Riyadh.
    expect(result.range.condition).toContain("'localtime'");
    expect(result.range.condition).toContain("date('now', 'localtime')");
    expect(result.range.params).toEqual([]);
  });

  it('treats `today` as a synonym for `daily`', () => {
    const a = rangeFor('daily', 'created_at');
    const b = rangeFor('today', 'created_at');
    expect(a).toEqual(b);
  });

  it('makes a week the seven days up to and including today', () => {
    const result = rangeFor('weekly', 'created_at');
    if (!result.ok) { throw new Error('expected ok'); }
    expect(result.range.condition).toContain("'-6 days'");
  });

  it('scopes a month and a year with strftime, not a day arithmetic guess', () => {
    const month = rangeFor('monthly', 'created_at');
    const year = rangeFor('yearly', 'created_at');
    if (!month.ok || !year.ok) { throw new Error('expected ok'); }
    expect(month.range.condition).toContain("strftime('%Y-%m'");
    expect(year.range.condition).toContain("strftime('%Y'");
  });

  it('groups each period at the resolution a chart can read', () => {
    const groups = (['daily', 'weekly', 'monthly', 'yearly'] as const).map((f) => {
      const r = rangeFor(f, 'created_at');
      if (!r.ok) { throw new Error('expected ok'); }
      return r.range.group;
    });
    expect(groups).toEqual(['%H', '%Y-%m-%d', '%Y-%m-%d', '%Y-%m']);
  });

  it('binds both bounds of a custom range, in order', () => {
    const result = rangeFor('custom', 'created_at', { start: '2026-07-01', end: '2026-07-31' });
    if (!result.ok) { throw new Error('expected ok'); }
    expect(result.range.params).toEqual(['2026-07-01', '2026-07-31']);
    expect(result.range.condition.match(/\?/g)).toHaveLength(2);
  });

  it('refuses a custom range missing a bound rather than binding undefined', () => {
    // `better-sqlite3` throws at bind time on `undefined`, which surfaces as
    // an unhandled error rather than a message the screen can show.
    expect(rangeFor('custom', 'created_at', { start: '2026-07-01' })).toEqual({
      ok: false,
      error: 'report/custom-range-needs-both-dates',
    });
    expect(rangeFor('custom', 'created_at', {})).toEqual({
      ok: false,
      error: 'report/custom-range-needs-both-dates',
    });
  });

  it('refuses a custom range that ends before it starts', () => {
    expect(rangeFor('custom', 'created_at', { start: '2026-07-31', end: '2026-07-01' })).toEqual({
      ok: false,
      error: 'report/end-before-start',
    });
  });

  it('accepts a single-day custom range', () => {
    const result = rangeFor('custom', 'created_at', { start: '2026-07-01', end: '2026-07-01' });
    expect(result.ok).toBe(true);
  });

  it('falls back to today for an unknown filter, never to all history', () => {
    const result = rangeFor('last-decade', 'created_at');
    if (!result.ok) { throw new Error('expected ok'); }
    // Covering everything would read as one catastrophic trading day.
    expect(result.range.condition).toBe("date(created_at, 'localtime') = date('now', 'localtime')");
  });

  it('writes the column it was given, so two reports can share a period', () => {
    const bills = rangeFor('weekly', 'created_at');
    const redemptions = rangeFor('weekly', 'redeemed_at');
    if (!bills.ok || !redemptions.ok) { throw new Error('expected ok'); }
    expect(bills.range.condition).toContain('created_at');
    expect(redemptions.range.condition).toContain('redeemed_at');
    // Same period, different column: the only difference is the column name.
    expect(redemptions.range.condition.replace(/redeemed_at/g, 'created_at'))
      .toBe(bills.range.condition);
  });
});
