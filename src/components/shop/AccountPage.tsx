import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Package,
  User as UserIcon,
  ShoppingBag,
  Clock,
  MessageCircle,
  Repeat,
} from "lucide-react";
import { toast } from "sonner";
import { useAccount, type OrderRecord } from "@/store/account";
import { useCart, RESERVATION_MS } from "@/store/cart";
import { useI18n } from "@/lib/i18n";
import { useTelegram, haptic } from "@/lib/telegram";
import { useCatalog } from "@/store/catalog";
import { formatTHB } from "@/lib/format";
import { loc } from "@/lib/loc";

interface AccountPageProps {
  onBack: () => void;
  onOpenCart: () => void;
  onOpenActiveOrder: () => void;
}

const statusMeta = {
  awaiting:    { ru: "Ожидание",    en: "Awaiting",    cls: "bg-amber-500/15 text-amber-600" },
  paid:        { ru: "Оплачен",     en: "Paid",        cls: "bg-emerald-500/15 text-emerald-600" },
  in_delivery: { ru: "В доставке",  en: "In delivery", cls: "bg-amber-500/15 text-amber-600" },
  completed:   { ru: "Оплачен",     en: "Paid",        cls: "bg-emerald-500/15 text-emerald-600" },
  cancelled:   { ru: "Отменён",     en: "Cancelled",   cls: "bg-destructive/15 text-destructive" },
} as const;

type HistoryFilter = "all" | "confirmed" | "cancelled";

const SUPPORT_USERNAME = "oxescrow";

