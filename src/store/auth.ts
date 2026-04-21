import { create } from "zustand";
import { persist } from "zustand/middleware";

// ============================================================
// 🔐 НАСТРОЙКИ ДОСТУПА В АДМИНКУ
// ============================================================
//
// 1) ПАРОЛЬ для входа (резервный способ).
//    Замените значение ниже на свой пароль.
const ADMIN_PASSWORD = "loveshop2025";

// 2) СПИСОК TELEGRAM ID, которым разрешён вход в админку.
//    Узнать свой ID можно у бота @userinfobot в Telegram.
//    Добавляйте свои ID через запятую. Примеры:
//
//    const ADMIN_TELEGRAM_IDS: number[] = [123456789];
//    const ADMIN_TELEGRAM_IDS: number[] = [123456789, 987654321];
//
const ADMIN_TELEGRAM_IDS: number[] = [
  8044243116, // основной админ
];

// ============================================================

export const MAX_ATTEMPTS = 5;
export const LOCKOUT_MS = 5 * 60 * 1000; // 5 минут блокировки после 5 неверных попыток


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
        if (pwd && pwd === ADMIN_PASSWORD) {
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
        if (tgUserId && ADMIN_TELEGRAM_IDS.includes(tgUserId)) {
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
