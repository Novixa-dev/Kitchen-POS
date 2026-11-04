import { useContext } from 'react';
import { PermissionsContext, type PermissionId, type PermissionsContextValue } from './context';

/** Access the signed-in person's permissions. */
export function usePermissions(): PermissionsContextValue {
  const ctx = useContext(PermissionsContext);
  if (!ctx) {
    throw new Error('usePermissions must be used inside <PermissionsProvider>.');
  }
  return ctx;
}

/**
 * Whether the signed-in person may do one thing.
 *
 * Use this to decide whether to *offer* an action. The main process refuses
 * the channel regardless, so this is about not showing a button that would
 * come back refused — never about security.
 */
export function useCan(permission: PermissionId): boolean {
  return usePermissions().can(permission);
}
