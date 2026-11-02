import { describe, expect, it } from 'vitest';
import { clamp, round, sum } from '../money';

describe('round', () => {
  it('rounds to two decimals by default', () => {
    expect(round(1.234)).toBe(1.23);
    expect(round(1.235)).toBe(1.24);
    expect(round(1.236)).toBe(1.24);
  });

  it('rounds a value stored just below the midpoint up, as a cashier expects', () => {
    // These are the classic float-money traps: 1.005 is stored as
    // 1.00499999999999989 and 8.075 as 8.074999999999999289, so
    // `Math.round(v * 100) / 100` rounds both down.
    expect(round(1.005)).toBe(1.01);
    expect(round(8.075)).toBe(8.08);
    expect(round(1.015)).toBe(1.02);
    expect(round(16.555)).toBe(16.56);
  });

  it('rounds half away from zero for negative amounts too', () => {
    // A refund line must mirror the charge it reverses.
    expect(round(-1.005)).toBe(-1.01);
    expect(round(-8.075)).toBe(-8.08);
  });

  it('handles magnitudes outside normal decimal notation', () => {
    // Below the minor unit the 2dp answer is zero; above 2^53 the value is
    // already integral, so it passes through rather than losing precision.
    expect(round(1e-9)).toBe(0);
    expect(round(-1e-9)).toBe(0);
    expect(round(1e21)).toBe(1e21);
    expect(round(-1e21)).toBe(-1e21);
  });

  it('rounds large but realistic amounts correctly', () => {
    expect(round(1_234_567.891)).toBe(1_234_567.89);
    expect(round(999_999.995)).toBe(1_000_000);
  });

  it('honours an explicit precision', () => {
    expect(round(1.23456, 3)).toBe(1.235);
    expect(round(1234.56, 0)).toBe(1235);
  });

  it('leaves exact values alone', () => {
    expect(round(10)).toBe(10);
    expect(round(0)).toBe(0);
  });

  it('handles negative amounts', () => {
    expect(round(-1.234)).toBe(-1.23);
  });

  it('returns zero for non-finite input rather than propagating NaN', () => {
    expect(round(Number.NaN)).toBe(0);
    expect(round(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('sum', () => {
  it('adds a list of amounts', () => {
    expect(sum([1, 2, 3])).toBe(6);
  });

  it('absorbs binary float drift across many lines', () => {
    expect(sum(Array.from({ length: 10 }, () => 0.1))).toBe(1);
  });

  it('returns zero for an empty list', () => {
    expect(sum([])).toBe(0);
  });

  it('skips non-finite entries instead of poisoning the total', () => {
    expect(sum([1, Number.NaN, 2])).toBe(3);
  });
});

describe('clamp', () => {
  it('passes a value inside the range through', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('clamps to the bounds', () => {
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });

  it('returns the minimum for non-finite input', () => {
    expect(clamp(Number.NaN, 2, 10)).toBe(2);
  });
});
