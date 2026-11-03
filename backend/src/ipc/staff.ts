import { ipcMain } from 'electron';
import { getDB } from '../db';
import { errMsg } from '../lib/errors';

/** Mirrors the CHECK constraint in migration 015. */
const STAFF_ROLES: readonly string[] = ['admin', 'manager', 'cashier', 'waiter', 'kitchen'];

const PIN_ERROR = 'The PIN must be exactly 4 digits.';

function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

export function registerStaffIPC() {
  ipcMain.handle('staff:login', async (event, payload) => {
    try {
      const db = getDB();
      const user = db.prepare('SELECT * FROM staff WHERE pin = ? AND is_active = 1').get(payload.pin);
      if (user) {
        return { success: true, data: user };
      } 
        return { success: false, error: 'Invalid PIN' };
      
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });

  ipcMain.handle('staff:getAll', async () => {
    try {
      const db = getDB();
      const staff = db.prepare('SELECT * FROM staff').all();
      return { success: true, data: staff };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });

  ipcMain.handle(
    'staff:upsert',
    async (_event, payload: { id?: number; name: string; pin?: string; role: string }) => {
      try {
        const db = getDB();
        const name = payload.name.trim();
        const pin = payload.pin?.trim();

        if (!name) {
          return { success: false, error: 'A name is required.' };
        }
        if (!STAFF_ROLES.includes(payload.role)) {
          return { success: false, error: `Unknown role: ${payload.role}` };
        }

        if (payload.id) {
          // The edit form leaves the PIN blank to mean "keep the current one".
          // The previous version always bound `payload.pin`, so editing a
          // staff member without changing their PIN bound `undefined` and
          // threw.
          if (pin) {
            if (!isValidPin(pin)) { return { success: false, error: PIN_ERROR }; }
            db.prepare('UPDATE staff SET name = ?, pin = ?, role = ? WHERE id = ?')
              .run(name, pin, payload.role, payload.id);
          } else {
            db.prepare('UPDATE staff SET name = ?, role = ? WHERE id = ?')
              .run(name, payload.role, payload.id);
          }
          return { success: true, data: { id: payload.id } };
        }

        if (!pin || !isValidPin(pin)) {
          return { success: false, error: PIN_ERROR };
        }

        const info = db
          .prepare('INSERT INTO staff (name, pin, role) VALUES (?, ?, ?)')
          .run(name, pin, payload.role);
        return { success: true, data: { id: info.lastInsertRowid } };
      } catch (e: unknown) {
        return { success: false, error: errMsg(e) };
      }
    },
  );

  ipcMain.handle('staff:delete', async (event, payload: { id: number }) => {
    try {
      const db = getDB();
      const stmt = db.prepare('UPDATE staff SET is_active = 0 WHERE id = ?');
      const info = stmt.run(payload.id);
      if (info.changes > 0) {
        return { success: true };
      }
      return { success: false, error: 'Staff not found' };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });

  ipcMain.handle('staff:changePin', async (event, payload: { id: number, currentPin: string, newPin: string }) => {
    try {
      const db = getDB();
      const user = db.prepare('SELECT pin FROM staff WHERE id = ?').get(payload.id) as { pin: string } | undefined;
      if (!user) {
        return { success: false, error: 'User not found' };
      }
      if (user.pin !== payload.currentPin) {
        return { success: false, error: 'Current PIN is incorrect' };
      }
      db.prepare('UPDATE staff SET pin = ? WHERE id = ?').run(payload.newPin, payload.id);
      return { success: true };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });
}
