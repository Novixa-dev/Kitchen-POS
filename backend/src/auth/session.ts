/**
 * Who is signed in, as the main process understands it.
 *
 * This is the point of the whole permissions change. The renderer already
 * knew the signed-in staff member, but it kept that in a Zustand store
 * persisted to `localStorage` — which the user can edit. A check that reads
 * it is decoration: change one JSON field to `"role":"admin"` and every
 * screen unlocks.
 *
 * So the authority is here. `staff:login` verifies the PIN against the
 * database and records the result in this module; every guarded channel is
 * answered from it. The renderer's copy is for deciding what to *show*,
 * which is a presentation concern and may be wrong without consequence.
 *
 * One session at a time, because the app is one window on one till. A
 * restart clears it, which is why the renderer no longer restores a signed-in
 * session from disk: there would be no PIN to re-verify, so restoring would
 * be exactly the bypass this replaces.
 */

import { isStaffRole, type StaffRole } from './permissions';

export interface Session {
  staffId: number;
  name: string;
  role: StaffRole;
  /** When the PIN was verified. */
  since: number;
}

let currentSession: Session | null = null;

export function getSession(): Session | null {
  return currentSession;
}

/**
 * Record a verified sign-in.
 *
 * Returns null — and records nothing — when the row does not describe a
 * usable session. A staff row with a role this build does not know would
 * otherwise produce a session whose permissions resolve to nothing, which
 * presents as "every screen is broken" rather than "your role is wrong".
 */
export function startSession(row: {
  id?: unknown;
  name?: unknown;
  role?: unknown;
}): Session | null {
  if (typeof row.id !== 'number' || !Number.isInteger(row.id)) { return null; }
  if (!isStaffRole(row.role)) { return null; }

  currentSession = {
    staffId: row.id,
    name: typeof row.name === 'string' ? row.name : '',
    role: row.role,
    since: Date.now(),
  };

  return currentSession;
}

export function endSession(): void {
  currentSession = null;
}
