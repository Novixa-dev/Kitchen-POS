import { describe, expect, it } from 'vitest';
import { HOME_CANDIDATES, homeRouteFor } from './homeRoute';
import { REFUSAL_MESSAGES, describeRefusal, withRefusalMessages } from './refusal';
import { REFUSAL_CODES, isRefusal, type PermissionId } from './context';

const granted = (...ids: PermissionId[]) => new Set<PermissionId>(ids);

describe('homeRouteFor', () => {
  it('prefers the dashboard when the person can read it', () => {
    expect(homeRouteFor(granted('reports.view', 'orders.take'))).toBe('/dashboard');
  });

  it('sends a kitchen hand to the kitchen display, not the dashboard', () => {
    // The bug this exists to prevent: `/dashboard` needs `reports.view`, so
    // landing there and being redirected off it strands the user.
    expect(homeRouteFor(granted('kitchen.view', 'menu.view', 'settings.view')))
      .toBe('/kds');
  });

  it('sends a waiter to the floor plan', () => {
    expect(homeRouteFor(granted('orders.take', 'menu.view', 'settings.view')))
      .toBe('/tables');
  });

  it('falls back to Settings, which every shipped role can open', () => {
    expect(homeRouteFor(granted('settings.view'))).toBe('/settings');
  });

  it('still returns somewhere for a role stripped of everything', () => {
    // An admin can untick anything. A blank screen with no way forward is
    // worse than a screen that says little.
    expect(homeRouteFor(granted())).toBe('/settings');
  });

  it('never returns a path twice in the candidate list', () => {
    const paths = HOME_CANDIDATES.map(c => c.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('returns a path that the matching permission actually guards', () => {
    // Each candidate must be reachable with the permission it is listed
    // under, or the redirect sends the user somewhere they bounce off.
    for (const candidate of HOME_CANDIDATES) {
      expect(homeRouteFor(granted(candidate.permission)), candidate.path)
        .toBe(candidate.path);
    }
  });
});

describe('isRefusal', () => {
  it('recognises each refusal code', () => {
    for (const code of Object.values(REFUSAL_CODES)) {
      expect(isRefusal(code), code).toBe(true);
    }
  });

  it('rejects an ordinary error message', () => {
    expect(isRefusal('Invalid PIN')).toBe(false);
    expect(isRefusal(undefined)).toBe(false);
    expect(isRefusal(null)).toBe(false);
  });
});

describe('describeRefusal', () => {
  it('replaces a refusal code with a sentence and keeps the code', () => {
    const result = describeRefusal({ success: false, error: 'auth/forbidden' }) as {
      success: boolean;
      error: string;
      refused: string;
    };

    expect(result.success).toBe(false);
    expect(result.refused).toBe('auth/forbidden');
    // A sentence, not the code — which is the whole point.
    expect(result.error).not.toBe('auth/forbidden');
    expect(result.error.length).toBeGreaterThan(5);
  });

  it('covers every code the guard can return', () => {
    for (const code of Object.values(REFUSAL_CODES)) {
      expect(REFUSAL_MESSAGES[code], code).toBeDefined();
    }
  });

  it('leaves an ordinary error untouched', () => {
    const original = { success: false, error: 'Invalid PIN' };
    expect(describeRefusal(original)).toBe(original);
  });

  it('leaves a successful answer untouched', () => {
    const original = { success: true, data: { id: 1 } };
    expect(describeRefusal(original)).toBe(original);
  });

  it('leaves anything that is not an envelope untouched', () => {
    expect(describeRefusal(null)).toBeNull();
    expect(describeRefusal(7)).toBe(7);
    expect(describeRefusal('auth/forbidden')).toBe('auth/forbidden');
  });
});

describe('withRefusalMessages', () => {
  it('maps a refusal returned by a nested method', async () => {
    const surface = {
      orders: {
        create: () => Promise.resolve({ success: false, error: 'auth/forbidden' }),
      },
    };

    const wrapped = withRefusalMessages(surface);
    const result = await wrapped.orders.create() as { refused?: string; error: string };
    expect(result.refused).toBe('auth/forbidden');
    expect(result.error).not.toBe('auth/forbidden');
  });

  it('passes arguments through unchanged', async () => {
    const surface = {
      orders: { create: (payload: unknown) => Promise.resolve({ success: true, data: payload }) },
    };

    const wrapped = withRefusalMessages(surface);
    const result = await wrapped.orders.create({ tableId: 4 }) as { data: unknown };
    expect(result.data).toEqual({ tableId: 4 });
  });

  it('leaves a method that returns no promise alone', () => {
    // The event subscriptions: there is nothing to await, so wrapping their
    // result would turn a subscription into a promise — and an unsubscribe
    // function into one, which the caller would then fail to call.
    let received: unknown = null;
    const unsubscribe = () => { /* noop */ };
    const surface = {
      onEvent: (handler: (value: unknown) => void) => {
        received = handler;
        return unsubscribe;
      },
    };

    const wrapped = withRefusalMessages(surface);
    const handler = () => { /* noop */ };
    expect(wrapped.onEvent(handler)).toBe(unsubscribe);
    expect(received).toBe(handler);
  });

  it('keeps non-function values as they are', () => {
    const surface = { version: '1.0.0', nested: { flag: true } };
    const wrapped = withRefusalMessages(surface);
    expect(wrapped.version).toBe('1.0.0');
    expect(wrapped.nested.flag).toBe(true);
  });

  it('does not reject when the underlying call rejects', async () => {
    // The wrapper must not swallow or convert a genuine failure.
    const surface = { thing: { fail: () => Promise.reject(new Error('boom')) } };
    const wrapped = withRefusalMessages(surface);
    await expect(wrapped.thing.fail()).rejects.toThrow('boom');
  });
});
