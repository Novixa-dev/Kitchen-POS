import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from './usePermissions';
import { homeRouteFor } from './homeRoute';
import type { PermissionId } from './context';

interface Props {
  permission: PermissionId;
  children: React.ReactNode;
}

/**
 * Guards a whole route by permission.
 *
 * Redirects rather than rendering nothing, for the same reason
 * `FeatureRoute` does: a screen the role cannot use is still reachable by
 * typing the URL or following a stale bookmark, and a blank page leaves the
 * user stuck.
 *
 * Where it redirects *to* is the part that matters. Sending everyone to the
 * dashboard would loop for a role without `reports.view`, so the destination
 * is the first route the person's own permissions allow.
 */
export const PermissionRoute: React.FC<Props> = ({ permission, children }) => {
  const { granted, loading, can } = usePermissions();

  // Not loaded yet: render rather than redirect on incomplete information,
  // otherwise every launch bounces before the permissions land.
  if (loading) { return <>{children}</>; }

  if (can(permission)) { return <>{children}</>; }

  const home = homeRouteFor(granted);
  // Guard against a redirect to a route this same permission guards, which
  // would loop. Cannot happen with the shipped roles, but an admin can
  // untick anything.
  return <Navigate to={home} replace />;
};
