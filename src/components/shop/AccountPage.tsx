import { useEffect, useState } from "react";
import { ArrowLeft, Wallet, Plus, Package, Receipt, User as UserIcon, ShoppingBag, Clock } from "lucide-react";
import { useAccount } from "@/store/account";
import { useCart, RESERVATION_MS } from "@/store/cart";
import { useI18n } from "@/lib/i18n";
import { useTelegram, haptic } from "@/lib/telegram";
import { formatTHB } from "@/lib/format";
import { loc } from "@/lib/loc";

interface AccountPageProps {
  onBack: () => void;
  onTopUp: () => void;
  onOpenCart: () => void;
  /** Открыть страницу оплаты текущего активного заказа. */
  onOpenActiveOrder: () => void;
}

const statusMeta = {
  awaiting:    { ru: "Ожидает",     en: "Pending",     cls: "bg-amber-500/15 text-amber-600" },
  paid:        { ru: "Оплачен",     en: "Paid",        cls: "bg-primary/15 text-primary" },
  in_delivery: { ru: "В доставке",  en: "In delivery", cls: "bg-amber-500/15 text-amber-600" },
  completed:   { ru: "Получен",     en: "Completed",   cls: "bg-emerald-500/15 text-emerald-600" },
  cancelled:   { ru: "Отменён",     en: "Cancelled",   cls: "bg-destructive/15 text-destructive" },
} as const;

const depStatusMeta = {
  pending:   { ru: "Не оплачен",   en: "Unpaid",    cls: "bg-muted text-muted-foreground" },
  awaiting:  { ru: "Ожидает",      en: "Pending",   cls: "bg-amber-500/15 text-amber-600" },
  confirmed: { ru: "Зачислено",    en: "Confirmed", cls: "bg-emerald-500/15 text-emerald-600" },
  cancelled: { ru: "Отменено",     en: "Cancelled", cls: "bg-muted text-muted-foreground" },
} as const;

