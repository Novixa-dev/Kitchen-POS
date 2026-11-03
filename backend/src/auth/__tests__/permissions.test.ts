import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
  STAFF_ROLES,
  can,
  grantablePermissions,
  isAdminOnly,
  isPermissionId,
  isStaffRole,
  permissionsFor,
  resetRole,
  sanitiseOverrides,
  setRolePermission,
  validatePermissionCatalogue,
  type PermissionId,
  type RolePermissionOverrides,
} from '../permissions';

describe('catalogue integrity', () => {
  it('has no duplicates and no default that grants an admin-only permission', () => {
    expect(validatePermissionCatalogue()).toEqual([]);
  });

  it('gives every permission translation keys, so the matrix stays bilingual', () => {
    for (const p of PERMISSIONS) {
      expect(p.nameKey, p.id).toMatch(/^perm\./);
      expect(p.descriptionKey, p.id).toMatch(/^perm\./);
    }
  });

  it('recognises its own ids and rejects anything else', () => {
    expect(isPermissionId('orders.take')).toBe(true);
    expect(isPermissionId('orders.everything')).toBe(false);
    expect(isPermissionId(undefined)).toBe(false);
    expect(isStaffRole('kitchen')).toBe(true);
    expect(isStaffRole('owner')).toBe(false);
  });

  it('reserves the escalation routes to admin', () => {
    // Each of these is a way to become an admin, erase the records, or
    // widen one's own access.
    for (const id of [
      'staff.manage', 'settings.permissions', 'settings.features',
      'system.reset', 'system.recovery', 'backup.restore',
    ] as PermissionId[]) {
      expect(isAdminOnly(id), id).toBe(true);
    }
  });

  it('keeps the day-to-day permissions grantable', () => {
    for (const id of ['orders.take', 'billing.take', 'reports.view'] as PermissionId[]) {
      expect(isAdminOnly(id), id).toBe(false);
    }
  });
});

describe('permissionsFor', () => {
  it('gives admin everything, by rule rather than by list', () => {
    // The default matrix has no `admin` entry on purpose: a permission added
    // later must not be silently withheld from the only role that can grant
    // it.
    const admin = permissionsFor('admin');
    expect(admin.size).toBe(PERMISSIONS.length);
    for (const p of PERMISSIONS) {
      expect(admin.has(p.id), p.id).toBe(true);
    }
  });

  it('gives a manager everything except the admin-only permissions', () => {
    const manager = permissionsFor('manager');
    expect(manager.size).toBe(grantablePermissions().length);
    expect(manager.has('staff.manage')).toBe(false);
    expect(manager.has('reports.view')).toBe(true);
  });

  it('keeps the kitchen out of the money', () => {
    const kitchen = permissionsFor('kitchen');
    expect(kitchen.has('kitchen.update')).toBe(true);
    expect(kitchen.has('billing.take')).toBe(false);
    expect(kitchen.has('reports.view')).toBe(false);
    expect(kitchen.has('customers.settle')).toBe(false);
  });

  it('keeps a waiter out of cancellations and cash drawers', () => {
    const waiter = permissionsFor('waiter');
    expect(waiter.has('orders.take')).toBe(true);
    expect(waiter.has('orders.cancel')).toBe(false);
    expect(waiter.has('expenses.record')).toBe(false);
    expect(waiter.has('reports.view')).toBe(false);
  });

  it('lets every role reach Settings to read it, and only some to change it', () => {
    for (const role of STAFF_ROLES) {
      expect(can(role, 'settings.view'), role).toBe(true);
    }
    expect(can('waiter', 'settings.edit')).toBe(false);
    expect(can('manager', 'settings.edit')).toBe(true);
  });

  it('replaces the default wholesale when an override is stored', () => {
    // An admin who has unticked something expects it to stay unticked, so an
    // override is not merged with the defaults.
    const overrides: RolePermissionOverrides = { cashier: ['orders.take'] };
    const cashier = permissionsFor('cashier', overrides);
    expect(cashier.has('orders.take')).toBe(true);
    expect(cashier.has('billing.take')).toBe(false);
  });

  it('ignores an admin-only permission that reached the store some other way', () => {
    // Defence in depth: the setter refuses to write this, but a hand-edited
    // config must not be honoured at the point of the check either.
    const overrides = { manager: ['staff.manage', 'orders.take'] } as RolePermissionOverrides;
    const manager = permissionsFor('manager', overrides);
    expect(manager.has('staff.manage')).toBe(false);
    expect(manager.has('orders.take')).toBe(true);
  });

  it('cannot reduce admin, whatever is stored', () => {
    const overrides = { admin: [] } as RolePermissionOverrides;
    expect(permissionsFor('admin', overrides).size).toBe(PERMISSIONS.length);
  });
});

