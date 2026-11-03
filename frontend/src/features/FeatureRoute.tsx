import React from 'react';
import { Navigate } from 'react-router-dom';
import { useFeature, useFeatures } from './useFeatures';
import { homeRouteFor, usePermissions } from '../auth';
import type { FeatureId } from './context';

interface Props {
  feature: FeatureId;
  children: React.ReactNode;
}

/**
 * Guards a whole route.
 *
 * Redirects rather than rendering nothing: a blank page leaves the user with
 * no way forward, and a disabled module's route is still reachable by typing
 * the URL or following a stale bookmark.
 *
 * While the catalogue is still loading the route renders, because
 * `isActive` is optimistic until it lands — otherwise every launch would
 * bounce the user away before settling.
 *
 * The destination is the first route the person's permissions allow, not a
 * fixed `/dashboard`: that screen needs `reports.view`, so a kitchen hand
 * sent there would simply be redirected again.
 */
export const FeatureRoute: React.FC<Props> = ({ feature, children }) => {
  const { modules } = useFeatures();
  const active = useFeature(feature);
  const { granted } = usePermissions();

  // Not loaded yet: render, rather than redirect on incomplete information.
  if (modules === null) { return <>{children}</>; }

  return active ? <>{children}</> : <Navigate to={homeRouteFor(granted)} replace />;
};
