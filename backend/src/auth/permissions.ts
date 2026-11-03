/**
 * Roles and permissions.
 *
 * Before this existed the app had roles and checked none of them: every
 * signed-in person — a waiter, a kitchen hand — could open Settings, edit
 * the menu, read the day's takings or factory-reset the till. The role was
 * stored on the staff row and read nowhere.
 *
 * Two rules keep the matrix safe to hand to an outlet's own admin:
 *
 *  1. **Admin holds every permission, always.** It is not editable, so there
 *     is no sequence of edits that locks the last administrator out of the
 *     screen where permissions are edited.
 *  2. **Some permissions are admin-only and cannot be granted away.** Without
 *     that, a manager grants themselves `staff.manage`, creates an admin
 *     account and has escalated. The guard refuses such a grant rather than
 *     storing it.
 *
 * Pure and dependency-free: the rules are unit-testable without Electron,
 * a database or a signed-in user.
 */

export type StaffRole = 'admin' | 'manager' | 'cashier' | 'waiter' | 'kitchen';

/** Mirrors the CHECK constraint in migration 015. */
export const STAFF_ROLES: readonly StaffRole[] = [
  'admin', 'manager', 'cashier', 'waiter', 'kitchen',
];

export type PermissionDomain =
  | 'service'
  | 'kitchen'
  | 'catalogue'
  | 'back-office'
  | 'money'
  | 'administration';

export type PermissionId =
  // service
  | 'orders.take'
  | 'orders.cancel'
  | 'billing.take'
  | 'tables.manage'
  // kitchen
  | 'kitchen.view'
  | 'kitchen.update'
  // catalogue
  | 'menu.view'
  | 'menu.edit'
  | 'inventory.view'
  | 'inventory.adjust'
  // back-office
  | 'customers.view'
  | 'customers.edit'
  | 'customers.settle'
  | 'expenses.view'
  | 'expenses.record'
  | 'reports.view'
  | 'reports.reprint'
  // money
  | 'shifts.operate'
  | 'session.manage'
  // administration
  | 'printers.manage'
  | 'settings.view'
  | 'settings.edit'
  | 'settings.features'
  | 'settings.permissions'
  | 'backup.run'
  | 'backup.restore'
  | 'staff.view'
  | 'staff.manage'
  | 'system.reset'
  | 'system.recovery';

export interface PermissionManifest {
  id: PermissionId;
  domain: PermissionDomain;
  /** Translation keys, so the matrix screen stays bilingual. */
  nameKey: string;
  descriptionKey: string;
  /**
   * Cannot be granted to any role but admin.
   *
   * These are the permissions that would let their holder become an admin,
   * destroy the records, or quietly widen their own access.
   */
  adminOnly?: true;
}

