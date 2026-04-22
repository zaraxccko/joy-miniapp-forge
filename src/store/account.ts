import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartLine } from "@/types/shop";

export type CryptoCode = "BTC" | "TRX" | "SOL" | "TON" | "USDT";

// ============================================================
// 💰 КОШЕЛЬКИ ДЛЯ ПРИЁМА ОПЛАТЫ
// ============================================================
// Это адреса, на которые юзеры отправляют крипту при пополнении баланса.
// Они показываются на странице депозита (DepositPage).
//
// 👉 Чтобы поменять адрес — просто отредактируй поле `address` ниже.
//    Никакой бэк/база не нужны, всё статично в коде.
//
// ⚠️ Будь внимателен: ошибка в адресе = потеря денег.
//    USDT и TRX используют ОДИН и тот же адрес сети TRC-20 (Tron).
// ============================================================
export const CRYPTO_LIST: { code: CryptoCode; name: string; network: string; address: string }[] = [
  { code: "USDT", name: "Tether",  network: "TRC-20", address: "TRGD4qP5SThQ2kt11jaKfUW6pZf2TpaDHt" },
  { code: "TRX",  name: "Tron",    network: "TRC-20", address: "TRGD4qP5SThQ2kt11jaKfUW6pZf2TpaDHt" },
  { code: "BTC",  name: "Bitcoin", network: "Bitcoin", address: "18JxaejFvEvSTxmPsJvmpYVxudHrVbofdu" },
  { code: "SOL",  name: "Solana",  network: "Solana",  address: "FDpmT2bW8Y685CtFcMWSBuJi7D6xtr2JrNiMFDQCpJVe" },
  { code: "TON",  name: "Toncoin", network: "TON",     address: "EQAaPP8_JvEXQAxXE2K1F8LoIuRYbDNYzWmvpgw0XRarsVvQ" },
];

/**
 * pending     — заявка создана, юзер ещё не нажал "Я оплатил"
 * awaiting    — юзер заявил об оплате, ждём подтверждения админа
 * confirmed   — админ подтвердил, баланс пополнен
 * cancelled   — отменено
 */
export type DepositStatus = "pending" | "awaiting" | "confirmed" | "cancelled";

export interface Deposit {
  id: string;
  createdAt: string;
  amountUSD: number;
  crypto: CryptoCode;
  address: string;
  status: DepositStatus;
  paidAt?: string;
  confirmedAt?: string;
  /** Telegram username/first_name юзера — для админки. */
  customerName?: string;
  /** Telegram ID юзера. */
  customerTgId?: number;
}

export type OrderHistoryStatus = "awaiting" | "paid" | "in_delivery" | "completed" | "cancelled";

export interface OrderRecord {
  id: string;
  createdAt: string;
  totalUSD: number;
  items: CartLine[];
  delivery: boolean;
  deliveryAddress?: string;
  status: OrderHistoryStatus;
  /** Telegram username/first_name юзера, оформившего заказ — для админки. */
  customerName?: string;
  /** Telegram ID юзера. */
  customerTgId?: number;
  /** Крипта, которой клиент оплатил заказ. */
  crypto?: CryptoCode;
  /** Адрес кошелька, на который ушла оплата. */
  payAddress?: string;
  /** Фото-подтверждение (закладки) от админа, dataURL. */
  confirmPhoto?: string;
  /** Сопроводительный текст от админа. */
  confirmText?: string;
  confirmedAt?: string;
}

interface AccountState {
  balanceUSD: number;
  deposits: Deposit[];
  orders: OrderRecord[];

  createDeposit: (amountUSD: number, crypto: CryptoCode, customer?: { name?: string; tgId?: number }) => Deposit;
  /** Юзер сообщил, что оплатил — депозит уходит на подтверждение админа. */
  markPaid: (id: string) => void;
  /** Админ подтверждает оплату — баланс пополняется. */
  confirmDeposit: (id: string) => void;
  cancelDeposit: (id: string) => void;

  addOrder: (o: Omit<OrderRecord, "id" | "createdAt" | "status"> & { status?: OrderHistoryStatus }) => OrderRecord;
  /** Админ подтверждает оплату заказа: прикрепляет фото-закладку и текст. */
  confirmOrder: (id: string, payload: { photo?: string; text?: string }) => void;
  /** Админ отклоняет заказ. */
  cancelOrder: (id: string) => void;
  /** Списать с баланса. true — успех, false — недостаточно средств. */
  spend: (amountUSD: number) => boolean;
}

const uid = () => Math.random().toString(36).slice(2, 10);

export const useAccount = create<AccountState>()(
  persist(
    (set, get) => ({
      balanceUSD: 0,
      deposits: [],
      orders: [],

      createDeposit: (amountUSD, crypto) => {
        const meta = CRYPTO_LIST.find((c) => c.code === crypto)!;
        const dep: Deposit = {
          id: uid(),
          createdAt: new Date().toISOString(),
          amountUSD,
          crypto,
          address: meta.address,
          status: "pending",
        };
        set((s) => ({ deposits: [dep, ...s.deposits] }));
        return dep;
      },

      markPaid: (id) =>
        set((s) => ({
          deposits: s.deposits.map((d) =>
            d.id === id && d.status === "pending"
              ? { ...d, status: "awaiting", paidAt: new Date().toISOString() }
              : d
          ),
        })),

      confirmDeposit: (id) =>
        set((s) => {
          const dep = s.deposits.find((d) => d.id === id);
          if (!dep || (dep.status !== "awaiting" && dep.status !== "pending")) return s;
          return {
            deposits: s.deposits.map((d) =>
              d.id === id ? { ...d, status: "confirmed", confirmedAt: new Date().toISOString() } : d
            ),
            balanceUSD: s.balanceUSD + dep.amountUSD,
          };
        }),

      cancelDeposit: (id) =>
        set((s) => ({
          deposits: s.deposits.map((d) =>
            d.id === id && (d.status === "pending" || d.status === "awaiting")
              ? { ...d, status: "cancelled" }
              : d
          ),
        })),

      addOrder: (o) => {
        const order: OrderRecord = {
          id: uid(),
          createdAt: new Date().toISOString(),
          status: o.status ?? "paid",
          totalUSD: o.totalUSD,
          items: o.items,
          delivery: o.delivery,
          deliveryAddress: o.deliveryAddress,
          customerName: o.customerName,
          customerTgId: o.customerTgId,
          crypto: o.crypto,
          payAddress: o.payAddress,
        };
        set((s) => ({ orders: [order, ...s.orders] }));
        return order;
      },

      confirmOrder: (id, payload) =>
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === id
              ? {
                  ...o,
                  status: "completed",
                  confirmPhoto: payload.photo,
                  confirmText: payload.text,
                  confirmedAt: new Date().toISOString(),
                }
              : o
          ),
        })),

      cancelOrder: (id) =>
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === id ? { ...o, status: "cancelled" } : o
          ),
        })),

      spend: (amountUSD) => {
        const { balanceUSD } = get();
        if (balanceUSD < amountUSD) return false;
        set({ balanceUSD: balanceUSD - amountUSD });
        return true;
      },
    }),
    { name: "loveshop-account" }
  )
);
