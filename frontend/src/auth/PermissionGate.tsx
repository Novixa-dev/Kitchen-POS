import React from 'react';
import { useCan, usePermissions } from './usePermissions';
import type { PermissionId } from './context';

interface Props {
  permission: PermissionId;
  children: React.ReactNode;
  /** Shown when the permission is absent. Defaults to nothing. */
  fallback?: React.ReactNode;
}

/**
 * Renders `children` only if the signed-in person holds the permission.
 *
 * Renders nothing while the first read is in flight, so a control does not
 * appear and then vanish — which looks like a glitch and, on a destructive
 * button, invites a click in the gap.
 */
export const PermissionGate: React.FC<Props> = ({ permission, children, fallback = null }) => {
  const { loading } = usePermissions();
  const allowed = useCan(permission);

  if (loading) { return null; }
  return allowed ? <>{children}</> : <>{fallback}</>;
};