export const PERMISSIONS: readonly PermissionManifest[] = [
  // ── Service ───────────────────────────────────────────────────────────
  { id: 'orders.take', domain: 'service', nameKey: 'perm.ordersTake.name', descriptionKey: 'perm.ordersTake.description' },
  { id: 'orders.cancel', domain: 'service', nameKey: 'perm.ordersCancel.name', descriptionKey: 'perm.ordersCancel.description' },
  { id: 'billing.take', domain: 'service', nameKey: 'perm.billingTake.name', descriptionKey: 'perm.billingTake.description' },
  { id: 'tables.manage', domain: 'service', nameKey: 'perm.tablesManage.name', descriptionKey: 'perm.tablesManage.description' },

  // ── Kitchen ───────────────────────────────────────────────────────────
  { id: 'kitchen.view', domain: 'kitchen', nameKey: 'perm.kitchenView.name', descriptionKey: 'perm.kitchenView.description' },
  { id: 'kitchen.update', domain: 'kitchen', nameKey: 'perm.kitchenUpdate.name', descriptionKey: 'perm.kitchenUpdate.description' },

  // ── Catalogue ─────────────────────────────────────────────────────────
  { id: 'menu.view', domain: 'catalogue', nameKey: 'perm.menuView.name', descriptionKey: 'perm.menuView.description' },
  { id: 'menu.edit', domain: 'catalogue', nameKey: 'perm.menuEdit.name', descriptionKey: 'perm.menuEdit.description' },
  { id: 'inventory.view', domain: 'catalogue', nameKey: 'perm.inventoryView.name', descriptionKey: 'perm.inventoryView.description' },
  { id: 'inventory.adjust', domain: 'catalogue', nameKey: 'perm.inventoryAdjust.name', descriptionKey: 'perm.inventoryAdjust.description' },

  // ── Back office ───────────────────────────────────────────────────────
  { id: 'customers.view', domain: 'back-office', nameKey: 'perm.customersView.name', descriptionKey: 'perm.customersView.description' },
  { id: 'customers.edit', domain: 'back-office', nameKey: 'perm.customersEdit.name', descriptionKey: 'perm.customersEdit.description' },
  { id: 'customers.settle', domain: 'back-office', nameKey: 'perm.customersSettle.name', descriptionKey: 'perm.customersSettle.description' },
  { id: 'expenses.view', domain: 'back-office', nameKey: 'perm.expensesView.name', descriptionKey: 'perm.expensesView.description' },
  { id: 'expenses.record', domain: 'back-office', nameKey: 'perm.expensesRecord.name', descriptionKey: 'perm.expensesRecord.description' },
  { id: 'reports.view', domain: 'back-office', nameKey: 'perm.reportsView.name', descriptionKey: 'perm.reportsView.description' },
  { id: 'reports.reprint', domain: 'back-office', nameKey: 'perm.reportsReprint.name', descriptionKey: 'perm.reportsReprint.description' },

  // ── Money ─────────────────────────────────────────────────────────────
  { id: 'shifts.operate', domain: 'money', nameKey: 'perm.shiftsOperate.name', descriptionKey: 'perm.shiftsOperate.description' },
  { id: 'session.manage', domain: 'money', nameKey: 'perm.sessionManage.name', descriptionKey: 'perm.sessionManage.description' },

  // ── Administration ────────────────────────────────────────────────────
  { id: 'printers.manage', domain: 'administration', nameKey: 'perm.printersManage.name', descriptionKey: 'perm.printersManage.description' },
  { id: 'settings.view', domain: 'administration', nameKey: 'perm.settingsView.name', descriptionKey: 'perm.settingsView.description' },
  { id: 'settings.edit', domain: 'administration', nameKey: 'perm.settingsEdit.name', descriptionKey: 'perm.settingsEdit.description' },
  { id: 'backup.run', domain: 'administration', nameKey: 'perm.backupRun.name', descriptionKey: 'perm.backupRun.description' },
  { id: 'staff.view', domain: 'administration', nameKey: 'perm.staffView.name', descriptionKey: 'perm.staffView.description' },

  // Admin-only: each of these is a route to becoming an admin, to erasing
  // the records, or to widening one's own access.
  { id: 'settings.features', domain: 'administration', nameKey: 'perm.settingsFeatures.name', descriptionKey: 'perm.settingsFeatures.description', adminOnly: true },
  { id: 'settings.permissions', domain: 'administration', nameKey: 'perm.settingsPermissions.name', descriptionKey: 'perm.settingsPermissions.description', adminOnly: true },
  { id: 'backup.restore', domain: 'administration', nameKey: 'perm.backupRestore.name', descriptionKey: 'perm.backupRestore.description', adminOnly: true },
  { id: 'staff.manage', domain: 'administration', nameKey: 'perm.staffManage.name', descriptionKey: 'perm.staffManage.description', adminOnly: true },
  { id: 'system.reset', domain: 'administration', nameKey: 'perm.systemReset.name', descriptionKey: 'perm.systemReset.description', adminOnly: true },
  { id: 'system.recovery', domain: 'administration', nameKey: 'perm.systemRecovery.name', descriptionKey: 'perm.systemRecovery.description', adminOnly: true },
];

const PERMISSION_IDS = new Set<string>(PERMISSIONS.map(p => p.id));

export function isPermissionId(value: unknown): value is PermissionId {
  return typeof value === 'string' && PERMISSION_IDS.has(value);
}

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === 'string' && (STAFF_ROLES as readonly string[]).includes(value);
}

export function getPermission(id: PermissionId): PermissionManifest | undefined {
  return PERMISSIONS.find(p => p.id === id);
}

export function isAdminOnly(id: PermissionId): boolean {
  return getPermission(id)?.adminOnly === true;
}

/** Every permission that is not reserved to admin. */
export function grantablePermissions(): PermissionId[] {
  return PERMISSIONS.filter(p => p.adminOnly !== true).map(p => p.id);
}

