import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Подписка на Telegram-канал — обязательное условие входа в магазин.
 *
 * Реальная проверка делается ботом на VPS (метод getChatMember).
 * Здесь — клиентская заглушка, которую при подключении бэка
 * нужно заменить вызовом /api/check-subscription.
 */

/** ⚠️ Поменяйте на свой канал. Без `@`. */
export const REQUIRED_CHANNEL = {
  username: "your_channel",
  title: "Наш канал",
  url: "https://t.me/your_channel",
};

interface SubscriptionState {
  subscribed: boolean;
  lastCheckedAt: number | null;
  /** Имитация запроса к боту. true = подписан. */
  check: () => Promise<boolean>;
  /** Используется в DEV / для отладки. */
  setSubscribed: (v: boolean) => void;
}

export const useSubscription = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      subscribed: false,
      lastCheckedAt: null,
      check: async () => {
        // TODO: заменить на fetch('/api/check-subscription', { tgId })
        await new Promise((r) => setTimeout(r, 700));
        // Мок: 70% вероятность что юзер подписался.
        const ok = Math.random() < 0.7;
        set({ subscribed: ok, lastCheckedAt: Date.now() });
        return ok;
      },
      setSubscribed: (v) => set({ subscribed: v, lastCheckedAt: Date.now() }),
    }),
    { name: "loveshop-subscription" }
  )
);
