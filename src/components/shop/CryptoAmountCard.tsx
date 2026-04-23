// ============================================================
// 💵 Карточка "Сумма к оплате в крипте" — с конвертацией и копированием.
// Используется на DepositPage и OrderPaymentPage.
// ============================================================
import { Copy, RefreshCw, AlertCircle } from "lucide-react";
import { useCryptoRates, convertUSDToCrypto, formatCryptoAmount } from "@/lib/cryptoRates";
import type { CryptoCode } from "@/store/account";
import { haptic } from "@/lib/telegram";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

interface Props {
  amountUSD: number;
  crypto: CryptoCode;
  /** Метаинформация о крипте (имя, сеть). */
  cryptoName: string;
}

export const CryptoAmountCard = ({ amountUSD, crypto, cryptoName }: Props) => {
  const lang = useI18n((s) => s.lang) ?? "ru";
  const tr = (ru: string, en: string) => (lang === "ru" ? ru : en);
  const { rates, loading, error, updatedAt } = useCryptoRates();

  const cryptoAmount = convertUSDToCrypto(amountUSD, crypto, rates);
  const formatted = cryptoAmount !== null ? formatCryptoAmount(cryptoAmount, crypto) : null;
  const rate = rates[crypto];

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      haptic("success");
      toast.success(tr("Скопировано", "Copied"));
    } catch {
      toast.error(tr("Не удалось скопировать", "Copy failed"));
    }
  };

  const updatedAgo = updatedAt ? Math.max(0, Math.floor((Date.now() - updatedAt) / 1000)) : null;

  return (
    <div className="rounded-2xl bg-card shadow-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground">{tr("К оплате", "To pay")}</div>
          <div className="font-display font-bold text-2xl">${amountUSD.toFixed(2)}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">{tr("Сумма в", "Amount in")} {crypto}</div>
          {loading && !formatted ? (
            <div className="h-7 w-24 mt-0.5 bg-muted rounded-md animate-pulse ml-auto" />
          ) : formatted ? (
            <div className="font-display font-bold text-2xl">{formatted}</div>
          ) : (
            <div className="font-bold text-sm text-destructive">—</div>
          )}
        </div>
      </div>

      {formatted && (
        <button
          onClick={() => copy(formatted)}
          className="w-full flex items-center justify-center gap-2 gradient-primary text-primary-foreground rounded-xl py-2.5 text-sm font-bold active:scale-[0.98] shadow-glow"
        >
          <Copy className="w-4 h-4" />
          {tr("Скопировать сумму", "Copy amount")}
        </button>
      )}

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        {error ? (
          <span className="inline-flex items-center gap-1 text-destructive">
            <AlertCircle className="w-3 h-3" />
            {tr("Не удалось получить курс", "Failed to fetch rate")}
          </span>
        ) : rate ? (
          <span>
            1 {crypto} ≈ ${rate.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            {" · "}
            <span className="text-foreground/60">{cryptoName}</span>
          </span>
        ) : (
          <span>{tr("Загрузка курса…", "Loading rate…")}</span>
        )}
        <span className="inline-flex items-center gap-1">
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          {updatedAgo !== null && updatedAgo < 120
            ? tr(`${updatedAgo}s`, `${updatedAgo}s`)
            : tr("обнов.", "upd.")}
        </span>
      </div>
    </div>
  );
};
