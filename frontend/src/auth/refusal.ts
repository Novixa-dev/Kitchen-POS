/**
 * Turning a guard refusal into a sentence, once, at the IPC boundary.
 *
 * The main process answers a refused channel with a reason code rather than
 * a message, because it has no business choosing the language. Translating
 * here means every existing call site that shows `res.error` shows a proper
 * sentence in the active language — rather than `auth/forbidden` — without
 * all eighty-seven of them having to know the guard exists.
 *
 * The original code is kept on `refused`, so a caller that wants to behave
 * differently (signing the user out on `no-session`, say) still can.
 */

import { tStandalone } from '../i18n/standalone';
import type { TranslationKey } from '../i18n/types';

export const REFUSAL_MESSAGES: Record<string, TranslationKey> = {
  'auth/no-session': 'auth.noSession',
  'auth/forbidden': 'auth.forbidden',
  'auth/unknown-channel': 'auth.unknownChannel',
};

export function describeRefusal(result: unknown): unknown {
  if (result === null || typeof result !== 'object') { return result; }

  const envelope = result as { success?: unknown; error?: unknown };
  if (envelope.success !== false || typeof envelope.error !== 'string') { return result; }

  const key = REFUSAL_MESSAGES[envelope.error];
  if (key === undefined) { return result; }

  return { ...envelope, error: tStandalone(key), refused: envelope.error };
}

function isThenable(value: unknown): value is Promise<unknown> {
  return value !== null
    && typeof value === 'object'
    && typeof (value as { then?: unknown }).then === 'function';
}

/**
 * Wrap every method on the IPC surface so its answer passes through
 * `describeRefusal`.
 *
 * Recurses into the groups (`api.orders.create`) and leaves the top-level
 * event subscriptions alone: they return nothing to await, so there is
 * nothing to map.
 */
export function withRefusalMessages<T extends object>(surface: T): T {
  const wrapMethod = (method: (...args: unknown[]) => unknown) =>
    (...args: unknown[]) => {
      const result = method(...args);
      return isThenable(result) ? result.then(describeRefusal) : result;
    };

  const wrapValue = (value: unknown): unknown => {
    if (typeof value === 'function') {
      return wrapMethod(value as (...args: unknown[]) => unknown);
    }
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .map(([key, inner]) => [key, wrapValue(inner)]),
      );
    }
    return value;
  };

  return wrapValue(surface) as T;
}
