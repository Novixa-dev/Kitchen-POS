/**
 * Shared error helpers for the Electron main process.
 *
 * Every IPC handler returns `{ success, data?, error? }`, so unknown throws
 * must be narrowed to a human-readable string in exactly one place.
 */

/** Narrow an unknown throw value to a readable message. */
export function errMsg(e: unknown): string {
  if (e instanceof Error) { return e.message; }
  if (typeof e === 'string') { return e; }
  return 'Unexpected error';
}

export interface IPCResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Wrap a synchronous handler body so throws become `{ success: false }`. */
export function ok<T>(data: T): IPCResult<T> {
  return { success: true, data };
}

export function fail(e: unknown): IPCResult<never> {
  return { success: false, error: errMsg(e) };
}
