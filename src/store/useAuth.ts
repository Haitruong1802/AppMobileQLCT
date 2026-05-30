// F21 — Auth/lock state. Track app lock/unlock.
import { create } from 'zustand';
import {
  hasPin,
  isBiometricEnabled,
  verifyPin,
  authenticateWithBiometric,
} from '../services/lock';

interface AuthState {
  locked: boolean;
  failedAttempts: number;
  lockedUntilMs: number | null; // sau 5 lần PIN sai → khoá 5 phút
  setLocked: (locked: boolean) => void;
  /** Khi app khởi động hoặc back từ background. */
  refreshLockState: (justBackgrounded: boolean) => Promise<void>;
  tryUnlockWithPin: (pin: string) => Promise<boolean>;
  tryUnlockWithBiometric: () => Promise<boolean>;
}

const BG_THRESHOLD_MS = 5 * 60 * 1000; // 5 phút
const LOCKOUT_MS = 5 * 60 * 1000;

export const useAuth = create<AuthState>((set, get) => ({
  locked: false,
  failedAttempts: 0,
  lockedUntilMs: null,
  setLocked: (locked) => set({ locked }),
  refreshLockState: async (justBackgrounded) => {
    const pinSet = await hasPin();
    if (!pinSet) {
      set({ locked: false });
      return;
    }
    if (justBackgrounded) {
      set({ locked: true });
    }
  },
  tryUnlockWithPin: async (pin) => {
    const state = get();
    if (state.lockedUntilMs && state.lockedUntilMs > Date.now()) {
      return false;
    }
    const ok = await verifyPin(pin);
    if (ok) {
      set({ locked: false, failedAttempts: 0, lockedUntilMs: null });
      return true;
    }
    const attempts = state.failedAttempts + 1;
    if (attempts >= 5) {
      set({ failedAttempts: 0, lockedUntilMs: Date.now() + LOCKOUT_MS });
    } else {
      set({ failedAttempts: attempts });
    }
    return false;
  },
  tryUnlockWithBiometric: async () => {
    const enabled = await isBiometricEnabled();
    if (!enabled) return false;
    const ok = await authenticateWithBiometric();
    if (ok) {
      set({ locked: false, failedAttempts: 0, lockedUntilMs: null });
      return true;
    }
    return false;
  },
}));

export const BG_LOCK_THRESHOLD_MS = BG_THRESHOLD_MS;
