/**
 * Permission enforcement at the IPC boundary.
 *
 * Electron gives `ipcMain` no middleware, so a permission check has to go
 * either into every handler or around the one function that registers them.
 * Scattering it across twenty files guarantees the channel added next week
 * is the one nobody guards, so it goes here: one table naming the permission
 * each channel needs, and one wrapper that consults it.
 *
 * Every channel must appear in this file — either with a permission or in
 * `OPEN_CHANNELS` with a reason. A test reads `preload.ts`, collects every
 * channel the renderer can actually invoke, and fails if one is in neither
 * list, so adding a channel forces a decision about who may call it.
 */

import { can, type PermissionId } from './permissions';
import { getSession } from './session';

/** What each channel requires. */
export const CHANNEL_PERMISSIONS: Readonly<Record<string, PermissionId>> = {
  // ── Taking orders ─────────────────────────────────────────────────────
  'orders:create': 'orders.take',
  'orders:getOpen': 'orders.take',
  'orders:getByTable': 'orders.take',
  'orders:sendKOT': 'orders.take',
  'orders:updateCustomer': 'orders.take',
  'orders:cancelOrder': 'orders.cancel',

  'tables:getAll': 'orders.take',
  'tables:upsert': 'tables.manage',
  'tables:delete': 'tables.manage',
  'tables:updateCustomName': 'tables.manage',

  // ── Billing ───────────────────────────────────────────────────────────
  'billing:preview': 'billing.take',
  'billing:createBill': 'billing.take',
  'billing:getBill': 'billing.take',
  'print:bill': 'billing.take',
  'print:previewBill': 'billing.take',
  'print:kot': 'orders.take',
  'print:previewKot': 'orders.take',
  'print:listPrinters': 'printers.manage',
  'print:test': 'printers.manage',

  // ── Kitchen ───────────────────────────────────────────────────────────
  'kds:getActiveTickets': 'kitchen.view',
  'kds:updateItemStatus': 'kitchen.update',
  'kds:updateOrderStatus': 'kitchen.update',

  // ── Menu ──────────────────────────────────────────────────────────────
  'menu:getAll': 'menu.view',
  'menu:getMenus': 'menu.view',
  'menu:getRecipe': 'menu.view',
  'menu:upsertItem': 'menu.edit',
  'menu:deleteItem': 'menu.edit',
  'menu:upsertCategory': 'menu.edit',
  'menu:deleteCategory': 'menu.edit',
  'menu:upsertMenu': 'menu.edit',
  'menu:duplicateMenu': 'menu.edit',
  'menu:updateRecipe': 'menu.edit',
  'menu:uploadImage': 'menu.edit',
  // Marking a dish sold out is a service decision, not a menu edit — the
  // person on the floor who runs out of it has to be able to say so.
  'menu:toggleAvailable': 'menu.view',

  // ── Inventory ─────────────────────────────────────────────────────────
  'inventory:getAll': 'inventory.view',
  'inventory:adjust': 'inventory.adjust',
  'inventory:upsertItem': 'inventory.adjust',

  // ── Customers ─────────────────────────────────────────────────────────
  'customers:getAll': 'customers.view',
  'customers:getById': 'customers.view',
  'customers:getHistory': 'customers.view',
  'customers:search': 'customers.view',
  'customers:create': 'customers.edit',
  'customers:update': 'customers.edit',
  'customers:delete': 'customers.edit',
  // Writing off what a customer owes moves money, so it is its own
  // permission rather than part of editing their record.
  'customers:settleBalance': 'customers.settle',

  // ── Expenses ──────────────────────────────────────────────────────────
  'expenses:getAll': 'expenses.view',
  'expenses:create': 'expenses.record',
  'expenses:delete': 'expenses.record',

  // ── Reporting ─────────────────────────────────────────────────────────
  'reports:daily': 'reports.view',
  'reports:getPastOrders': 'reports.view',
  'dashboard:getMetrics': 'reports.view',
  'shifts:getTotals': 'reports.view',
  // A reprint of a settled bill is a fraud vector, so it is separate from
  // reading the report that lists it.
  'reports:printPastBill': 'reports.reprint',

  // ── Shifts and the trading day ────────────────────────────────────────
  'shifts:getActive': 'shifts.operate',
  'shifts:open': 'shifts.operate',
  'shifts:close': 'shifts.operate',
  'businessSession:getActive': 'shifts.operate',
  'businessSession:start': 'session.manage',
  'businessSession:close': 'session.manage',

  // ── Settings ──────────────────────────────────────────────────────────
  'settings:save': 'settings.edit',
  'settings:reset': 'settings.edit',
  'branding:set': 'settings.edit',
  'branding:applyPreset': 'settings.edit',
  'branding:pickLogo': 'settings.edit',
  'branding:clearLogo': 'settings.edit',
  'features:preview': 'settings.features',
  'features:setEnabled': 'settings.features',
  'features:reset': 'settings.features',
  'permissions:get': 'settings.permissions',
  'permissions:set': 'settings.permissions',
  'permissions:resetRole': 'settings.permissions',

  // ── Backups ───────────────────────────────────────────────────────────
  'backup:export': 'backup.run',
  'backup:triggerNow': 'backup.run',
  'backup:getAutoBackupConfig': 'backup.run',
  'backup:setAutoBackupConfig': 'backup.run',
  'backup:selectAutoBackupPath': 'backup.run',
  // Restoring replaces the whole database, including the staff table — so it
  // is a way to install an admin account.
  'backup:import': 'backup.restore',

  // ── Staff and the machine ─────────────────────────────────────────────
  'staff:getAll': 'staff.view',
  'staff:upsert': 'staff.manage',
  'staff:delete': 'staff.manage',
  'system:factoryReset': 'system.reset',
  'system:generateRecoveryCode': 'system.recovery',
};

