import { useContext } from 'react';
import { FeaturesContext, type FeatureId, type FeaturesContextValue } from './context';

/** Access the feature catalogue and the toggle actions. */
export function useFeatures(): FeaturesContextValue {
  const ctx = useContext(FeaturesContext);
  if (!ctx) {
    throw new Error('useFeatures must be used inside <FeaturesProvider>.');
  }
  return ctx;
}

/**
 * Whether one module is usable right now.
 *
 * Use this to decide whether to *offer* an action. The main process refuses
 * IPC for a disabled module regardless, so this is about not showing the user
 * a button that would fail.
 */
export function useFeature(id: FeatureId): boolean {
  return useFeatures().isActive(id);
}
