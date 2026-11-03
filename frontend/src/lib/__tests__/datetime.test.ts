import { describe, expect, it, vi } from 'vitest';
import { elapsedSince, parseDbDate, splitElapsed, todayLocal } from '../datetime';

describe('parseDbDate', () => {
  it('reads SQLite’s zone-less timestamp as UTC, not local time', () => {
    // This is the bug the helper exists for: `new Date('2026-03-01 10:00:00')`
    // is parsed as *local* time, so a ticket raised a minute ago read as
    // hours old in Riyadh and negative west of UTC.
    expect(parseDbDate('2026-03-01 10:00:00')?.toISOString())
      .toBe('2026-03-01T10:00:00.000Z');
  });

  it('accepts the same instant with a T separator', () => {
    expect(parseDbDate('2026-03-01T10:00:00')?.toISOString())
      .toBe('2026-03-01T10:00:00.000Z');
  });

  it('respects an explicit Z', () => {
    expect(parseDbDate('2026-03-01T10:00:00Z')?.toISOString())
      .toBe('2026-03-01T10:00:00.000Z');
  });

  it('respects an explicit offset rather than forcing UTC', () => {
    expect(parseDbDate('2026-03-01T13:00:00+03:00')?.toISOString())
      .toBe('2026-03-01T10:00:00.000Z');
  });

  it('returns null for empty or unparseable input', () => {
    expect(parseDbDate(null)).toBeNull();
    expect(parseDbDate(undefined)).toBeNull();
    expect(parseDbDate('')).toBeNull();
    expect(parseDbDate('not a date')).toBeNull();
  });
});

describe('elapsedSince', () => {
  it('measures from the stored instant', () => {
    const now = Date.parse('2026-03-01T10:05:00Z');
    expect(elapsedSince('2026-03-01 10:00:00', now)).toBe(5 * 60_000);
  });

  it('clamps a future timestamp to zero instead of returning negative time', () => {
    const now = Date.parse('2026-03-01T10:00:00Z');
    expect(elapsedSince('2026-03-01 10:05:00', now)).toBe(0);
  });

  it('returns zero for an unparseable timestamp', () => {
    expect(elapsedSince('nope')).toBe(0);
  });
});

describe('splitElapsed', () => {
  it('splits into hours, minutes and seconds', () => {
    const now = Date.parse('2026-03-01T12:34:56Z');
    expect(splitElapsed('2026-03-01 10:00:00', now)).toEqual({
      hours: 2,
      minutes: 34,
      seconds: 56,
      totalMinutes: 154,
    });
  });

  it('reports zero across the board for a future timestamp', () => {
    const now = Date.parse('2026-03-01T10:00:00Z');
    expect(splitElapsed('2026-03-01 11:00:00', now)).toEqual({
      hours: 0, minutes: 0, seconds: 0, totalMinutes: 0,
    });
  });
});

describe('todayLocal', () => {
  it('returns the local calendar date, not the UTC one', () => {
    vi.useFakeTimers();
    // 2026-03-01 23:30 in a UTC+3 zone is still 2026-03-01 locally, but
    // 2026-03-01T20:30Z — `toISOString().split('T')[0]` happens to agree here,
    // so pick an instant where they differ instead.
    vi.setSystemTime(new Date(2026, 2, 1, 23, 30, 0));
    expect(todayLocal()).toBe('2026-03-01');
    vi.useRealTimers();
  });

  it('zero-pads month and day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 5, 12, 0, 0));
    expect(todayLocal()).toBe('2026-01-05');
    vi.useRealTimers();
  });
});