export const AccountPage = ({ onBack, onTopUp, onOpenCart, onOpenActiveOrder }: AccountPageProps) => {
  const lang = useI18n((s) => s.lang) ?? "ru";
  const { user } = useTelegram();
  const balance = useAccount((s) => s.balanceUSD);
  const orders = useAccount((s) => s.orders);
  const deposits = useAccount((s) => s.deposits);
  const cartLines = useCart((s) => s.lines);
  const cartTotal = useCart((s) => s.totalTHB());
  const cartId = useCart((s) => s.cartId);
  const reservedAt = useCart((s) => s.reservedAt);
  const clearCart = useCart((s) => s.clear);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!reservedAt || cartLines.length === 0) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [reservedAt, cartLines.length]);

  const msLeft = reservedAt ? Math.max(0, reservedAt + RESERVATION_MS - now) : 0;
  useEffect(() => {
    if (reservedAt && cartLines.length > 0 && msLeft === 0) {
      clearCart();
    }
  }, [msLeft, reservedAt, cartLines.length, clearCart]);

  const mm = String(Math.floor(msLeft / 60000)).padStart(2, "0");
  const ss = String(Math.floor((msLeft % 60000) / 1000)).padStart(2, "0");

  const tr = (ru: string, en: string) => (lang === "ru" ? ru : en);
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString(lang === "ru" ? "ru-RU" : "en-US", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });

  const displayName = user?.first_name
    ? `${user.first_name}${user.last_name ? " " + user.last_name : ""}`
    : user?.username
      ? `@${user.username}`
      : tr("Гость", "Guest");

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
        {/* Profile */}
        <section className="rounded-2xl bg-card shadow-card p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl gradient-primary text-primary-foreground flex items-center justify-center">
            <UserIcon className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold truncate">{displayName}</div>
            <div className="text-[11px] text-muted-foreground">
              {user?.id ? `Telegram ID: ${user.id}` : tr("Не из Telegram", "Not from Telegram")}
            </div>
          </div>
        </section>

        {/* Balance */}
        <section className="rounded-2xl gradient-primary text-primary-foreground p-5 shadow-glow">
          <div className="flex items-center gap-2 text-xs opacity-80">
            <Wallet className="w-4 h-4" />
            {tr("Баланс", "Balance")}
          </div>
          <div className="font-display font-bold text-3xl mt-1">{formatTHB(balance)}</div>
          <button
            onClick={() => { haptic("medium"); onTopUp(); }}
            className="mt-3 w-full bg-primary-foreground/15 hover:bg-primary-foreground/25 transition-colors rounded-xl py-2.5 font-bold text-sm flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> {tr("Пополнить", "Top up")}
          </button>
        </section>

        {/* Active cart */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <div className="font-display font-bold text-lg flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" /> {tr("Активный заказ", "Active order")}
            </div>
            {cartLines.length > 0 && (
              <button onClick={onOpenActiveOrder} className="text-xs font-bold text-primary">
                {tr("Открыть", "Open")}
              </button>
            )}
          </div>
          {cartLines.length === 0 ? (
            <div className="rounded-2xl bg-card shadow-card p-4 text-sm text-muted-foreground text-center">
              {tr("Корзина пуста", "Cart is empty")}
            </div>
          ) : (
            <button
              onClick={onOpenActiveOrder}
              className="w-full rounded-2xl bg-card shadow-card p-4 text-left active:scale-[0.99] space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-mono font-bold text-muted-foreground">
                  #{cartId}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {cartLines.length} {tr("позиций", "items")}
                </div>
              </div>
              <div className="font-display font-bold text-xl">{formatTHB(cartTotal)}</div>
              {reservedAt > 0 && (
                <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 text-amber-600 px-3 py-2">
                  <Clock className="w-4 h-4" />
                  <div className="text-[11px] font-bold">
                    {tr("Зарезервировано", "Reserved")} · {mm}:{ss}
                  </div>
                </div>
              )}
            </button>
          )}
        </section>

        {/* Deposits */}
        <section>
          <div className="font-display font-bold text-lg mb-2 flex items-center gap-2">
            <Receipt className="w-4 h-4" /> {tr("Пополнения", "Top-ups")}
          </div>
          {deposits.length === 0 ? (
            <div className="rounded-2xl bg-card shadow-card p-4 text-sm text-muted-foreground text-center">
              {tr("Пока нет пополнений", "No top-ups yet")}
            </div>
          ) : (
            <div className="space-y-2">
              {deposits.slice(0, 10).map((d) => {
                const m = depStatusMeta[d.status];
                return (
                  <div key={d.id} className="rounded-2xl bg-card shadow-card p-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="font-bold">{formatTHB(d.amountUSD)} <span className="text-xs text-muted-foreground font-normal">· {d.crypto}</span></div>
                      <div className="text-[11px] text-muted-foreground">{fmtDate(d.createdAt)}</div>
                    </div>
                    <span className={`text-[11px] font-bold rounded-full px-2.5 py-1 ${m.cls}`}>
                      {m[lang]}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Orders */}
        <section>
          <div className="font-display font-bold text-lg mb-2 flex items-center gap-2">
            <Package className="w-4 h-4" /> {tr("История заказов", "Order history")}
          </div>
          {orders.length === 0 ? (
            <div className="rounded-2xl bg-card shadow-card p-4 text-sm text-muted-foreground text-center">
              {tr("Заказов пока нет", "No orders yet")}
            </div>
          ) : (
            <div className="space-y-2">
              {orders.map((o) => {
                const m = statusMeta[o.status];
                return (
                  <div key={o.id} className="rounded-2xl bg-card shadow-card p-3">
                    <div className="flex items-center justify-between">
                      <div className="font-bold">{formatTHB(o.totalUSD)}</div>
                      <span className={`text-[11px] font-bold rounded-full px-2.5 py-1 ${m.cls}`}>
                        {m[lang]}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{fmtDate(o.createdAt)}</div>
                    <div className="mt-2 text-xs text-foreground/80 line-clamp-2">
                      {o.items.map((l) => `${loc(l.product.name, lang)}${l.variantId ? " · " + l.variantId : ""} × ${l.qty}`).join(" · ")}
                    </div>
                    {o.delivery && (
                      <div className="text-[11px] text-muted-foreground mt-1">
                        🚚 {tr("Доставка", "Delivery")}{o.deliveryAddress ? ` · ${o.deliveryAddress}` : ""}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
