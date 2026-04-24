import { create } from "zustand";
import { toast } from "sonner";
import { Admin } from "@/lib/api";
import { MOCK_ANALYTICS, type AnalyticsSnapshot } from "@/lib/analyticsMock";
import type { OrderRecord } from "@/store/account";

type AdminOrderRecord = OrderRecord & { customerUsername?: string };

interface AdminPanelState {
  awaitingOrders: AdminOrderRecord[];
  historyOrders: AdminOrderRecord[];
  analytics: AnalyticsSnapshot;
  loadingQueue: boolean;
  loadingAnalytics: boolean;
  refreshQueue: () => Promise<void>;
  refreshAnalytics: () => Promise<void>;
  refreshAll: () => Promise<void>;
  confirmOrder: (id: string, payload: { photos?: string[]; text?: string }) => Promise<void>;
  cancelOrder: (id: string) => Promise<void>;
  patchOrder: (id: string, payload: { totalUSD?: number; items?: any[]; deliveryAddress?: string }) => Promise<void>;
  messageOrder: (id: string, text: string) => Promise<void>;
}

export const useAdminPanel = create<AdminPanelState>((set, get) => ({
  awaitingOrders: [],
  historyOrders: [],
  analytics: MOCK_ANALYTICS,
  loadingQueue: false,
  loadingAnalytics: false,

  refreshQueue: async () => {
    set({ loadingQueue: true });
    try {
      const [{ orders: awaiting }, { orders: history }] = await Promise.all([
        Admin.awaiting(),
        Admin.history(),
      ]);
      set({
        awaitingOrders: normalizeOrders(awaiting),
        historyOrders: normalizeOrders(history),
        loadingQueue: false,
      });
    } catch (error) {
      console.error("[adminPanel] failed to load queue", error);
      toast.error("Не удалось загрузить заявки админки");
      set({ loadingQueue: false });
    }
  },

  refreshAnalytics: async () => {
    set({ loadingAnalytics: true });
    try {
      const analytics = (await Admin.analytics()) as AnalyticsSnapshot;
      set({ analytics, loadingAnalytics: false });
    } catch (error) {
      console.error("[adminPanel] failed to load analytics", error);
      toast.error("Не удалось загрузить аналитику");
      set({ loadingAnalytics: false });
    }
  },

  refreshAll: async () => {
    await Promise.all([get().refreshQueue(), get().refreshAnalytics()]);
  },

  confirmOrder: async (id, payload) => {
    try {
      const files: File[] = [];
      for (const [i, p] of (payload.photos ?? []).entries()) {
        if (p?.startsWith("data:")) files.push(await dataUrlToFile(p, `confirm_${i}.jpg`));
      }
      await Admin.confirmOrder(id, {
        photos: files.length ? files : undefined,
        text: payload.text,
      });
      await get().refreshAll();
    } catch (error) {
      toast.error("Не удалось подтвердить заказ");
      throw error;
    }
  },

  cancelOrder: async (id) => {
    try {
      await Admin.cancelOrder(id);
      await get().refreshAll();
    } catch (error) {
      toast.error("Не удалось отменить заказ");
      throw error;
    }
  },

  patchOrder: async (id, payload) => {
    try {
      await Admin.patchOrder(id, payload);
      await get().refreshQueue();
    } catch (error) {
      toast.error("Не удалось изменить заказ");
      throw error;
    }
  },

  messageOrder: async (id, text) => {
    try {
      await Admin.messageOrder(id, text);
      toast.success("Сообщение отправлено");
    } catch (error) {
      toast.error("Не удалось отправить сообщение");
      throw error;
    }
  },
}));

function normalizeOrders(input: any[]): AdminOrderRecord[] {
  return Array.isArray(input) ? input.map(normalizeOrder) : [];
}

function normalizeOrder(item: any): AdminOrderRecord {
  const customer = item?.customer;
  return {
    ...item,
    items: Array.isArray(item?.items) ? item.items : [],
    customerName: customer?.name ?? item?.customerName,
    customerTgId: customer?.tgId ? Number(customer.tgId) : item?.customerTgId,
    customerUsername: customer?.username ?? item?.customerUsername,
  } as AdminOrderRecord;
}

async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || "image/jpeg" });
}
