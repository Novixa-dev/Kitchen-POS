import { ipcMain, app, dialog } from 'electron';
import Store from 'electron-store';
import { getDB, closeDB } from '../db';
import * as path from 'path';
import * as fs from 'fs';
import { defaultsFor } from '../lib/countries';
import { patchSettings } from '../lib/settings';

const store = new Store();

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Unknown error occurred';
}

/** What the setup wizard sends. Everything past the first three is optional. */
interface SetupPayload {
  restaurantName?: unknown;
  adminName?: unknown;
  adminPin?: unknown;
  /** ISO 3166-1 alpha-2, or '' for "not listed". */
  country?: unknown;
  locale?: unknown;
  numerals?: unknown;
  phone?: unknown;
  address?: unknown;
  taxNumber?: unknown;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function registerSystemIPC() {
  ipcMain.handle('system:isSetupComplete', async () => {
    try {
      const isComplete = store.get('is_setup_complete', false);
      return { success: true, data: isComplete };
    } catch (e) {
      return { success: false, error: errMsg(e) };
    }
  });

  /**
   * Finish first-run setup.
   *
   * Validated here rather than only in the wizard. The renderer's checks are
   * for telling someone what to fix as they type; this is the only place
   * that decides whether a four-digit PIN really is four digits, and it is
   * the account that can erase the till.
   *
   * The country's currency and tax defaults are applied server-side from the
   * same table the Settings screen uses, so the two cannot drift. Explicit
   * values in the payload win, which is what lets the wizard show the
   * defaults, let the outlet correct them, and send the corrected ones.
   */
  ipcMain.handle('system:completeSetup', async (_, raw: unknown) => {
    try {
      const payload = (raw ?? {}) as SetupPayload;

      const restaurantName = text(payload.restaurantName);
      const adminName = text(payload.adminName);
      const adminPin = text(payload.adminPin);

      if (restaurantName === '') {
        return { success: false, error: 'An outlet name is required.' };
      }
      if (adminName === '') {
        return { success: false, error: 'An administrator name is required.' };
      }
      if (!/^\d{4}$/.test(adminPin)) {
        return { success: false, error: 'The PIN must be exactly 4 digits.' };
      }

      const db = getDB();
      const updated = db
        .prepare("UPDATE staff SET name = ?, pin = ? WHERE role = 'admin'")
        .run(adminName, adminPin);

      // No seeded admin row means the migrations did not run as expected;
      // completing setup without an account to sign in with would leave the
      // app unusable and claim success.
      if (updated.changes === 0) {
        return { success: false, error: 'No administrator account to configure.' };
      }

      const country = text(payload.country).toUpperCase();
      const defaults = defaultsFor(country);

      patchSettings({
        country: defaults ? country : '',
        outlet: {
          name: restaurantName,
          phone: text(payload.phone),
          address: text(payload.address),
          taxNumber: text(payload.taxNumber),
        },
        ...(payload.locale === 'ar' || payload.locale === 'en'
          ? { locale: payload.locale }
          : {}),
        ...(payload.numerals === 'latn' || payload.numerals === 'arab'
          ? { numerals: payload.numerals }
          : {}),
        ...(defaults ? { currency: defaults.currency, tax: defaults.tax } : {}),
      });

      // Last, so a failure above leaves the app on the wizard rather than
      // past it with nothing configured.
      store.set('is_setup_complete', true);

      return { success: true };
    } catch (e) {
      return { success: false, error: errMsg(e) };
    }
  });

  ipcMain.handle('system:factoryReset', async () => {
    try {
      // 1. Close DB connection
      closeDB();

      // 2. Clear store
      store.clear();

      const userDataPath = app.getPath('userData');
      const dbPath = path.join(userDataPath, 'pos.db');
      const dbShmPath = path.join(userDataPath, 'pos.db-shm');
      const dbWalPath = path.join(userDataPath, 'pos.db-wal');
      const imagesPath = path.join(userDataPath, 'images');

      if (fs.existsSync(dbPath)) { fs.unlinkSync(dbPath); }
      if (fs.existsSync(dbShmPath)) { fs.unlinkSync(dbShmPath); }
      if (fs.existsSync(dbWalPath)) { fs.unlinkSync(dbWalPath); }

      // 4. Delete images directory
      if (fs.existsSync(imagesPath)) {
        fs.rmSync(imagesPath, { recursive: true, force: true });
      }

      // 5. Relaunch
      app.relaunch();
      app.exit(0);

      return { success: true };
    } catch (e) {
      return { success: false, error: errMsg(e) };
    }
  });

  ipcMain.handle('system:generateRecoveryCode', async () => {
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Save Recovery Code',
        defaultPath: 'kitchen-pos-recovery-code.txt',
        filters: [{ name: 'Text Files', extensions: ['txt'] }]
      });

      if (canceled || !filePath) {
        return { success: false, error: 'Cancelled' };
      }

      const content = `KITCHEN-POS RECOVERY CODE\n-------------------------\nKeep this code safe. If you forget your PIN, you can use this code to reset the Admin PIN.\n\nRecovery Code: ${code}\n`;
      fs.writeFileSync(filePath, content, 'utf-8');

      store.set('recovery_code', code);

      return { success: true };
    } catch (e) {
      return { success: false, error: errMsg(e) };
    }
  });

  ipcMain.handle('system:verifyRecoveryCode', async (_, payload: { code: string }) => {
    try {
      const storedCode = store.get('recovery_code') as string | undefined;
      if (storedCode && storedCode === payload.code.trim().toUpperCase()) {
        return { success: true };
      }
      return { success: false, error: 'Invalid recovery code' };
    } catch (e) {
      return { success: false, error: errMsg(e) };
    }
  });

  ipcMain.handle('system:resetAdminPin', async (_, payload: { newPin: string; code: string }) => {
    try {
      const storedCode = store.get('recovery_code') as string | undefined;
      if (!storedCode || storedCode !== payload.code.trim().toUpperCase()) {
        return { success: false, error: 'Invalid recovery code' };
      }

      const db = getDB();
      db.prepare('UPDATE staff SET pin = ? WHERE role = "admin"').run(payload.newPin);
      
      return { success: true };
    } catch (e) {
      return { success: false, error: errMsg(e) };
    }
  });
}
