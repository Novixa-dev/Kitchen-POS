import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/ipc';
import {
  FeaturesContext,
  type FeatureId,
  type FeatureModule,
  type FeaturesContextValue,
} from './context';

/**
 * Narrow the id strings the main process sends back.
 *
 * The catalogue is the authority on which ids exist, so anything it does not
 * recognise is dropped rather than carried through as a `FeatureId` it is not.
 */
function toFeatureIds(ids: string[], known: Set<string>): FeatureId[] {
  return ids.filter((id): id is FeatureId => known.has(id));
}

/**
 * Loads the feature catalogue and keeps the active set available to the tree.
 *
 * The main process is the authority: it both resolves the active set and
 * refuses IPC for a disabled module. This provider is how the UI avoids
 * offering an action that would be refused.
 */
export const FeaturesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // `null` means the first read has not landed, which is not the same as
  // "no modules are active" — gating on it would flash a stripped-down UI.
  const [modules, setModules] = useState<FeatureModule[] | null>(null);

  /**
   * Fetch without touching state, so the mount effect can apply the result
   * inside a `.then` rather than writing state synchronously from the effect
   * body, and can drop a response that arrives after unmount.
   */
  const fetchModules = useCallback(async (): Promise<FeatureModule[] | null> => {
    const res = await api.features.list();
    return res.success && res.data ? (res.data.modules as FeatureModule[]) : null;
  }, []);

  const refresh = useCallback(
    () => fetchModules().then(next => { if (next) { setModules(next); } }),
    [fetchModules],
  );

  useEffect(() => {
    let active = true;
    fetchModules()
      .then(next => { if (active && next) { setModules(next); } })
      .catch(console.error);
    return () => { active = false; };
  }, [fetchModules]);

  const activeIds = useMemo(
    () => new Set((modules ?? []).filter(m => m.active).map(m => m.id)),
    [modules],
  );

  const isActive = useCallback(
    (id: FeatureId) => {
      // Before the catalogue arrives, treat everything as available. Gating
      // optimistically avoids a visible collapse-then-expand of the sidebar on
      // every launch; the main process still refuses anything genuinely off.
      if (modules === null) { return true; }
      return activeIds.has(id);
    },
    [modules, activeIds],
  );

  const preview = useCallback(async (id: FeatureId, enabled: boolean) => {
    const res = await api.features.preview({ id, enabled });
    if (!res.success || !res.data) {
      return { alsoEnabled: [] as FeatureId[], alsoDisabled: [] as FeatureId[] };
    }
    const known = new Set((modules ?? []).map(m => m.id as string));
    return {
      alsoEnabled: toFeatureIds(res.data.alsoEnabled, known),
      alsoDisabled: toFeatureIds(res.data.alsoDisabled, known),
    };
  }, [modules]);

  const setEnabled = useCallback(async (id: FeatureId, enabled: boolean) => {
    const res = await api.features.setEnabled({ id, enabled });
    if (!res.success) { return false; }
    await refresh();
    return true;
  }, [refresh]);

  const reset = useCallback(async () => {
    await api.features.reset();
    await refresh();
  }, [refresh]);

  const value = useMemo<FeaturesContextValue>(
    () => ({ modules, isActive, preview, setEnabled, reset, refresh }),
    [modules, isActive, preview, setEnabled, reset, refresh],
  );

  return <FeaturesContext.Provider value={value}>{children}</FeaturesContext.Provider>;
};
