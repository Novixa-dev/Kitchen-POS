import { createContext } from 'react';

/**
 * Permission contract for the renderer.
 *
 * Mirrors `backend/src/auth/permissions.ts`. The main process is the
 * authority — it holds the verified session and refuses a guarded channel
 * outright — so everything here exists only to decide what to *show*. Being
 * wrong is a presentation bug, not a hole: the worst case is offering a
 * button whose IPC comes back refused.
 */

export type StaffRole = 'admin' | 'manager' | 'cashier' | 'waiter' | 'kitchen';

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
  | 'orders.take'
  | 'orders.cancel'
  | 'billing.take'
  | 'tables.manage'
  | 'kitchen.view'
  | 'kitchen.update'
  | 'menu.view'
  | 'menu.edit'
  | 'inventory.view'
  | 'inventory.adjust'
  | 'customers.view'
  | 'customers.edit'
  | 'customers.settle'
  | 'expenses.view'
  | 'expenses.record'
  | 'reports.view'
  | 'reports.reprint'
  | 'shifts.operate'
  | 'session.manage'
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
  nameKey: string;
  descriptionKey: string;
  /** Reserved to admin; the matrix shows it as fixed rather than unticked. */
  adminOnly?: true;
}

export interface RoleRow {
  role: StaffRole;
  granted: PermissionId[];
  /** False for admin, which holds everything by rule. */
  editable: boolean;
  /** True when an admin has changed this role from the shipped defaults. */
  customised: boolean;
}

export interface PermissionMatrix {
  permissions: PermissionManifest[];
  roles: RoleRow[];
}

/** Reason codes the guard returns in place of an error message. */
export const REFUSAL_CODES = {
  noSession: 'auth/no-session',
  forbidden: 'auth/forbidden',
  unknownChannel: 'auth/unknown-channel',
} as const;

export function isRefusal(error: unknown): boolean {
  return typeof error === 'string'
    && (Object.values(REFUSAL_CODES) as string[]).includes(error);
}

export interface PermissionsContextValue {
  /** The signed-in person's role, or null before sign-in. */
  role: StaffRole | null;
  /** What they may do, as resolved by the main process. */
  granted: ReadonlySet<PermissionId>;
  /** True until the first answer lands. */
  loading: boolean;
  can: (permission: PermissionId) => boolean;
  /** Re-read after signing in, or after the matrix is edited. */
  refresh: () => Promise<void>;
}

export const PermissionsContext = createContext<PermissionsContextValue | null>(null);
