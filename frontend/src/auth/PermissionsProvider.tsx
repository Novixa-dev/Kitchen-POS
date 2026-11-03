import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/ipc';
import { useAuthStore } from '../store/auth';
import {
  PermissionsContext,
  type PermissionId,
  type PermissionsContextValue,
  type StaffRole,
} from './context';

interface Mine {
  role: StaffRole | null;
  granted: PermissionId[];
}

/**
 * Keeps the signed-in person's permissions available to the tree.
 *
 * Re-reads whenever the signed-in staff member changes, because that is the
 * only thing that changes the answer — and the main process resolves it, so
 * the renderer never computes a permission from a role it was handed.
 */
export const PermissionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const staffId = useAuthStore(state => state.staff?.id ?? null);

  // `null` means the first read has not landed, which is not the same as
  // "no permissions" — gating on that would flash a stripped-down shell.
  const [mine, setMine] = useState<Mine | null>(null);

  /** Fetch without touching state, so the effect can apply inside `.then`. */
  const fetchMine = useCallback(async (): Promise<Mine | null> => {
    const res = await api.permissions.mine();
    if (!res.success || !res.data) { return null; }
    return { role: res.data.role, granted: res.data.granted };
  }, []);

  const refresh = useCallback(
    () => fetchMine().then((next) => { if (next) { setMine(next); } }),
    [fetchMine],
  );

  useEffect(() => {
    let active = true;

    // Signed out: clear immediately rather than leaving the previous
    // person's permissions in place while a request is in flight.
    if (staffId === null) {
      setMine({ role: null, granted: [] });
      return () => { active = false; };
    }

    fetchMine()
      .then((next) => { if (active && next) { setMine(next); } })
      .catch(console.error);

    return () => { active = false; };
  }, [staffId, fetchMine]);

  const granted = useMemo(
    () => new Set<PermissionId>(mine?.granted ?? []),
    [mine],
  );

  const can = useCallback(
    (permission: PermissionId) => granted.has(permission),
    [granted],
  );

  const value = useMemo<PermissionsContextValue>(
    () => ({ role: mine?.role ?? null, granted, loading: mine === null, can, refresh }),
    [mine, granted, can, refresh],
  );

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
};
