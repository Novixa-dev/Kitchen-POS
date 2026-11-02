/**
 * Reading timestamps that came out of SQLite.
 *
 * `CURRENT_TIMESTAMP` is written as `YYYY-MM-DD HH:MM:SS` — UTC, but with no
 * zone marker and a space instead of `T`. `new Date(thatString)` is therefore
 * parsed as *local* time, which shifts every duration by the machine's offset:
 * a ticket raised a minute ago reads as three hours old in Riyadh, or as
 * negative time west of UTC.
 *
 * Several screens each had their own inline variant of this fix, and the KDS
 * wait timer had none at all. One helper now owns it.
 */

/** Parse a database timestamp as UTC. Returns null when unparseable. */
export function parseDbDate(value: string | null | undefined): Date | null {
  if (!value) { return null; }

  // Already a full ISO string with a zone (or an offset) — trust it.
  const normalised = value.includes('T') ? value : value.replace(' ', 'T');
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(normalised);
  const date = new Date(hasZone ? normalised : `${normalised}Z`);

  return Number.isNaN(date.getTime()) ? null : date;
}

/** Milliseconds elapsed since a database timestamp, clamped at zero. */
export function elapsedSince(value: string | null | undefined, now = Date.now()): number {
  const date = parseDbDate(value);
  if (!date) { return 0; }
  return Math.max(0, now - date.getTime());
}

export interface Elapsed {
  hours: number;
  minutes: number;
  seconds: number;
  /** Total minutes, for severity thresholds. */
  totalMinutes: number;
}

/** Split the time since a database timestamp into display components. */
export function splitElapsed(value: string | null | undefined, now = Date.now()): Elapsed {
  const totalSeconds = Math.floor(elapsedSince(value, now) / 1000);
  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    totalMinutes: Math.floor(totalSeconds / 60),
  };
}
