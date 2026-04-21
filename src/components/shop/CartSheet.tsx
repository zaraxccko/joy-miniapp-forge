import { Minus, Plus, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCart, lineKey } from "@/store/cart";
import { formatTHB } from "@/lib/format";
import { haptic } from "@/lib/telegram";
import { useI18n, useT } from "@/lib/i18n";
import { loc } from "@/lib/loc";

interface CartSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCheckout: () => void;
}

const CRYPTO_OPTIONS = [
  { symbol: "BTC", name: "Bitcoin" },
  { symbol: "TRX", name: "Tron" },
  { symbol: "SOL", name: "Solana" },
  { symbol: "TON", name: "Toncoin" },
  { symbol: "USDT", name: "Tether" },
];

export const CartSheet = ({ open, onOpenChange, onCheckout }: CartSheetProps) => {
  const lines = useCart((s) => s.lines);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const total = useCart((s) => s.totalTHB());
  const t = useT();
  const lang = useI18n((s) => s.lang) ?? "ru";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-0 p-0 max-h-[90vh] flex flex-col bg-background"
      >
        <SheetHeader className="px-5 pt-4 pb-2">
          <div className="w-12 h-1.5 rounded-full bg-muted mx-auto mb-3" />
          <SheetTitle className="font-display text-2xl text-left">{t("cart.title")}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 pb-4">
          {lines.length === 0 ? (
            <div className="py-16 text-center">
              <div className="text-6xl mb-3">🛍️</div>
              <div className="font-semibold">{t("cart.empty.title")}</div>
              <div className="text-sm text-muted-foreground mt-1">{t("cart.empty.sub")}</div>
            </div>
          ) : (
            <div className="space-y-3">
              {lines.map((line) => {
                const key = lineKey(line);
                const unit = line.priceUSD ?? line.product.priceTHB ?? 0;
                const variantLabel = line.variantId ? ` · ${line.variantId}` : "";
                return (
                  <div
                    key={key}
                    className="bg-card rounded-2xl p-3 flex items-center gap-3 shadow-card"
                  >
                    <div
                      className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden ${!line.product.imageUrl ? line.product.gradient : ""}`}
                    >
                      {line.product.imageUrl ? (
                        <img src={line.product.imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-3xl">{line.product.emoji}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm leading-tight line-clamp-2">
                        {loc(line.product.name, lang)}
                        <span className="text-muted-foreground font-normal">{variantLabel}</span>
                      </div>
                      <div className="text-primary font-bold text-sm mt-1">
                        {formatTHB(unit * line.qty)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 bg-background rounded-full p-1">
                      <button
                        onClick={() => {
                          haptic("light");
                          if (line.qty === 1) remove(key);
                          else setQty(key, line.qty - 1);
                        }}
                        className="w-7 h-7 rounded-full bg-card flex items-center justify-center active:scale-90 transition-[var(--transition-base)]"
                        aria-label="-"
                      >
                        {line.qty === 1 ? (
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        ) : (
                          <Minus className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <span className="w-5 text-center font-bold text-sm">{line.qty}</span>
                      <button
                        onClick={() => {
                          haptic("light");
                          setQty(key, line.qty + 1);
                        }}
                        className="w-7 h-7 rounded-full gradient-primary text-primary-foreground flex items-center justify-center active:scale-90 transition-[var(--transition-base)] disabled:opacity-40"
                        aria-label="+"
                      >
                        <Plus className="w-3.5 h-3.5" strokeWidth={3} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {lines.length > 0 && (
          <div className="px-5 pt-3 pb-6 border-t border-border bg-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-muted-foreground">{t("cart.total")}</span>
              <span className="font-display font-bold text-2xl">{formatTHB(total)}</span>
            </div>

            <button
              onClick={() => {
                haptic("medium");
                onCheckout();
              }}
              className="w-full gradient-primary text-primary-foreground font-bold py-4 rounded-2xl shadow-glow active:scale-[0.98] transition-[var(--transition-base)]"
            >
              {t("cart.checkout")}
            </button>

            <div className="mt-4">
              <div className="text-[11px] text-muted-foreground text-center mb-2">
                {lang === "ru" ? "Принимаем к оплате" : "We accept"}
              </div>
              <div className="flex flex-wrap justify-center gap-1.5">
                {CRYPTO_OPTIONS.map((c) => (
                  <span
                    key={c.symbol}
                    className="text-[10px] font-bold bg-background border border-border rounded-full px-2.5 py-1 text-foreground/80"
                    title={c.name}
                  >
                    {c.symbol}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
