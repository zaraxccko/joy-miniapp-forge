import { useState } from "react";
import { Send, Check, Loader2 } from "lucide-react";
import { REQUIRED_CHANNEL, useSubscription } from "@/store/subscription";
import { useI18n } from "@/lib/i18n";
import { haptic } from "@/lib/telegram";
import { toast } from "sonner";

/**
 * Экран-заглушка перед магазином: пока юзер не подписан на канал —
 * он сюда возвращается.
 */
export const SubscriptionGate = () => {
  const lang = useI18n((s) => s.lang) ?? "ru";
  const check = useSubscription((s) => s.check);
  const [loading, setLoading] = useState(false);
  const tr = (ru: string, en: string) => (lang === "ru" ? ru : en);

  const onCheck = async () => {
    setLoading(true);
    haptic("light");
    const ok = await check();
    setLoading(false);
    if (ok) {
      haptic("success");
      toast.success(tr("Готово! Добро пожаловать", "All set! Welcome"));
    } else {
      haptic("error");
      toast.error(tr("Подписка не найдена", "Subscription not found"));
    }
  };

  return (
    <div className="min-h-screen max-w-md mx-auto bg-background flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="w-24 h-24 rounded-3xl gradient-primary shadow-glow flex items-center justify-center mb-6">
        <Send className="w-11 h-11 text-primary-foreground" />
      </div>

      <h1 className="font-display font-extrabold text-3xl leading-tight">
        {tr("Подпишись на канал", "Subscribe to channel")}
      </h1>
      <p className="text-muted-foreground mt-3 text-sm leading-relaxed max-w-xs">
        {tr(
          "Чтобы войти в магазин, подпишись на наш Telegram-канал — там акции, новинки и важные апдейты.",
          "To enter the shop, subscribe to our Telegram channel — promos, drops, and important updates."
        )}
      </p>

      <div className="mt-6 w-full bg-card rounded-2xl shadow-card p-4 flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
          @
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="font-bold truncate">{REQUIRED_CHANNEL.title}</div>
          <div className="text-xs text-muted-foreground truncate">
            @{REQUIRED_CHANNEL.username}
          </div>
        </div>
      </div>

      <a
        href={REQUIRED_CHANNEL.url}
        target="_blank"
        rel="noreferrer"
        onClick={() => haptic("light")}
        className="mt-5 w-full gradient-primary text-primary-foreground font-bold py-4 rounded-2xl shadow-glow active:scale-[0.98] flex items-center justify-center gap-2"
      >
        <Send className="w-5 h-5" />
        {tr("Открыть канал", "Open channel")}
      </a>

      <button
        onClick={onCheck}
        disabled={loading}
        className="mt-3 w-full bg-card border border-border font-bold py-4 rounded-2xl active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Check className="w-5 h-5" />
        )}
        {tr("Я подписался", "I subscribed")}
      </button>

      <p className="text-[11px] text-muted-foreground mt-4 max-w-xs">
        {tr(
          "Проверка занимает пару секунд. Если не сработало — обнови подписку и нажми ещё раз.",
          "Check takes a couple of seconds. If it didn't work — refresh subscription and tap again."
        )}
      </p>
    </div>
  );
};