/**
 * Channels that answer without a session, each for a stated reason.
 *
 * Being on this list is a decision, not an oversight — which is the point of
 * requiring every channel to appear in one list or the other.
 */
export const OPEN_CHANNELS: Readonly<Record<string, string>> = {
  // There is no session yet; this is what creates one.
  'staff:login': 'establishes the session',
  'staff:logout': 'ends the session',

  // First run, before any staff account exists.
  'system:isSetupComplete': 'the shell decides which screen to show',
  'system:completeSetup': 'creates the first admin, so no admin exists yet',

  // The recovery path exists precisely because nobody can sign in. Gating it
  // behind a permission would make a forgotten PIN unrecoverable. Both are
  // protected by the recovery code itself.
  'system:verifyRecoveryCode': 'used when locked out, guarded by the code',
  'system:resetAdminPin': 'used when locked out, guarded by the code',

  // Read by the shell before the login screen paints: the outlet's name and
  // logo, which modules exist, and the accent to draw in. All configuration,
  // no trading data.
  'settings:get': 'the login screen shows the outlet name and logo',
  'features:list': 'the shell builds its navigation before sign-in',
  'branding:list': 'the login screen is painted in the outlet accent',
  'branding:preview': 'pure calculation, stores nothing',

  // Tells the caller only what their own session may do — nothing they could
  // not establish by trying a channel and being refused.
  'permissions:mine': 'reports the caller own permissions, for deciding what to show',
};

/**
 * Permissions that gate a screen rather than a channel, each for a reason.
 *
 * `settings.view` is the clear case: the Settings screen reads `settings:get`,
 * which has to stay open because the login screen shows the outlet's name and
 * logo before anyone has signed in. So the permission governs whether the
 * screen is reachable, and the channel behind it is harmless to leave open.
 *
 * A permission that gates neither a channel nor a screen is a tick box with
 * no effect, which a test refuses.
 */
export const RENDERER_ONLY_PERMISSIONS: Readonly<Record<string, string>> = {
  'settings.view': 'gates the Settings screen; settings:get must stay open for the login screen',
};

/**
 * Own-property lookups.
 *
 * `channel in OPEN_CHANNELS` walks the prototype chain, so a channel named
 * `toString` or `constructor` would read as open, and indexing the guarded
 * table for one would hand back a function instead of a permission. Neither
 * is reachable today, but a lookup that is wrong for an adversarial name is
 * the wrong shape for a security check.
 *
 * `hasOwnProperty.call` rather than `Object.hasOwn`, which needs the ES2022
 * library this workspace does not target.
 */
const hasOwn = (target: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(target, key);

function requiredFor(channel: string): PermissionId | undefined {
  return hasOwn(CHANNEL_PERMISSIONS, channel) ? CHANNEL_PERMISSIONS[channel] : undefined;
}

function isOpen(channel: string): boolean {
  return hasOwn(OPEN_CHANNELS, channel);
}

export type Decision =
  | { allowed: true }
  | { allowed: false; reason: 'no-session' | 'forbidden' | 'unknown-channel'; permission?: PermissionId };

/**
 * Decide one call. Pure, so the table's consequences are unit-testable
 * without Electron or a signed-in user.
 */
export function decide(
  channel: string,
  session: { role: Parameters<typeof can>[0] } | null,
  overrides: Parameters<typeof can>[2] = {},
): Decision {
  if (isOpen(channel)) { return { allowed: true }; }

  const permission = requiredFor(channel);
  if (permission === undefined) {
    // Fail closed. A channel nobody has classified is more likely to be
    // newly added than deliberately public, and refusing it surfaces the
    // omission during development rather than in a deployed till.
    return { allowed: false, reason: 'unknown-channel' };
  }

  if (!session) { return { allowed: false, reason: 'no-session', permission }; }

  return can(session.role, permission, overrides)
    ? { allowed: true }
    : { allowed: false, reason: 'forbidden', permission };
}

/** Reason codes the renderer turns into a message in the active language. */
export const REFUSAL_CODES = {
  'no-session': 'auth/no-session',
  forbidden: 'auth/forbidden',
  'unknown-channel': 'auth/unknown-channel',
} as const;

type Handler = (event: unknown, ...args: unknown[]) => unknown;
interface HandleLike {
  handle: (channel: string, handler: Handler) => void;
}

/**
 * Wrap `ipcMain.handle` so every later registration is guarded.
 *
 * Called once, before the IPC modules register. Returns a function that
 * restores the original, which the tests use to avoid leaking the wrapper
 * between cases.
 */
export function installPermissionGuard(
  ipc: HandleLike,
  readOverrides: () => Parameters<typeof can>[2],
): () => void {
  // The unbound original is what `restore` puts back: binding first and
  // restoring the bound copy would leave something other than what was
  // there, which is not what "restore" means. Reading the method without
  // binding is exactly what `unbound-method` warns about, and exactly what
  // is needed here — `register` below binds it before any call.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const original = ipc.handle;
  const register = original.bind(ipc);

  ipc.handle = (channel: string, handler: Handler) => {
    register(channel, (event: unknown, ...args: unknown[]) => {
      const decision = decide(channel, getSession(), readOverrides());

      if (!decision.allowed) {
        // The same envelope every handler returns, so a refusal travels the
        // path the renderer already handles rather than rejecting the
        // invoke and surfacing as an unhandled error.
        return {
          success: false,
          error: REFUSAL_CODES[decision.reason],
          permission: decision.permission,
        };
      }

      return handler(event, ...args);
    });
  };

  return () => { ipc.handle = original; };
}
