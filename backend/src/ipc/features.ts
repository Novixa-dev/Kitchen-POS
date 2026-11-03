import { ipcMain } from 'electron';
import { errMsg } from '../lib/errors';
import { getRawSetting, setRawSetting } from '../lib/settings';
import { FEATURES, isFeatureId, type FeatureId } from '../features/catalogue';
import { planToggle, resolveActive, type FeatureToggles } from '../features/resolve';

const STORE_KEY = 'featureToggles';

function readToggles(): FeatureToggles {
  const raw = getRawSetting<Record<string, unknown>>(STORE_KEY, {});
  const clean: FeatureToggles = {};

  // Only keep ids this build knows about and values that are actually
  // booleans. A stored id from a newer build, or a corrupted value, must not
  // reach the resolver.
  for (const [key, value] of Object.entries(raw)) {
    if (isFeatureId(key) && typeof value === 'boolean') {
      clean[key] = value;
    }
  }
  return clean;
}

/** The authoritative active set, for use by other main-process modules. */
export function activeFeatures(): Set<FeatureId> {
  return resolveActive(readToggles());
}

export function isFeatureEnabled(id: FeatureId): boolean {
  return activeFeatures().has(id);
}

/**
 * Refuse an operation that belongs to a disabled module.
 *
 * Hiding a screen in the renderer is presentation; this is the enforcement.
 * Without it, a disabled module's IPC is still callable by anything that can
 * reach `window.api`.
 */
export function assertFeature(id: FeatureId): void {
  if (!isFeatureEnabled(id)) {
    throw new Error(`The "${id}" module is switched off.`);
  }
}

export function registerFeaturesIPC() {
  ipcMain.handle('features:list', async () => {
    try {
      const toggles = readToggles();
      const active = resolveActive(toggles);

      return {
        success: true,
        data: {
          // The manifest travels to the renderer so the UI does not have to
          // keep its own copy of the catalogue in sync.
          modules: FEATURES.map(f => ({
            id: f.id,
            category: f.category,
            nameKey: f.nameKey,
            descriptionKey: f.descriptionKey,
            icon: f.icon,
            requires: f.requires,
            locked: f.locked === true,
            /** What the admin chose, or the manifest default. */
            enabled: toggles[f.id] ?? f.enabledByDefault,
            /** Whether it is actually usable once dependencies are resolved. */
            active: active.has(f.id),
          })),
          active: [...active],
        },
      };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });

  /**
   * Preview a change without applying it, so the UI can warn the admin which
   * other modules a toggle will drag with it.
   */
  ipcMain.handle('features:preview', async (_, payload: { id: unknown; enabled: unknown }) => {
    try {
      if (!isFeatureId(payload.id) || typeof payload.enabled !== 'boolean') {
        return { success: false, error: 'An unknown module or a non-boolean state.' };
      }
      const plan = planToggle(readToggles(), payload.id, payload.enabled);
      return {
        success: true,
        data: { alsoEnabled: plan.alsoEnabled, alsoDisabled: plan.alsoDisabled },
      };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });

  ipcMain.handle('features:setEnabled', async (_, payload: { id: unknown; enabled: unknown }) => {
    try {
      if (!isFeatureId(payload.id) || typeof payload.enabled !== 'boolean') {
        return { success: false, error: 'An unknown module or a non-boolean state.' };
      }

      const plan = planToggle(readToggles(), payload.id, payload.enabled);
      setRawSetting(STORE_KEY, plan.toggles);

      const active = resolveActive(plan.toggles);
      return {
        success: true,
        data: {
          active: [...active],
          alsoEnabled: plan.alsoEnabled,
          alsoDisabled: plan.alsoDisabled,
        },
      };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });

  ipcMain.handle('features:reset', async () => {
    try {
      // Clearing the stored map falls every module back to its manifest
      // default, which is what "reset" should mean.
      setRawSetting(STORE_KEY, {});
      return { success: true, data: { active: [...resolveActive({})] } };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });
}
