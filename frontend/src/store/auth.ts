import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../lib/ipc';
import { Shift, Staff } from '../types/models';

interface AuthState {
  staff: Staff | null;
  isAuthenticated: boolean;
  isSetupComplete: boolean | null;
  activeShift: Shift | null;
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
  fetchActiveShift: () => Promise<void>;
  checkSetup: () => Promise<boolean>;
  openShift: (openingCash: number) => Promise<boolean>;
  closeShift: (closingCash: number, note?: string) => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      staff: null,
      isAuthenticated: false,
      isSetupComplete: null,
      activeShift: null,
      login: async (pin: string) => {
        const res = await api.staff.login({ pin });
        if (res.success && res.data) {
          set({ staff: res.data as Staff, isAuthenticated: true });
          // Immediately fetch if there is an active shift
          const shiftRes = await api.shifts.getActive();
          if (shiftRes.success && shiftRes.data) {
            set({ activeShift: shiftRes.data });
          } else {
            set({ activeShift: null });
          }
          return true;
        }
        return false;
      },
      logout: () => {
        set({ staff: null, isAuthenticated: false, activeShift: null });
        // The main process holds the authoritative session; clearing only
        // this store would leave it able to answer guarded channels.
        void api.staff.logout().catch(console.error);
      },
      fetchActiveShift: async () => {
        const res = await api.shifts.getActive();
        if (res.success && res.data) {
          set({ activeShift: res.data });
        } else {
          set({ activeShift: null });
        }
      },
      checkSetup: async () => {
        const res = await api.system.isSetupComplete();
        const isComplete = !!(res.success && res.data);
        set({ isSetupComplete: isComplete });
        return isComplete;
      },
      openShift: async (openingCash: number) => {
        const staff = get().staff;
        if (!staff) { return false; }
        const res = await api.shifts.open({ staffId: staff.id, openingCash });
        if (res.success && res.data) {
          // Re-fetch active shift
          const shiftRes = await api.shifts.getActive();
          if (shiftRes.success && shiftRes.data) {
            set({ activeShift: shiftRes.data });
            return true;
          }
          console.error('Failed to get active shift after opening:', shiftRes.error);
        } else {
          console.error('Failed to open shift via API:', res.error);
        }
        return false;
      },
      closeShift: async (closingCash: number, note?: string) => {
        const activeShift = get().activeShift;
        if (!activeShift) { return false; }
        const res = await api.shifts.close({ shiftId: activeShift.id, closingCash, note });
        if (res.success) {
          set({ activeShift: null });
          return true;
        }
        return false;
      }
    }),
    {
      name: 'kitchen-pos-auth',
      /**
       * Only the setup flag survives a restart.
       *
       * `staff` and `isAuthenticated` used to persist, which meant the till
       * came back signed in as whoever last used it — and, since this is
       * `localStorage`, that anyone could edit the stored role to `admin`.
       * Permissions are now enforced in the main process against a session
       * created by verifying a PIN, and there is no PIN to re-verify on
       * boot, so restoring a session here would restore nothing real: the
       * shell would look signed in while every guarded channel refused.
       * Signing in again on launch is the correct behaviour for a till.
       */
      partialize: (state) => ({ isSetupComplete: state.isSetupComplete }),
    }
  )
);
