import React from 'react';
import { useFeature } from './useFeatures';
import type { FeatureId } from './context';

interface Props {
  feature: FeatureId;
  children: React.ReactNode;
  /** Shown when the module is off. Defaults to nothing. */
  fallback?: React.ReactNode;
}

/**
 * Renders `children` only while the module is active.
 *
 * For whole routes, prefer redirecting rather than rendering nothing — a blank
 * page leaves the user stuck. `FeatureRoute` does that.
 */
export const FeatureGate: React.FC<Props> = ({ feature, children, fallback = null }) => {
  return useFeature(feature) ? <>{children}</> : <>{fallback}</>;
};
