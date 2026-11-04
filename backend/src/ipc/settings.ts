import { ipcMain } from 'electron';
import { errMsg } from '../lib/errors';
import {
  DEFAULT_SETTINGS,
  getRawSetting,
  getSettings,
  patchSettings,
  setRawSetting,
} from '../lib/settings';
import { COUNTRIES, defaultsFor } from '../lib/countries';

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

  /**
   * The country profiles.
   *
   * Open, because the setup wizard needs it before any account exists — and
   * it is a static table, the same for every install.
   */
  ipcMain.handle('settings:countries', async () => {
    try {
      return { success: true, data: { countries: COUNTRIES, current: getSettings().country } };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });

  /**
   * Fill in currency and tax from a country.
   *
   * The locale is deliberately *not* changed: by the time an outlet is on
   * this screen they have been using the app in a language they chose, and
   * silently switching it because they corrected the country would be a
   * surprise. The wizard applies the suggested locale; this does not.
   */
  ipcMain.handle('settings:applyCountry', async (_, payload: unknown) => {
    try {
      const code = typeof payload === 'string'
        ? payload
        : (payload as { code?: unknown } | null)?.code;

      if (typeof code !== 'string') {
        return { success: false, error: 'A country code is required.' };
      }

      const defaults = defaultsFor(code);
      if (!defaults) {
        // "Not listed": remember the choice, change nothing else.
        return { success: true, data: patchSettings({ country: '' }) };
      }

      return {
        success: true,
        data: patchSettings({
          country: code.toUpperCase(),
          currency: defaults.currency,
          tax: defaults.tax,
        }),
      };
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
