import { ipcMain } from 'electron';
import { errMsg } from '../lib/errors';
import {
  DEFAULT_SETTINGS,
  getRawSetting,
  getSettings,
  patchSettings,
  setRawSetting,
} from '../lib/settings';

export function registerSettingsIPC() {
  /**
   * Returns the validated settings tree plus the legacy flat keys.
   *
   * Parts of the renderer still read the flat keys that predate the schema
   * (`outlet_name`, `is_kds_enabled`, …). Returning both keeps those call
   * sites working while they migrate, and the flat values are derived from
   * the validated tree, so the two can never disagree.
   */
  ipcMain.handle('settings:get', async () => {
    try {
      const settings = getSettings();
      return {
        success: true,
        data: {
          ...settings,

          // Flat aliases for not-yet-migrated call sites.
          outlet_name: settings.outlet.name,
          address: settings.outlet.address,
          gstin: settings.outlet.taxNumber,
          is_kds_enabled: settings.kdsEnabled,
          inventory_auto_debit: settings.inventoryAutoDebit,
          currency_code: settings.currency.code,
          currency_symbol: settings.currency.symbol,
          currency_decimals: settings.currency.decimals,
          currency_position: settings.currency.position,
        },
      };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });

  ipcMain.handle('settings:save', async (_, payload: Record<string, unknown>) => {
    try {
      return { success: true, data: patchSettings(payload) };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });

  ipcMain.handle('settings:reset', async () => {
    try {
      return { success: true, data: patchSettings({ ...DEFAULT_SETTINGS }) };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });
}

/** Kept for existing call sites that read a single flat key. */
export function getSetting<T>(key: string, defaultValue: T): T {
  return getRawSetting(key, defaultValue);
}

export { setRawSetting as setSetting };
