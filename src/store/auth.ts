// ============================================================
// 🔐 Тонкая обёртка над session — админ определяется только сервером.
// Реальная авторизация: src/store/session.ts (через Telegram initData).
// ============================================================
import { useSession } from "./session";

export const useAuth = () => {
  const user = useSession((s) => s.user);
  const logout = useSession((s) => s.logout);
  const isAdmin = !!user?.isAdmin;

  return {
    isAdmin,
    /** Заглушка для совместимости со старым кодом. Реальный вход — через session.loginWithInitData. */
    loginWithTelegram: (_tgId?: number | null) => isAdmin,
    logout,
  };
};