export const AccountPage = ({ onBack, onOpenCart, onOpenActiveOrder }: AccountPageProps) => {
  const lang = useI18n((s) => s.lang) ?? "ru";
  const { user, tg } = useTelegram();
  const orders = useAccount((s) => s.orders);
  const hydrate = useAccount((s) => s.hydrate);
  const products = useCatalog((s) => s.products);
  const cartLines = useCart((s) => s.lines);
  const cartTotal = useCart((s) => s.totalTHB());
  const cartId = useCart((s) => s.cartId);
  const reservedAt = useCart((s) => s.reservedAt);
  const clearCart = useCart((s) => s.clear);
  const addToCart = useCart((s) => s.add);

  const tr = (ru: string, en: string) => (lang === "ru" ? ru : en);

  // ── Авто-рефреш ───────────────────────────────────────────────
  useEffect(() => {
    hydrate();
    const tick = () => { if (!document.hidden) hydrate(); };
    const interval = setInterval(tick, 5000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, [hydrate]);

  // ── Активный/подтверждённый заказ ─────────────────────────────
  const activeOrder =
    orders.find((o) => o.status === "awaiting") ??
    orders.find((o) => (o.status === "completed" || o.status === "paid" || o.status === "in_delivery") && (o.confirmPhoto || o.confirmText)) ??
    null;
  const awaitingOrder = activeOrder?.status === "awaiting" ? activeOrder : null;
  const confirmedOrder = activeOrder && activeOrder.status !== "awaiting" ? activeOrder : null;
  const allHistory = orders.filter((o) => o.id !== confirmedOrder?.id);

  // ── Фильтр истории ────────────────────────────────────────────
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const historyOrders = useMemo(() => {
    if (filter === "all") return allHistory;
    if (filter === "confirmed")
      return allHistory.filter((o) => o.status === "completed" || o.status === "paid" || o.status === "in_delivery");
    return allHistory.filter((o) => o.status === "cancelled");
  }, [allHistory, filter]);

  // ── Резерв корзины ────────────────────────────────────────────
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!reservedAt || cartLines.length === 0) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [reservedAt, cartLines.length]);

  const msLeft = reservedAt ? Math.max(0, reservedAt + RESERVATION_MS - now) : 0;
  useEffect(() => {
    if (reservedAt && cartLines.length > 0 && msLeft === 0) clearCart();
  }, [msLeft, reservedAt, cartLines.length, clearCart]);

  const mm = String(Math.floor(msLeft / 60000)).padStart(2, "0");
  const ss = String(Math.floor((msLeft % 60000) / 1000)).padStart(2, "0");

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString(lang === "ru" ? "ru-RU" : "en-US", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });

  const displayName = user?.first_name
    ? `${user.first_name}${user.last_name ? " " + user.last_name : ""}`
    : user?.username ? `@${user.username}` : tr("Гость", "Guest");
  const initials = (user?.first_name?.[0] ?? user?.username?.[0] ?? "G").toUpperCase();

  // ── Повторить заказ ───────────────────────────────────────────
  const repeatOrder = (o: OrderRecord) => {
    let added = 0;
    for (const line of o.items) {
      if ((line as any).isGift) continue;
      const pid = line.product?.id ?? (line as any).productId;
      if (!pid) continue;
      const product = products.find((p) => p.id === pid) ?? line.product;
      if (!product) continue;
      for (let i = 0; i < line.qty; i++) {
        addToCart(product, {
          variantId: line.variantId,
          districtSlug: line.districtSlug,
          stashType: line.stashType,
          priceUSD: line.priceUSD,
        });
      }
      added++;
    }
    if (added === 0) {
      toast.error(tr("Нечего повторить", "Nothing to repeat"));
      return;
    }
    haptic("light");
    toast.success(tr("Добавлено в корзину", "Added to cart"));
    onOpenCart();
  };

  // ── Поддержка ────────────────────────────────────────────────
  const openSupport = () => {
    haptic("light");
    const url = `https://t.me/${SUPPORT_USERNAME}`;
    const tgAny = tg as any;
    const version = parseFloat(tgAny?.version ?? "6.0");

    // openTelegramLink надёжно работает с версии 6.1+
    if (tgAny?.openTelegramLink && version >= 6.1) {
      try {
        tgAny.openTelegramLink(url);
        return;
      } catch {}
    }
    // openLink работает в более старых версиях WebApp
    if (tgAny?.openLink) {
      try {
        tgAny.openLink(url, { try_instant_view: false });
        return;
      } catch {}
    }
    // Fallback для браузера / iframe-превью
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="min-h-screen max-w-md mx-auto bg-background">
      <header className="sticky top-0 z-30 px-5 pt-5 pb-3 bg-background/80 backdrop-blur-xl flex items-center gap-3">
        <button
          onClick={() => { haptic("light"); onBack(); }}
          className="w-10 h-10 rounded-2xl bg-card shadow-card flex items-center justify-center active:scale-95"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="font-display font-bold text-lg">{tr("Личный кабинет", "Account")}</div>
      </header>

      <main className="px-5 pb-32 space-y-5">
        <section className="rounded-2xl bg-card shadow-card p-4 flex items-center gap-3">
          {user?.photo_url ? (
            <img src={user.photo_url} alt={displayName} className="w-12 h-12 rounded-2xl object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-2xl gradient-primary text-primary-foreground flex items-center justify-center font-bold">
              {user?.first_name || user?.username ? initials : <UserIcon className="w-6 h-6" />}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-bold truncate">{displayName}</div>
            <div className="text-[11px] text-muted-foreground">
              {user?.id ? `Telegram ID: ${user.id}` : tr("Не из Telegram", "Not from Telegram")}
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-2">
            <div className="font-display font-bold text-lg flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" /> {tr("Активный заказ", "Active order")}
            </div>
            {cartLines.length > 0 && !awaitingOrder && !confirmedOrder && (
              <button onClick={onOpenActiveOrder} className="text-xs font-bold text-primary">
                {tr("Открыть", "Open")}
              </button>
            )}
          </div>
          {awaitingOrder ? (
            <div className="w-full rounded-2xl bg-card shadow-card p-4 space-y-2 opacity-90">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-mono font-bold text-muted-foreground">#{awaitingOrder.id}</div>
                <span className="text-[11px] font-bold rounded-full px-2.5 py-1 bg-amber-500/15 text-amber-600">
                  {tr("Ждём подтверждения", "Waiting for confirmation")}
                </span>
              </div>
              <div className="font-display font-bold text-xl">{formatTHB(awaitingOrder.totalUSD)}</div>
              <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 text-amber-600 px-3 py-2">
                <Clock className="w-4 h-4" />
                <div className="text-[11px] font-bold">
                  {tr("Заявка отправлена — ждите ответа администратора", "Submitted — waiting for admin response")}
                </div>
              </div>
            </div>
          ) : confirmedOrder ? (
            <div className="w-full rounded-2xl bg-card shadow-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-mono font-bold text-muted-foreground">#{confirmedOrder.id}</div>
                <span className="text-[11px] font-bold rounded-full px-2.5 py-1 bg-emerald-500/15 text-emerald-600">
                  {tr("Оплата подтверждена", "Payment confirmed")}
                </span>
              </div>
              <div className="font-display font-bold text-xl">{formatTHB(confirmedOrder.totalUSD)}</div>
              <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wide text-primary">
                  {tr("Данные от магазина", "Details from shop")}
                </div>
                {confirmedOrder.confirmPhoto && (
                  <a href={confirmedOrder.confirmPhoto} target="_blank" rel="noreferrer" className="block">
                    <img src={confirmedOrder.confirmPhoto} alt="confirm" className="w-full max-h-72 object-cover rounded-lg" />
                  </a>
                )}
                {confirmedOrder.confirmText && (
                  <div className="text-sm text-foreground/90 whitespace-pre-wrap">{confirmedOrder.confirmText}</div>
                )}
              </div>
            </div>
          ) : cartLines.length === 0 ? (
            <div className="rounded-2xl bg-card shadow-card p-4 text-sm text-muted-foreground text-center">
              {tr("Корзина пуста", "Cart is empty")}
            </div>
          ) : (
            <button onClick={onOpenActiveOrder} className="w-full rounded-2xl bg-card shadow-card p-4 text-left active:scale-[0.99] space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-mono font-bold text-muted-foreground">#{cartId}</div>
                <div className="text-[11px] text-muted-foreground">{cartLines.length} {tr("позиций", "items")}</div>
              </div>
              <div className="font-display font-bold text-xl">{formatTHB(cartTotal)}</div>
              {reservedAt > 0 && (
                <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 text-amber-600 px-3 py-2">
                  <Clock className="w-4 h-4" />
                  <div className="text-[11px] font-bold">{tr("Зарезервировано", "Reserved")} · {mm}:{ss}</div>
                </div>
              )}
            </button>
          )}
        </section>

        {/* ── История заказов ───────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <div className="font-display font-bold text-lg flex items-center gap-2">
              <Package className="w-4 h-4" /> {tr("История заказов", "Order history")}
            </div>
          </div>

          {allHistory.length > 0 && (
            <div className="flex gap-1.5 mb-3 p-1 rounded-2xl bg-muted">
              {([
                ["all", tr("Все", "All")],
                ["confirmed", tr("Подтв.", "Confirmed")],
                ["cancelled", tr("Отмен.", "Cancelled")],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`flex-1 h-8 rounded-xl text-xs font-bold transition-colors ${
                    filter === key ? "bg-card text-foreground shadow-card" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {historyOrders.length === 0 ? (
            <div className="rounded-2xl bg-card shadow-card p-4 text-sm text-muted-foreground text-center">
              {allHistory.length === 0
                ? tr("Заказов пока нет", "No orders yet")
                : tr("Ничего не найдено", "Nothing found")}
            </div>
          ) : (
            <div className="space-y-2">
              {historyOrders.slice(0, 20).map((o) => {
                const m = statusMeta[o.status];
                const canRepeat = o.status !== "awaiting" && o.items.length > 0;
                return (
                  <div key={o.id} className="rounded-2xl bg-card shadow-card p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-mono font-bold text-muted-foreground">#{o.id}</div>
                      <span className={`text-[11px] font-bold rounded-full px-2.5 py-1 ${m.cls}`}>{m[lang]}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="font-bold">{formatTHB(o.totalUSD)}</div>
                      <div className="text-[11px] text-muted-foreground">{fmtDate(o.createdAt)}</div>
                    </div>
                    <div className="mt-2 text-xs text-foreground/80 line-clamp-2">
                      {o.items.map((l) => `${loc(l.product?.name, lang)}${l.variantId ? " · " + l.variantId : ""} × ${l.qty}`).join(" · ")}
                    </div>
                    {o.delivery && (
                      <div className="text-[11px] text-muted-foreground mt-1">
                        🚚 {tr("Доставка", "Delivery")}{o.deliveryAddress ? ` · ${o.deliveryAddress}` : ""}
                      </div>
                    )}
                    {(o.confirmPhoto || o.confirmText) && (
                      <div className="mt-2 rounded-xl bg-primary/5 border border-primary/20 p-2.5 space-y-2">
                        <div className="text-[10px] font-bold uppercase tracking-wide text-primary">
                          {tr("Сообщение от магазина", "Message from shop")}
                        </div>
                        {o.confirmPhoto && (
                          <a href={o.confirmPhoto} target="_blank" rel="noreferrer" className="block">
                            <img src={o.confirmPhoto} alt="confirm" className="w-full max-h-64 object-cover rounded-lg" />
                          </a>
                        )}
                        {o.confirmText && (
                          <div className="text-xs text-foreground/90 whitespace-pre-wrap">{o.confirmText}</div>
                        )}
                      </div>
                    )}
                    {canRepeat && (
                      <button
                        onClick={() => repeatOrder(o)}
                        className="mt-3 w-full h-9 rounded-xl bg-primary/10 text-primary font-bold text-xs flex items-center justify-center gap-2 active:scale-[0.98]"
                      >
                        <Repeat className="w-3.5 h-3.5" /> {tr("Повторить заказ", "Repeat order")}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Поддержка ──────────────────────────────────────── */}
        <section>
          <button
            type="button"
            onClick={openSupport}
            className="w-full rounded-2xl bg-card shadow-card p-4 flex items-center gap-3 active:scale-[0.99]"
          >
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-bold text-sm">{tr("Поддержка", "Support")}</div>
              <div className="text-[11px] text-muted-foreground">
                {tr("Написать оператору в Telegram", "Message an operator on Telegram")}
              </div>
            </div>
          </button>
        </section>
      </main>
    </div>
  );
};
