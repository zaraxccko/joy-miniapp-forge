// ============================================================
// 💼 Аккаунт юзера: баланс, депозиты, заказы — теперь через API.
// ============================================================
import { create } from "zustand";
import type { CartLine } from "@/types/shop";
import { Deposits, Orders, Admin, Auth } from "@/lib/api";
import { toast } from "sonner";

export type CryptoCode = "BTC" | "TRX" | "SOL" | "TON" | "USDT";

// Адреса дублируются на бэке (см. backend/src/routes/deposits.ts).
// Здесь используются только для отображения на странице депозита.
export const CRYPTO_LIST: { code: CryptoCode; name: string; network: string; address: string }[] = [
  { code: "USDT", name: "Tether",  network: "TRC-20", address: "TRGD4qP5SThQ2kt11jaKfUW6pZf2TpaDHt" },
  { code: "TRX",  name: "Tron",    network: "TRC-20", address: "TRGD4qP5SThQ2kt11jaKfUW6pZf2TpaDHt" },
  { code: "BTC",  name: "Bitcoin", network: "Bitcoin", address: "18JxaejFvEvSTxmPsJvmpYVxudHrVbofdu" },
  { code: "SOL",  name: "Solana",  network: "Solana",  address: "FDpmT2bW8Y685CtFcMWSBuJi7D6xtr2JrNiMFDQCpJVe" },
  { code: "TON",  name: "Toncoin", network: "TON",     address: "EQAaPP8_JvEXQAxXE2K1F8LoIuRYbDNYzWmvpgw0XRarsVvQ" },
];

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
  customerName?: string;
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
  customerName?: string;
  customerTgId?: number;
  crypto?: CryptoCode;
  payAddress?: string;
  confirmPhoto?: string;
  confirmText?: string;
  confirmedAt?: string;
}

interface AccountState {
  balanceUSD: number;
  deposits: Deposit[];
  orders: OrderRecord[];

  hydrate: () => Promise<void>;

  createDeposit: (
    amountUSD: number,
    crypto: CryptoCode,
    customer?: { name?: string; tgId?: number }
  ) => Promise<Deposit>;
  markPaid: (id: string) => Promise<void>;
  cancelDeposit: (id: string) => Promise<void>;

  /** Админский подтвердить — оставлено для обратной совместимости с UI. */
  confirmDeposit: (id: string) => Promise<void>;

  addOrder: (
    o: Omit<OrderRecord, "id" | "createdAt" | "status"> & { status?: OrderHistoryStatus }
  ) => Promise<OrderRecord>;
  confirmOrder: (id: string, payload: { photo?: string; text?: string }) => Promise<void>;
  cancelOrder: (id: string) => Promise<void>;

  /** Списать с баланса — теперь только локальная проверка перед заказом. Реальное списание делает бэк. */
  spend: (amountUSD: number) => boolean;
}

export const useAccount = create<AccountState>((set, get) => ({
  balanceUSD: 0,
  deposits: [],
  orders: [],

  hydrate: async () => {
    try {
      const [me, deps, ords] = await Promise.all([
        Auth.me().catch(() => null),
        Deposits.mine().catch(() => []),
        Orders.mine().catch(() => []),
      ]);
      set({
        balanceUSD: me?.balanceUSD ?? 0,
        deposits: deps as Deposit[],
        orders: ords as OrderRecord[],
      });
    } catch {
      // ignore
    }
  },

  createDeposit: async (amountUSD, crypto) => {
    try {
      const dep = (await Deposits.create(amountUSD, crypto)) as Deposit;
      set((s) => ({ deposits: [dep, ...s.deposits] }));
      return dep;
    } catch (e) {
      toast.error("Не удалось создать заявку на пополнение");
      throw e;
    }
  },

  markPaid: async (id) => {
    try {
      const updated = (await Deposits.markPaid(id)) as Deposit;
      set((s) => ({ deposits: s.deposits.map((d) => (d.id === id ? updated : d)) }));
    } catch (e) {
      toast.error("Не удалось отметить оплату");
      throw e;
    }
  },

  cancelDeposit: async (id) => {
    try {
      const updated = (await Deposits.cancel(id)) as Deposit;
      set((s) => ({ deposits: s.deposits.map((d) => (d.id === id ? updated : d)) }));
    } catch (e) {
      toast.error("Не удалось отменить заявку");
      throw e;
    }
  },

  confirmDeposit: async (id) => {
    try {
      await Admin.confirmDeposit(id);
      await get().hydrate();
    } catch (e) {
      toast.error("Не удалось подтвердить пополнение");
      throw e;
    }
  },

  addOrder: async (o) => {
    try {
      const created = (await Orders.create({
        totalUSD: o.totalUSD,
        items: o.items,
        delivery: o.delivery,
        deliveryAddress: o.deliveryAddress,
        crypto: o.crypto,
        payAddress: o.payAddress,
      })) as OrderRecord;
      set((s) => ({ orders: [created, ...s.orders] }));
      Auth.me().then((me) => set({ balanceUSD: me.balanceUSD })).catch(() => {});
      return created;
    } catch (e) {
      // Тост покажет вызывающий код (он различает insufficient_balance).
      throw e;
    }
  },

  confirmOrder: async (id, payload) => {
    try {
      let file: File | undefined;
      if (payload.photo?.startsWith("data:")) {
        file = await dataUrlToFile(payload.photo, "confirm.jpg");
      }
      await Admin.confirmOrder(id, { photo: file, text: payload.text });
      await get().hydrate();
    } catch (e) {
      toast.error("Не удалось подтвердить заказ");
      throw e;
    }
  },

  cancelOrder: async (id) => {
    try {
      await Admin.cancelOrder(id);
      await get().hydrate();
    } catch (e) {
      toast.error("Не удалось отменить заказ");
      throw e;
    }
  },

  spend: (amountUSD) => get().balanceUSD >= amountUSD,
}));

async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || "image/jpeg" });
}
