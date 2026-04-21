import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartLine } from "@/types/shop";

export type CryptoCode = "BTC" | "TRX" | "SOL" | "TON" | "USDT";

export const CRYPTO_LIST: { code: CryptoCode; name: string; network: string; address: string }[] = [
  { code: "USDT", name: "Tether",  network: "TRC-20", address: "TXkjN3p8VsHc4yQ2mLp9wRfBdK7tA1nZsY" },
  { code: "TRX",  name: "Tron",    network: "TRC-20", address: "TRX9aB2cDfGhJkLmNpQrStUvWxYz123aBcK" },
  { code: "BTC",  name: "Bitcoin", network: "Bitcoin", address: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq" },
  { code: "SOL",  name: "Solana",  network: "Solana", address: "So1aNaWa11etExamp1eAddressFor1usttest1ng" },
  { code: "TON",  name: "Toncoin", network: "TON",    address: "UQAvDfTONwa11etExampleAddressForTesting12" },
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
}

export type OrderHistoryStatus = "paid" | "in_delivery" | "completed" | "cancelled";

export interface OrderRecord {
  id: string;
  createdAt: string;
  totalUSD: number;
  items: CartLine[];
  delivery: boolean;
  deliveryAddress?: string;
  status: OrderHistoryStatus;
}

interface AccountState {
  balanceUSD: number;
  deposits: Deposit[];
  orders: OrderRecord[];

  createDeposit: (amountUSD: number, crypto: CryptoCode) => Deposit;
  /** Юзер сообщил, что оплатил — депозит уходит на подтверждение админа. */
  markPaid: (id: string) => void;
  /** Админ подтверждает оплату — баланс пополняется. */
  confirmDeposit: (id: string) => void;
  cancelDeposit: (id: string) => void;

  addOrder: (o: Omit<OrderRecord, "id" | "createdAt" | "status"> & { status?: OrderHistoryStatus }) => OrderRecord;
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
        };
        set((s) => ({ orders: [order, ...s.orders] }));
        return order;
      },

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
