import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  CHANNEL_PERMISSIONS,
  OPEN_CHANNELS,
  REFUSAL_CODES,
  RENDERER_ONLY_PERMISSIONS,
  decide,
  installPermissionGuard,
} from '../guard';
import {
  PERMISSIONS,
  isPermissionId,
  setRolePermission,
  type PermissionId,
} from '../permissions';
import { endSession, getSession, startSession } from '../session';

const as = (role: string) => ({ role: role as 'admin' });

afterEach(() => { endSession(); });

describe('the table itself', () => {
  it('names only permissions that exist', () => {
    for (const [channel, permission] of Object.entries(CHANNEL_PERMISSIONS)) {
      expect(isPermissionId(permission), `${channel} -> ${permission}`).toBe(true);
    }
  });

  it('never lists a channel as both guarded and open', () => {
    for (const channel of Object.keys(CHANNEL_PERMISSIONS)) {
      expect(channel in OPEN_CHANNELS, channel).toBe(false);
    }
  });

  it('gives every open channel a stated reason', () => {
    // Being open is a decision. An empty reason means nobody made one.
    for (const [channel, reason] of Object.entries(OPEN_CHANNELS)) {
      expect(reason.length, channel).toBeGreaterThan(10);
    }
  });

  it('covers every channel the renderer can actually invoke', () => {
    // The check that makes enforcement complete rather than sprinkled:
    // `preload.ts` is the full list of what the renderer can reach, so a
    // channel added without a permission decision fails here instead of
    // shipping unguarded.
    const preload = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'preload.ts'),
      'utf8',
    );

    const channels = [...preload.matchAll(/invoke\('([^']+)'/g)].map(m => m[1]);
    expect(channels.length).toBeGreaterThan(50);

    const unclassified = [...new Set(channels)].filter(
      channel => !(channel in CHANNEL_PERMISSIONS) && !(channel in OPEN_CHANNELS),
    );
    expect(unclassified).toEqual([]);
  });
});

describe('decide', () => {
  it('allows an open channel with no session', () => {
    expect(decide('staff:login', null)).toEqual({ allowed: true });
    expect(decide('system:isSetupComplete', null)).toEqual({ allowed: true });
  });

  it('refuses a guarded channel with no session', () => {
    // Before this existed the renderer alone decided, and it kept the
    // signed-in role in `localStorage`.
    expect(decide('reports:daily', null)).toEqual({
      allowed: false,
      reason: 'no-session',
      permission: 'reports.view',
    });
  });

  it('allows what the role holds and refuses what it does not', () => {
    expect(decide('orders:create', as('waiter'))).toEqual({ allowed: true });
    expect(decide('reports:daily', as('waiter'))).toEqual({
      allowed: false,
      reason: 'forbidden',
      permission: 'reports.view',
    });
  });

  it('lets admin through everywhere', () => {
    for (const channel of Object.keys(CHANNEL_PERMISSIONS)) {
      expect(decide(channel, as('admin')), channel).toEqual({ allowed: true });
    }
  });

  it('refuses a channel named after an Object prototype member', () => {
    // `channel in OPEN_CHANNELS` would walk the prototype chain and report
    // `toString` as open; indexing the guarded table for `constructor` would
    // hand back a function in place of a permission. Neither name is
    // reachable today, but a lookup that is wrong for an adversarial one is
    // the wrong shape for a security check.
    for (const channel of ['toString', 'constructor', 'valueOf', '__proto__', 'hasOwnProperty']) {
      expect(decide(channel, as('admin')), channel).toEqual({
        allowed: false,
        reason: 'unknown-channel',
      });
    }
  });

  it('refuses a channel nobody classified, rather than letting it through', () => {
    // Fail closed: an unclassified channel is far more likely to be newly
    // added than deliberately public.
    expect(decide('secrets:exfiltrate', as('admin'))).toEqual({
      allowed: false,
      reason: 'unknown-channel',
    });
  });

  it('honours an override', () => {
    const overrides = setRolePermission({}, 'waiter', 'orders.cancel', true);
    expect(decide('orders:cancelOrder', as('waiter'), overrides)).toEqual({ allowed: true });
    expect(decide('orders:cancelOrder', as('waiter'))).toMatchObject({ allowed: false });
  });

  it('will not honour an override that escalates', () => {
    const overrides = { manager: ['staff.manage'] } as Parameters<typeof decide>[2];
    expect(decide('staff:upsert', as('manager'), overrides)).toMatchObject({
      allowed: false,
      reason: 'forbidden',
    });
  });

  it('keeps the kitchen display open to the kitchen and the till closed to it', () => {
    expect(decide('kds:updateItemStatus', as('kitchen'))).toEqual({ allowed: true });
    expect(decide('billing:createBill', as('kitchen'))).toMatchObject({ allowed: false });
  });

  it('separates reading a past bill from reprinting one', () => {
    // A reprint of a settled bill is a fraud vector.
    const overrides = setRolePermission({}, 'cashier', 'reports.reprint', false);
    expect(decide('reports:getPastOrders', as('cashier'), overrides)).toEqual({ allowed: true });
    expect(decide('reports:printPastBill', as('cashier'), overrides))
      .toMatchObject({ allowed: false });
  });
});

