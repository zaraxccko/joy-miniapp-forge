// ============================================================
// 💼 Аккаунт юзера: только заказы (баланса и депозитов больше нет).
// ============================================================
import { create } from "zustand";
import type { CartLine } from "@/types/shop";
import { Orders, Admin, Auth } from "@/lib/api";
import { toast } from "sonner";

export type CryptoCode = "BTC" | "TRX" | "SOL" | "TON" | "USDT";

// Адреса для приёма крипты — отображаются в UI, должны совпадать с .env / реальными кошельками.
export const CRYPTO_LIST: { code: CryptoCode; name: string; network: string; address: string }[] = [
  { code: "USDT", name: "Tether",  network: "TRC-20", address: "TRGD4qP5SThQ2kt11jaKfUW6pZf2TpaDHt" },
  { code: "TRX",  name: "Tron",    network: "TRC-20", address: "TRGD4qP5SThQ2kt11jaKfUW6pZf2TpaDHt" },
  { code: "BTC",  name: "Bitcoin", network: "Bitcoin", address: "18JxaejFvEvSTxmPsJvmpYVxudHrVbofdu" },
  { code: "SOL",  name: "Solana",  network: "Solana",  address: "FDpmT2bW8Y685CtFcMWSBuJi7D6xtr2JrNiMFDQCpJVe" },
  { code: "TON",  name: "Toncoin", network: "TON",     address: "EQAaPP8_JvEXQAxXE2K1F8LoIuRYbDNYzWmvpgw0XRarsVvQ" },
];

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
  confirmPhotos?: string[];
  confirmText?: string;
  confirmedAt?: string;
}

interface AccountState {
  orders: OrderRecord[];
  hydrate: () => Promise<void>;
  addOrder: (
    o: Omit<OrderRecord, "id" | "createdAt" | "status"> & { status?: OrderHistoryStatus; promoCode?: string }
  ) => Promise<OrderRecord>;
  confirmOrder: (id: string, payload: { photo?: string; text?: string }) => Promise<void>;
  cancelOrder: (id: string) => Promise<void>;
}

export const useAccount = create<AccountState>((set, get) => ({
  orders: [],

  hydrate: async () => {
    try {
      const ords = await Orders.mine().catch(() => []);
      set({ orders: Array.isArray(ords) ? (ords as OrderRecord[]) : [] });
    } catch { /* ignore */ }
  },

  addOrder: async (o) => {
    const created = (await Orders.create({
      totalUSD: o.totalUSD,
      items: o.items.map((item: any) => ({
        productId: item.product?.id,
        productName: item.productName ?? item.product?.name,
        qty: item.qty,
        variantId: item.variantId,
        districtSlug: item.districtSlug,
        stashType: item.stashType,
        priceUSD: item.priceUSD,
        isGift: item.isGift,
      })),
      delivery: o.delivery,
      deliveryAddress: o.deliveryAddress,
      crypto: o.crypto,
      payAddress: o.payAddress,
      promoCode: o.promoCode,
    })) as OrderRecord;
    set((s) => ({ orders: [created, ...s.orders.filter((x) => x.id !== created.id)] }));
    return created;
  },

  confirmOrder: async (id, payload) => {
    try {
      let file: File | undefined;
      if (payload.photo?.startsWith("data:")) {
        file = await dataUrlToFile(payload.photo, "confirm.jpg");
      }
      await Admin.confirmOrder(id, { photos: file ? [file] : undefined, text: payload.text });
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
}));

async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || "image/jpeg" });
}
