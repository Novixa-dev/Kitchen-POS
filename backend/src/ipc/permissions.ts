/**
 * The role → permission matrix, and who is signed in.
 *
 * Reads and writes go through `sanitiseOverrides` / `setRolePermission`, so
 * an escalation cannot be stored even if the renderer asks for one — the
 * refusal is in the pure layer, not in this file's validation.
 */

import { ipcMain } from 'electron';
import { errMsg } from '../lib/errors';
import { getRawSetting, setRawSetting } from '../lib/settings';
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
  STAFF_ROLES,
  isPermissionId,
  isStaffRole,
  permissionsFor,
  resetRole,
  sanitiseOverrides,
  setRolePermission,
  type RolePermissionOverrides,
} from '../auth/permissions';
import { getSession } from '../auth/session';

const STORE_KEY = 'rolePermissions';

/** The stored matrix, validated. Read on every permission check. */
export function readOverrides(): RolePermissionOverrides {
  return sanitiseOverrides(getRawSetting<unknown>(STORE_KEY, {}));
}

function writeOverrides(next: RolePermissionOverrides): void {
  setRawSetting(STORE_KEY, sanitiseOverrides(next));
}

/** The resolved matrix for every role, which is what the UI draws. */
function matrix() {
  const overrides = readOverrides();
  return {
    permissions: PERMISSIONS,
    roles: STAFF_ROLES.map(role => ({
      role,
      granted: [...permissionsFor(role, overrides)],
      // `admin` is not editable, and a role with no stored entry is on the
      // shipped defaults — the UI says so rather than implying someone chose
      // this arrangement.
      editable: role !== 'admin',
      customised: overrides[role] !== undefined,
    })),
    defaults: DEFAULT_ROLE_PERMISSIONS,
  };
}

export function registerPermissionsIPC() {
  ipcMain.handle('permissions:get', async () => {
    try {
      return { success: true, data: matrix() };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });

  ipcMain.handle('permissions:set', async (_, payload: unknown) => {
    try {
      const { role, permission, granted } = (payload ?? {}) as {
        role?: unknown;
        permission?: unknown;
        granted?: unknown;
      };

      if (!isStaffRole(role) || !isPermissionId(permission) || typeof granted !== 'boolean') {
        return { success: false, error: 'Unknown role or permission.' };
      }

      // A refused change — admin, or an admin-only permission — comes back
      // as the unchanged matrix rather than an error: the UI redraws from
      // what is actually stored and the tick simply does not take.
      writeOverrides(setRolePermission(readOverrides(), role, permission, granted));
      return { success: true, data: matrix() };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });

  ipcMain.handle('permissions:resetRole', async (_, payload: unknown) => {
    try {
      const role = typeof payload === 'string'
        ? payload
        : (payload as { role?: unknown } | null)?.role;
      if (!isStaffRole(role)) { return { success: false, error: 'Unknown role.' }; }

      writeOverrides(resetRole(readOverrides(), role));
      return { success: true, data: matrix() };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });

  /**
   * What the signed-in person may do.
   *
   * Open, because the renderer needs it to decide what to show immediately
   * after sign-in — and it tells the caller only about their own session, so
   * there is nothing here they could not infer by trying.
   */
  ipcMain.handle('permissions:mine', async () => {
    try {
      const session = getSession();
      if (!session) { return { success: true, data: { role: null, granted: [] } }; }

      return {
        success: true,
        data: {
          role: session.role,
          name: session.name,
          granted: [...permissionsFor(session.role, readOverrides())],
        },
      };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });
}