describe('session', () => {
  it('records a verified sign-in', () => {
    const session = startSession({ id: 3, name: 'Noura', role: 'manager' });
    expect(session?.role).toBe('manager');
    expect(getSession()?.staffId).toBe(3);
  });

  it('refuses a row with a role this build does not know', () => {
    // A session whose permissions resolve to nothing presents as "every
    // screen is broken" rather than "your role is wrong".
    expect(startSession({ id: 3, name: 'Noura', role: 'sommelier' })).toBeNull();
    expect(getSession()).toBeNull();
  });

  it('refuses a row with no usable id', () => {
    expect(startSession({ id: '3', name: 'Noura', role: 'admin' })).toBeNull();
    expect(startSession({ name: 'Noura', role: 'admin' })).toBeNull();
    expect(getSession()).toBeNull();
  });

  it('clears on sign-out', () => {
    startSession({ id: 1, name: 'Admin', role: 'admin' });
    endSession();
    expect(getSession()).toBeNull();
  });
});

describe('installPermissionGuard', () => {
  interface Registered { channel: string; handler: (event: unknown, ...args: unknown[]) => unknown }

  function fakeIpc() {
    const registered: Registered[] = [];
    const ipc = {
      handle(channel: string, handler: (event: unknown, ...args: unknown[]) => unknown) {
        registered.push({ channel, handler });
      },
    };
    const call = (channel: string, ...args: unknown[]) =>
      registered.find(r => r.channel === channel)?.handler({}, ...args);
    return { ipc, call };
  }

  it('lets an allowed call reach the handler, arguments intact', () => {
    const { ipc, call } = fakeIpc();
    const restore = installPermissionGuard(ipc, () => ({}));
    ipc.handle('orders:create', (_event, payload) => ({ success: true, data: payload }));
    startSession({ id: 1, name: 'W', role: 'waiter' });

    expect(call('orders:create', { tableId: 4 })).toEqual({
      success: true,
      data: { tableId: 4 },
    });
    restore();
  });

  it('refuses before the handler runs, so nothing is written', () => {
    const { ipc, call } = fakeIpc();
    const restore = installPermissionGuard(ipc, () => ({}));

    let ran = false;
    ipc.handle('staff:delete', () => { ran = true; return { success: true }; });
    startSession({ id: 1, name: 'W', role: 'waiter' });

    expect(call('staff:delete', { id: 2 })).toEqual({
      success: false,
      error: REFUSAL_CODES.forbidden,
      permission: 'staff.manage',
    });
    expect(ran).toBe(false);
    restore();
  });

  it('refuses in the envelope every handler uses, not by rejecting', () => {
    // A rejected invoke surfaces in the renderer as an unhandled error; the
    // success/error envelope travels the path the UI already handles.
    const { ipc, call } = fakeIpc();
    const restore = installPermissionGuard(ipc, () => ({}));
    ipc.handle('reports:daily', () => ({ success: true }));

    const result = call('reports:daily') as { success: boolean; error: string };
    expect(result.success).toBe(false);
    expect(result.error).toBe(REFUSAL_CODES['no-session']);
    restore();
  });

  it('reads the overrides at call time, not at registration', () => {
    // An admin editing the matrix must take effect on the next call, without
    // a restart.
    const { ipc, call } = fakeIpc();
    let overrides = {};
    const restore = installPermissionGuard(ipc, () => overrides);
    ipc.handle('orders:cancelOrder', () => ({ success: true }));
    startSession({ id: 1, name: 'W', role: 'waiter' });

    expect(call('orders:cancelOrder')).toMatchObject({ success: false });
    overrides = setRolePermission({}, 'waiter', 'orders.cancel', true);
    expect(call('orders:cancelOrder')).toEqual({ success: true });
    restore();
  });

  it('guards every channel registered after it is installed', () => {
    const { ipc, call } = fakeIpc();
    const restore = installPermissionGuard(ipc, () => ({}));

    const guarded = Object.keys(CHANNEL_PERMISSIONS);
    for (const channel of guarded) {
      ipc.handle(channel, () => ({ success: true, reached: true }));
    }

    // No session: every guarded channel must refuse.
    for (const channel of guarded) {
      expect(call(channel), channel).toMatchObject({ success: false });
    }
    restore();
  });

  it('restores the original handle, leaving no wrapper behind', () => {
    const { ipc } = fakeIpc();
    const before = ipc.handle;
    const restore = installPermissionGuard(ipc, () => ({}));
    expect(ipc.handle).not.toBe(before);
    restore();
    expect(ipc.handle).toBe(before);
  });

  it('passes an open channel through with no session', () => {
    const { ipc, call } = fakeIpc();
    const restore = installPermissionGuard(ipc, () => ({}));
    ipc.handle('staff:login', () => ({ success: true, data: { id: 1 } }));
    expect(call('staff:login')).toEqual({ success: true, data: { id: 1 } });
    restore();
  });
});

describe('coverage of the admin-only permissions', () => {
  it('guards at least one channel with each admin-only permission', () => {
    // A permission that gates nothing is a tick box with no effect.
    const guarded = new Set(Object.values(CHANNEL_PERMISSIONS));
    for (const id of [
      'staff.manage', 'settings.permissions', 'settings.features',
      'system.reset', 'system.recovery', 'backup.restore',
    ] as PermissionId[]) {
      expect(guarded.has(id), id).toBe(true);
    }
  });

  it('gives every permission in the catalogue something to gate', () => {
    // A permission that gates neither a channel nor a screen is a tick box
    // with no effect — it would read as working while changing nothing.
    const guarded = new Set<string>(Object.values(CHANNEL_PERMISSIONS));

    const inert = PERMISSIONS
      .map(p => p.id)
      .filter(id => !guarded.has(id) && !(id in RENDERER_ONLY_PERMISSIONS));

    expect(inert).toEqual([]);
  });

  it('gives every renderer-only permission a stated reason', () => {
    for (const [id, reason] of Object.entries(RENDERER_ONLY_PERMISSIONS)) {
      expect(isPermissionId(id), id).toBe(true);
      expect(reason.length, id).toBeGreaterThan(10);
    }
  });
});