/**
 * The shipped matrix.
 *
 * `admin` is deliberately absent: it holds everything by rule, not by list,
 * so a permission added later cannot be forgotten here and silently withheld
 * from the only role that can grant it.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<Exclude<StaffRole, 'admin'>, PermissionId[]> = {
  // Runs the floor day to day, but cannot change who may do what.
  manager: grantablePermissions(),

  cashier: [
    'orders.take', 'orders.cancel', 'billing.take', 'tables.manage',
    'kitchen.view',
    'menu.view', 'inventory.view',
    'customers.view', 'customers.edit', 'customers.settle',
    'expenses.view', 'reports.view', 'reports.reprint',
    'shifts.operate',
    'printers.manage', 'settings.view',
  ],

  waiter: [
    'orders.take', 'tables.manage',
    'kitchen.view',
    'menu.view',
    'customers.view',
    'shifts.operate',
    'settings.view',
  ],

  kitchen: [
    'kitchen.view', 'kitchen.update',
    'menu.view', 'inventory.view',
    'settings.view',
  ],
};

/** The admin's stored changes to the matrix. Absent means "use the default". */
export type RolePermissionOverrides = Partial<Record<StaffRole, PermissionId[]>>;

/**
 * What a role may actually do.
 *
 * Admin short-circuits to everything. For any other role an override, if
 * present, replaces the default wholesale — an admin who has unticked
 * something expects it to stay unticked — but admin-only permissions are
 * stripped, so a stored escalation that reached the file some other way
 * still has no effect at the point of the check.
 */
export function permissionsFor(
  role: StaffRole,
  overrides: RolePermissionOverrides = {},
): Set<PermissionId> {
  if (role === 'admin') { return new Set(PERMISSIONS.map(p => p.id)); }

  const stored = overrides[role];
  const list = stored ?? DEFAULT_ROLE_PERMISSIONS[role];

  return new Set(list.filter(id => isPermissionId(id) && !isAdminOnly(id)));
}

export function can(
  role: StaffRole,
  permission: PermissionId,
  overrides: RolePermissionOverrides = {},
): boolean {
  return permissionsFor(role, overrides).has(permission);
}

/**
 * Validate a stored override map.
 *
 * The settings store is schemaless, so this can hold a role or permission a
 * newer build knew, a value that is not an array, or an escalation written by
 * hand. Anything unrecognised is dropped rather than reaching a check.
 *
 * An entry for `admin` is always dropped: the role is not editable, and
 * keeping a stored one would imply it could be reduced.
 */
export function sanitiseOverrides(raw: unknown): RolePermissionOverrides {
  if (raw === null || typeof raw !== 'object') { return {}; }

  const clean: RolePermissionOverrides = {};

  for (const [role, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isStaffRole(role) || role === 'admin' || !Array.isArray(value)) { continue; }

    // De-duplicated, so a hand-edited file cannot produce a list that
    // disagrees with itself about how many permissions a role has.
    const ids = [...new Set(value.filter(isPermissionId).filter(id => !isAdminOnly(id)))];
    clean[role] = ids;
  }

  return clean;
}

/**
 * Apply one tick or untick.
 *
 * Returns the map unchanged when the change is not allowed, so a refusal is a
 * no-op rather than a thrown error the caller has to catch: ticking an
 * admin-only permission for a manager, or editing admin at all.
 */
export function setRolePermission(
  overrides: RolePermissionOverrides,
  role: StaffRole,
  permission: PermissionId,
  granted: boolean,
): RolePermissionOverrides {
  if (role === 'admin') { return overrides; }
  if (!isPermissionId(permission)) { return overrides; }
  // This is the escalation refusal: it is not stored, so it cannot later be
  // honoured by a build whose check is laxer.
  if (granted && isAdminOnly(permission)) { return overrides; }

  const current = permissionsFor(role, overrides);
  if (granted) {
    current.add(permission);
  } else {
    current.delete(permission);
  }

  return { ...overrides, [role]: [...current] };
}

/** Drop a role's changes, returning it to the shipped matrix. */
export function resetRole(
  overrides: RolePermissionOverrides,
  role: StaffRole,
): RolePermissionOverrides {
  // Built without the key rather than deleted from a copy: a dynamic
  // `delete` on a typed record is easy to get subtly wrong.
  return Object.fromEntries(
    Object.entries(overrides).filter(([key]) => key !== role),
  ) as RolePermissionOverrides;
}

/**
 * Catalogue integrity, asserted by the test suite: duplicate ids, a default
 * that grants an admin-only permission, or an unknown id in a default.
 */
export function validatePermissionCatalogue(): string[] {
  const problems: string[] = [];

  const ids = PERMISSIONS.map(p => p.id);
  if (new Set(ids).size !== ids.length) {
    problems.push('duplicate permission id');
  }

  for (const [role, list] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    for (const id of list) {
      if (!isPermissionId(id)) {
        problems.push(`${role} defaults include unknown permission ${String(id)}`);
      } else if (isAdminOnly(id)) {
        problems.push(`${role} defaults include admin-only permission ${id}`);
      }
    }
    if (new Set(list).size !== list.length) {
      problems.push(`${role} defaults list a permission twice`);
    }
  }

  return problems;
}
