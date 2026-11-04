/**
 * One definition of each reporting period.
 *
 * `reports:daily` built its date condition inline. Adding a second report
 * that covers "the same week" meant either duplicating that SQL or deriving
 * the dates in the renderer — and both drift. A sales figure and an offer
 * cost that disagree about which week they describe are worse than either
 * being absent.
 *
 * Every condition uses `'localtime'`, because SQLite stores zone-less UTC
 * and the owner means their own calendar when they say "today".
 */

export type ReportFilter = 'daily' | 'today' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export interface RangeCondition {
  /** A SQL fragment with `{col}` already substituted. */
  condition: string;
  /** Values to bind, in order. */
  params: string[];
  /** `strftime` format for grouping the trend, where a caller needs one. */
  group: string;
}

export type RangeResult =
  | { ok: true; range: RangeCondition }
  | { ok: false; error: string };

/**
 * Build the date condition for a period.
 *
 * `column` is interpolated into the SQL, so it must be a column name this
 * module chose — never a value from a payload. Callers pass a literal.
 */
export function rangeFor(
  filter: string,
  column: 'created_at' | 'redeemed_at',
  bounds: { start?: string; end?: string } = {},
): RangeResult {
  switch (filter) {
    case 'daily':
    case 'today':
      return {
        ok: true,
        range: {
          condition: `date(${column}, 'localtime') = date('now', 'localtime')`,
          params: [],
          group: '%H',
        },
      };

    case 'weekly':
      // Seven days inclusive of today, which is what "this week" means to
      // someone reading it on a Wednesday — not the calendar week.
      return {
        ok: true,
        range: {
          condition: `date(${column}, 'localtime') >= date('now', '-6 days', 'localtime')`,
          params: [],
          group: '%Y-%m-%d',
        },
      };

    case 'monthly':
      return {
        ok: true,
        range: {
          condition: `strftime('%Y-%m', ${column}, 'localtime') = strftime('%Y-%m', 'now', 'localtime')`,
          params: [],
          group: '%Y-%m-%d',
        },
      };

    case 'yearly':
      return {
        ok: true,
        range: {
          condition: `strftime('%Y', ${column}, 'localtime') = strftime('%Y', 'now', 'localtime')`,
          params: [],
          group: '%Y-%m',
        },
      };

    case 'custom': {
      // A custom range is meaningless without both bounds, and binding
      // `undefined` makes better-sqlite3 throw at bind time rather than
      // returning an empty result the caller could handle.
      if (!bounds.start || !bounds.end) {
        return { ok: false, error: 'report/custom-range-needs-both-dates' };
      }
      if (bounds.end < bounds.start) {
        return { ok: false, error: 'report/end-before-start' };
      }
      return {
        ok: true,
        range: {
          condition:
            `date(${column}, 'localtime') >= date(?) AND date(${column}, 'localtime') <= date(?)`,
          params: [bounds.start, bounds.end],
          group: '%Y-%m-%d',
        },
      };
    }

    default:
      // An unrecognised filter falls back to today rather than to everything:
      // a report that silently covers all history reads as a catastrophic
      // trading day, which is how the old `yearly` bug looked in reverse.
      return {
        ok: true,
        range: {
          condition: `date(${column}, 'localtime') = date('now', 'localtime')`,
          params: [],
          group: '%H',
        },
      };
  }
}
