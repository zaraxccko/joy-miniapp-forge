import { useMemo, useState } from "react";
import { ArrowLeft, Check, Copy, Clock } from "lucide-react";
import { CRYPTO_LIST, useAccount, type CryptoCode } from "@/store/account";
import { useAccount as useAcc2 } from "@/store/account";
import { useI18n } from "@/lib/i18n";
import { haptic } from "@/lib/telegram";
import { formatTHB } from "@/lib/format";
import { toast } from "sonner";

interface DepositPageProps {
  onBack: () => void;
  /** Suggested top-up amount (e.g. shortfall to cover an order) */
  suggested?: number;
}

const QUICK = [20, 50, 100, 200, 500];

export const DepositPage = ({ onBack, suggested }: DepositPageProps) => {
  const lang = useI18n((s) => s.lang) ?? "ru";
  const balance = useAccount((s) => s.balanceUSD);
  const createDeposit = useAccount((s) => s.createDeposit);
  const confirmDeposit = useAccount((s) => s.confirmDeposit);
  const cancelDeposit = useAccount((s) => s.cancelDeposit);
  void useAcc2((s) => s.deposits);

  const [amount, setAmount] = useState<number>(suggested && suggested > 0 ? Math.ceil(suggested) : 50);
  const [crypto, setCrypto] = useState<CryptoCode>("USDT");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const cryptoMeta = useMemo(() => CRYPTO_LIST.find((c) => c.code === crypto)!, [crypto]);
  const pending = useAccount((s) => s.deposits.find((d) => d.id === pendingId) ?? null);

  const tr = (ru: string, en: string) => (lang === "ru" ? ru : en);

  const start = () => {
    if (amount < 1) return;
    haptic("medium");
    const dep = createDeposit(amount, crypto);
    setPendingId(dep.id);
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      haptic("success");
      toast.success(tr("Скопировано", "Copied"));
    } catch {
      toast.error(tr("Не удалось скопировать", "Copy failed"));
    }
  };

  const confirmPaid = () => {
    if (!pending) return;
    haptic("success");
    confirmDeposit(pending.id);
    toast.success(tr("Баланс пополнен", "Balance topped up"));
    setPendingId(null);
  };

  const cancel = () => {
    if (!pending) return;
    cancelDeposit(pending.id);
    setPendingId(null);
  };

  return (
    <div className="min-h-screen max-w-md mx-auto bg-background">
      <header className="sticky top-0 z-30 px-5 pt-5 pb-3 bg-background/80 backdrop-blur-xl flex items-center gap-3">
        <button
          onClick={() => {
            haptic("light");
            onBack();
          }}
          className="w-10 h-10 rounded-2xl bg-card shadow-card flex items-center justify-center active:scale-95"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <div className="font-display font-bold text-lg leading-none">
            {tr("Пополнение баланса", "Top up balance")}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {tr("Текущий баланс", "Current balance")}: <span className="text-foreground font-semibold">{formatTHB(balance)}</span>
          </div>
        </div>
      </header>

      <main className="px-5 pb-32 space-y-5">
        {!pending ? (
          <>
            {suggested && suggested > 0 && (
              <div className="rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
                {tr(
                  `Для оформления заказа не хватает `,
                  `You need to add `
                )}
                <span className="font-bold text-primary">{formatTHB(suggested)}</span>
                {tr(" — сумма уже подставлена ниже.", " more — amount prefilled below.")}
              </div>
            )}

            <section>
              <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                {tr("Сумма (USD)", "Amount (USD)")}
              </div>
              <div className="flex items-center gap-2 bg-card rounded-2xl shadow-card px-4 py-3">
                <span className="text-2xl font-display font-bold text-muted-foreground">$</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
                  className="flex-1 bg-transparent text-2xl font-display font-bold focus:outline-none"
                />
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {QUICK.map((v) => (
                  <button
                    key={v}
                    onClick={() => {
                      haptic("light");
                      setAmount(v);
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                      amount === v
                        ? "gradient-primary text-primary-foreground border-transparent"
                        : "bg-card border-border text-foreground"
                    }`}
                  >
                    +${v}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                {tr("Способ оплаты", "Payment method")}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {CRYPTO_LIST.map((c) => {
                  const active = c.code === crypto;
                  return (
                    <button
                      key={c.code}
                      onClick={() => {
                        haptic("light");
                        setCrypto(c.code);
                      }}
                      className={`rounded-2xl p-3 text-left border transition-colors ${
                        active
                          ? "gradient-primary text-primary-foreground border-transparent shadow-glow"
                          : "bg-card border-border"
                      }`}
                    >
                      <div className="font-bold">{c.code}</div>
                      <div className={`text-[11px] ${active ? "opacity-80" : "text-muted-foreground"}`}>
                        {c.name} · {c.network}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <div className="rounded-2xl bg-card border border-border px-4 py-3 text-xs text-muted-foreground flex gap-2 items-start">
              <Clock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>
                {tr(
                  "Среднее время подтверждения пополнения криптой — 5–15 минут.",
                  "Average crypto confirmation time is 5–15 minutes."
                )}
              </span>
            </div>

            <button
              onClick={start}
              disabled={amount < 1}
              className="w-full gradient-primary text-primary-foreground font-bold py-4 rounded-2xl shadow-glow active:scale-[0.98] disabled:opacity-40"
            >
              {tr(`Пополнить ${formatTHB(amount)}`, `Top up ${formatTHB(amount)}`)}
            </button>
          </>
        ) : (
          <section className="space-y-4">
            <div className="rounded-2xl bg-card shadow-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">{tr("К оплате", "To pay")}</div>
                  <div className="font-display font-bold text-2xl">{formatTHB(pending.amountUSD)}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">{tr("Способ", "Method")}</div>
                  <div className="font-bold">{cryptoMeta.code}</div>
                  <div className="text-[11px] text-muted-foreground">{cryptoMeta.network}</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-card shadow-card p-4">
              <div className="text-xs text-muted-foreground mb-1">
                {tr("Адрес кошелька", "Wallet address")}
              </div>
              <div className="font-mono text-sm break-all">{pending.address}</div>
              <button
                onClick={() => copy(pending.address)}
                className="mt-3 w-full flex items-center justify-center gap-2 bg-background border border-border rounded-xl py-2.5 text-sm font-bold active:scale-[0.98]"
              >
                <Copy className="w-4 h-4" />
                {tr("Скопировать адрес", "Copy address")}
              </button>
            </div>

            <div className="rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 text-xs text-foreground/80 flex gap-2 items-start">
              <Clock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>
                {tr(
                  "Отправьте указанную сумму на адрес выше. Подтверждение обычно занимает 5–15 минут. После зачисления нажмите кнопку ниже.",
                  "Send the exact amount to the address above. Confirmation usually takes 5–15 minutes. Tap the button below once funds arrive."
                )}
              </span>
            </div>

            <button
              onClick={confirmPaid}
              className="w-full gradient-primary text-primary-foreground font-bold py-4 rounded-2xl shadow-glow active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5" />
              {tr("Я оплатил", "I have paid")}
            </button>
            <button
              onClick={cancel}
              className="w-full text-sm text-muted-foreground py-2 active:scale-95"
            >
              {tr("Отменить пополнение", "Cancel top-up")}
            </button>
          </section>
        )}
      </main>
    </div>
  );
};
