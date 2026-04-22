// ============================================================
// 🪪 Сессия пользователя (после логина через Telegram initData)
// ============================================================
import { create } from "zustand";
import { Auth, tokenStore, type MeUser } from "@/lib/api";

interface SessionState {
  user: MeUser | null;
  loading: boolean;
  error: string | null;
  /** Авторизация по Telegram initData (вызывается из Index.tsx). */
  loginWithInitData: (initData: string) => Promise<MeUser | null>;
  /** Подгрузить /me по существующему токену. */
  refreshMe: () => Promise<void>;
  logout: () => void;
}

export const useSession = create<SessionState>((set, get) => ({
  user: null,
  loading: false,
  error: null,

  loginWithInitData: async (initData) => {
    set({ loading: true, error: null });
    try {
      const { token, user } = await Auth.loginWithTelegram(initData);
      tokenStore.set(token);
      set({ user, loading: false });
      return user;
    } catch (e: any) {
      set({ loading: false, error: e?.message ?? "login_failed" });
      return null;
    }
  },

  refreshMe: async () => {
    if (!tokenStore.get()) return;
    try {
      const user = await Auth.me();
      set({ user });
    } catch {
      tokenStore.set(null);
      set({ user: null });
    }
  },

  logout: () => {
    tokenStore.set(null);
    set({ user: null });
  },
}));

// Удобный селектор
export const selectIsAdmin = (s: SessionState) => !!s.user?.isAdmin;