describe('sanitiseOverrides', () => {
  it('keeps a valid entry', () => {
    expect(sanitiseOverrides({ cashier: ['orders.take', 'billing.take'] }))
      .toEqual({ cashier: ['orders.take', 'billing.take'] });
  });

  it('returns an empty map for a non-object', () => {
    expect(sanitiseOverrides(null)).toEqual({});
    expect(sanitiseOverrides(undefined)).toEqual({});
    expect(sanitiseOverrides('cashier')).toEqual({});
  });

  it('drops a role this build does not know', () => {
    expect(sanitiseOverrides({ sommelier: ['orders.take'] })).toEqual({});
  });

  it('always drops an admin entry, since the role is not editable', () => {
    expect(sanitiseOverrides({ admin: ['orders.take'] })).toEqual({});
  });

  it('drops a value that is not an array', () => {
    expect(sanitiseOverrides({ cashier: 'orders.take' })).toEqual({});
  });

  it('strips unknown and admin-only permissions from a list', () => {
    expect(sanitiseOverrides({ manager: ['orders.take', 'staff.manage', 'nope'] }))
      .toEqual({ manager: ['orders.take'] });
  });

  it('de-duplicates, so a hand-edited file cannot disagree with itself', () => {
    expect(sanitiseOverrides({ waiter: ['orders.take', 'orders.take'] }))
      .toEqual({ waiter: ['orders.take'] });
  });

  it('keeps a deliberately empty list distinct from no entry at all', () => {
    // An admin who unticked everything for a role means it, and that must
    // not read back as "use the defaults".
    const sanitised = sanitiseOverrides({ kitchen: [] });
    expect(sanitised).toEqual({ kitchen: [] });
    expect(permissionsFor('kitchen', sanitised).size).toBe(0);
  });
});

describe('setRolePermission', () => {
  it('grants a permission the role did not have', () => {
    const next = setRolePermission({}, 'waiter', 'orders.cancel', true);
    expect(can('waiter', 'orders.cancel', next)).toBe(true);
    // And leaves the rest of the defaults in place.
    expect(can('waiter', 'orders.take', next)).toBe(true);
  });

  it('revokes one the role had', () => {
    const next = setRolePermission({}, 'cashier', 'reports.reprint', false);
    expect(can('cashier', 'reports.reprint', next)).toBe(false);
    expect(can('cashier', 'reports.view', next)).toBe(true);
  });

  it('refuses to grant an admin-only permission, as a no-op', () => {
    // The escalation this blocks: a manager grants themselves `staff.manage`,
    // creates an admin account, and is one.
    const before: RolePermissionOverrides = {};
    const after = setRolePermission(before, 'manager', 'staff.manage', true);
    expect(after).toBe(before);
    expect(can('manager', 'staff.manage', after)).toBe(false);
  });

  it('refuses to edit admin at all', () => {
    const before: RolePermissionOverrides = {};
    expect(setRolePermission(before, 'admin', 'orders.take', false)).toBe(before);
    expect(can('admin', 'orders.take')).toBe(true);
  });

  it('refuses an unknown permission', () => {
    const before: RolePermissionOverrides = {};
    expect(setRolePermission(before, 'waiter', 'orders.teleport' as PermissionId, true))
      .toBe(before);
  });

  it('is idempotent', () => {
    const once = setRolePermission({}, 'waiter', 'orders.cancel', true);
    const twice = setRolePermission(once, 'waiter', 'orders.cancel', true);
    expect(permissionsFor('waiter', twice)).toEqual(permissionsFor('waiter', once));
  });

  it('survives a round trip through sanitisation', () => {
    // What the setter writes must be exactly what the reader accepts, or a
    // change would quietly vanish on the next launch.
    const next = setRolePermission({}, 'kitchen', 'orders.take', true);
    expect(permissionsFor('kitchen', sanitiseOverrides(next)))
      .toEqual(permissionsFor('kitchen', next));
  });
});

describe('resetRole', () => {
  it('returns a role to the shipped matrix', () => {
    const edited = setRolePermission({}, 'cashier', 'billing.take', false);
    const reset = resetRole(edited, 'cashier');
    expect([...permissionsFor('cashier', reset)].sort())
      .toEqual([...DEFAULT_ROLE_PERMISSIONS.cashier].sort());
  });

  it('leaves other roles alone', () => {
    const edited = setRolePermission(
      setRolePermission({}, 'cashier', 'billing.take', false),
      'waiter', 'orders.cancel', true,
    );
    const reset = resetRole(edited, 'cashier');
    expect(can('waiter', 'orders.cancel', reset)).toBe(true);
  });
});
