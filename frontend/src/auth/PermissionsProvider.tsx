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

/** Nobody is signed in: no role, nothing granted. Not a loading state. */
const SIGNED_OUT: Mine = { role: null, granted: [] };

/**
 * Keeps the signed-in person's permissions available to the tree.
 *
 * Re-reads whenever the signed-in staff member changes, because that is the
 * only thing that changes the answer — and the main process resolves it, so
 * the renderer never computes a permission from a role it was handed.
 */
export const PermissionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const staffId = useAuthStore(state => state.staff?.id ?? null);

  /**
   * The answer, tagged with the staff member it is about.
   *
   * Keyed rather than plain, so the previous person's permissions can never
   * be read as the new one's while a fetch is in flight — and so the
   * signed-out case is *derived* rather than written by an effect, which
   * would be a state update during render.
   */
  const [fetched, setFetched] = useState<{ staffId: number; mine: Mine } | null>(null);

  const mine: Mine | null = ((): Mine | null => {
    if (staffId === null) { return SIGNED_OUT; }
    // Only the answer about *this* staff member counts; anything else is a
    // previous person's, which must read as "not loaded yet".
    return fetched?.staffId === staffId ? fetched.mine : null;
  })();

  /** Fetch without touching state, so the effect can apply inside `.then`. */
  const fetchMine = useCallback(async (): Promise<Mine | null> => {
    const res = await api.permissions.mine();
    if (!res.success || !res.data) { return null; }
    return { role: res.data.role, granted: res.data.granted };
  }, []);

  const refresh = useCallback(async () => {
    if (staffId === null) { return; }
    const next = await fetchMine();
    if (next) { setFetched({ staffId, mine: next }); }
  }, [staffId, fetchMine]);

  useEffect(() => {
    // Nothing to fetch when signed out; `mine` is derived above.
    if (staffId === null) { return; }

    let active = true;
    fetchMine()
      .then((next) => { if (active && next) { setFetched({ staffId, mine: next }); } })
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
