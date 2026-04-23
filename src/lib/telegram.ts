import { useEffect, useState } from "react";

interface TgUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe?: { user?: TgUser };
  ready: () => void;
  expand: () => void;
  close: () => void;
  colorScheme: "light" | "dark";
  themeParams: Record<string, string>;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  HapticFeedback?: {
    impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
    notificationOccurred: (type: "error" | "success" | "warning") => void;
    selectionChanged: () => void;
  };
  MainButton: {
    text: string;
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
    setText: (t: string) => void;
    enable: () => void;
    disable: () => void;
  };
  BackButton: {
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function getTg(): TelegramWebApp | null {
  return typeof window !== "undefined" ? window.Telegram?.WebApp ?? null : null;
}

export function useTelegram() {
  const [tg, setTg] = useState<TelegramWebApp | null>(null);
  const [user, setUser] = useState<TgUser | null>(null);

  useEffect(() => {
    const webapp = getTg();
    if (webapp) {
      webapp.ready();
      webapp.expand();
      try {
        webapp.setHeaderColor("#fff5f0");
        webapp.setBackgroundColor("#fff5f0");
      } catch {}
      setTg(webapp);
      setUser(webapp.initDataUnsafe?.user ?? null);
    }
  }, []);

  return { tg, user, isInTelegram: !!tg };
}

export function haptic(type: "light" | "medium" | "success" | "warning" | "error" = "light") {
  const tg = getTg();
  if (!tg?.HapticFeedback) return;
  if (type === "success" || type === "warning" || type === "error") {
    tg.HapticFeedback.notificationOccurred(type);
  } else {
    tg.HapticFeedback.impactOccurred(type);
  }
}
