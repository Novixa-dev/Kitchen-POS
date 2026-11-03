/**
 * Money arithmetic.
 *
 * All amounts are stored as REAL in SQLite, so every intermediate result has
 * to be rounded deliberately rather than left to accumulate binary float
 * error across a 40-line bill.
 */

/**
 * Round to a currency's minor unit, half away from zero.
 *
 * `Math.round(value * 100) / 100` is wrong for money: 8.075 is stored as
 * 8.074999999999999289, so it rounds *down* to 8.07 while a cashier and an
 * auditor both expect 8.08. Nudging by `Number.EPSILON` only fixes the
 * smallest values — the representation error at 8.075 is far larger than
 * epsilon.
 *
 * Shifting the decimal point through the number's own decimal string instead
 * ("8.075" -> "8.075e2" -> 807.5) sidesteps the multiply entirely, so the
 * midpoint is exact and rounds predictably.
 */
export function round(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) { return 0; }
  if (value === 0) { return 0; }

  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);

  // `toString()` yields exponential notation outside roughly 1e-7..1e21, which
  // would break the `e`-suffix trick. Both ends are far outside any real money
  // amount, and at those magnitudes the answer is unambiguous: below the minor
  // unit it rounds to zero, and above 2^53 the value is already integral.
  const text = abs.toString();
  if (text.includes('e') || text.includes('E')) {
    return abs < 1 ? 0 : value;
  }

  const shifted = Number(`${text}e${decimals}`);
  const rounded = Math.round(shifted);
  return sign * Number(`${rounded}e${-decimals}`);
}

/** Sum a list of amounts, rounding once at the end. */
export function sum(values: number[], decimals = 2): number {
  return round(values.reduce((acc, v) => acc + (Number.isFinite(v) ? v : 0), 0), decimals);
}

/** Clamp a value into a range; used to keep user input sane. */
export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) { return min; }
  return Math.min(Math.max(value, min), max);
}
