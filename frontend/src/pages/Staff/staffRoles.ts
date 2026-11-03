import type { TranslationKey } from '../../i18n/types';

/**
 * Staff roles.
 *
 * As with expense categories, the stored value stays the lowercase English
 * identifier the database and the auth checks already use; only the display is
 * translated. Renaming the stored values would break every permission check.
 */

export const STAFF_ROLES = ['admin', 'manager', 'cashier', 'waiter', 'kitchen'] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

const LABELS: Partial<Record<string, TranslationKey>> = {
  admin: 'staff.role.admin',
  manager: 'staff.role.manager',
  cashier: 'staff.role.cashier',
  waiter: 'staff.role.waiter',
  kitchen: 'staff.role.kitchen',
};

/** Translated label for a stored role, falling back to the raw value. */
export function staffRoleLabel(role: string, t: (key: TranslationKey) => string): string {
  const key = LABELS[role];
  return key ? t(key) : role;
}
