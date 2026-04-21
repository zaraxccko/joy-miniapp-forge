import { create } from "zustand";
import { persist } from "zustand/middleware";

// Default password (override by editing this file or via VITE_ADMIN_PASSWORD env var).
// Also you can grant admin to specific Telegram user IDs via VITE_ADMIN_TG_IDS (comma-separated).
const ENV_PASSWORD = (import.meta.env.VITE_ADMIN_PASSWORD as string | undefined) ?? "loveshop2025";
const ENV_TG_IDS = ((import.meta.env.VITE_ADMIN_TG_IDS as string | undefined) ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .map(Number);

export const MAX_ATTEMPTS = 5;
export const LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes

interface AuthState {
  isAdmin: boolean;
  failedAttempts: number;
  lockedUntil: number | null; // epoch ms
  loginWithPassword: (pwd: string) => { ok: boolean; locked: boolean; remaining: number };
  loginWithTelegram: (tgUserId?: number | null) => boolean;
  logout: () => void;
  getLockRemainingMs: () => number;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      isAdmin: false,
      failedAttempts: 0,
      lockedUntil: null,
      getLockRemainingMs: () => {
        const { lockedUntil } = get();
        if (!lockedUntil) return 0;
        return Math.max(0, lockedUntil - Date.now());
      },
      loginWithPassword: (pwd) => {
        const state = get();
        const now = Date.now();
        if (state.lockedUntil && state.lockedUntil > now) {
          return { ok: false, locked: true, remaining: state.lockedUntil - now };
        }
        // Lock expired — reset counter
        if (state.lockedUntil && state.lockedUntil <= now) {
          set({ lockedUntil: null, failedAttempts: 0 });
        }
        if (pwd && pwd === ENV_PASSWORD) {
          set({ isAdmin: true, failedAttempts: 0, lockedUntil: null });
          return { ok: true, locked: false, remaining: 0 };
        }
        const attempts = state.failedAttempts + 1;
        if (attempts >= MAX_ATTEMPTS) {
          const until = now + LOCKOUT_MS;
          set({ failedAttempts: attempts, lockedUntil: until });
          return { ok: false, locked: true, remaining: LOCKOUT_MS };
        }
        set({ failedAttempts: attempts });
        return { ok: false, locked: false, remaining: 0 };
      },
      loginWithTelegram: (tgUserId) => {
        if (tgUserId && ENV_TG_IDS.includes(tgUserId)) {
          set({ isAdmin: true, failedAttempts: 0, lockedUntil: null });
          return true;
        }
        return false;
      },
      logout: () => set({ isAdmin: false }),
    }),
    { name: "loveshop-auth" }
  )
);
