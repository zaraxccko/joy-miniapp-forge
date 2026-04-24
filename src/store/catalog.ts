// ============================================================
// 🛍️ Каталог — грузится с бэкенда. Без persist (источник истины — сервер).
// ============================================================
import { create } from "zustand";
import type { Category, Product } from "@/types/shop";
import { CATEGORIES as DEFAULT_CATEGORIES } from "@/data/mockProducts";
import { Catalog, Admin } from "@/lib/api";
import { toast } from "sonner";

const cleanOptionalString = (value?: string) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const isApiMisconfigured = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "body" in error &&
  typeof (error as { body?: unknown }).body === "object" &&
  (error as { body?: { error?: string } }).body?.error === "api_misconfigured";

interface CatalogState {
  categories: Category[];
  products: Product[];
  loading: boolean;
  loaded: boolean;

  /** Подгрузить с сервера. Безопасно вызывать многократно. */
  hydrate: () => Promise<void>;

  setCategories: (c: Category[]) => void;
  setProducts: (p: Product[]) => void;

  upsertProduct: (p: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  upsertCategory: (c: Category) => Promise<void>;
  deleteCategory: (slug: string) => Promise<void>;
  reset: () => void;
}

export const useCatalog = create<CatalogState>()((set, get) => ({
  categories: DEFAULT_CATEGORIES,
  products: [],
  loading: false,
  loaded: false,

  hydrate: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const [products, categories] = await Promise.all([
        Catalog.list(),
        Catalog.categories().catch(() => null),
      ]);
      set({
        products: Array.isArray(products) ? (products as Product[]) : [],
        categories:
          Array.isArray(categories) && categories.length > 0
            ? (categories as Category[])
            : get().categories,
        loaded: true,
        loading: false,
      });
    } catch (e: any) {
      set({ loading: false });
      if (isApiMisconfigured(e)) {
        toast.error("API не подключён: проверь backend и /api прокси");
      } else if (get().loaded) {
        // Не спамим тостами при первом запуске без бэка.
        toast.error("Не удалось обновить каталог");
      }
    }
  },

  setCategories: (categories) => set({ categories }),
  setProducts: (products) => set({ products: Array.isArray(products) ? products : [] }),

  upsertProduct: async (p) => {
    const exists = get().products.some((x) => x.id === p.id);
    const payload = {
      name: p.name,
      description: p.description,
      category: p.category,
      priceTHB: p.priceTHB,
      thcMg: p.thcMg,
      cbdMg: p.cbdMg,
      weight: cleanOptionalString(p.weight),
      inStock: p.inStock,
      gradient: p.gradient,
      emoji: p.emoji,
      imageUrl: cleanOptionalString(p.imageUrl),
      featured: p.featured,
      badge: p.badge,
      cities: p.cities,
      districts: p.districts,
      variants: (p.variants ?? []).map((v) => ({
        slug: v.id,
        grams: v.grams,
        pricesByCountry: v.pricesByCountry,
        stashes: v.stashes,
        districts: v.districts,
      })),
    };
    try {
      if (exists) await Admin.updateProduct(p.id, payload);
      else await Admin.createProduct(payload);
      await get().hydrate();
    } catch (e: any) {
      const err = e?.body && typeof e.body === "object" ? (e.body as { error?: unknown }).error : null;
      let reason: string | null = null;
      if (err) {
        if (typeof err === "string") {
          reason = err;
        } else if (typeof err === "object") {
          // zod flatten(): { fieldErrors: { field: [msg] }, formErrors: [msg] }
          const fe = (err as any).fieldErrors as Record<string, string[]> | undefined;
          const form = (err as any).formErrors as string[] | undefined;
          const parts: string[] = [];
          if (fe) {
            for (const [k, v] of Object.entries(fe)) {
              if (Array.isArray(v) && v.length) parts.push(`${k}: ${v.join(", ")}`);
            }
          }
          if (form?.length) parts.push(form.join(", "));
          reason = parts.length ? parts.join("; ") : JSON.stringify(err);
        }
      }
      toast.error(reason ? `Не удалось сохранить товар: ${reason}` : "Не удалось сохранить товар");
      console.error("[catalog] save failed", e?.body ?? e);
      throw e;
    }
  },

  deleteProduct: async (id) => {
    try {
      await Admin.deleteProduct(id);
      set((s) => ({ products: s.products.filter((p) => p.id !== id) }));
    } catch (e) {
      toast.error("Не удалось удалить товар");
      throw e;
    }
  },

  upsertCategory: async (c) => {
    const exists = get().categories.some((x) => x.slug === c.slug);
    try {
      if (exists) {
        await Admin.updateCategory(c.slug, {
          name: c.name,
          emoji: c.emoji,
          gradient: c.gradient,
        });
      } else {
        await Admin.createCategory({
          slug: c.slug,
          name: c.name,
          emoji: c.emoji,
          gradient: c.gradient,
        });
      }
      set((s) => ({
        categories: exists
          ? s.categories.map((x) => (x.slug === c.slug ? c : x))
          : [...s.categories, c],
      }));
      await get().hydrate();
    } catch (e: any) {
      const status = typeof e?.status === "number" ? e.status : null;
      const message =
        status === 401
          ? "Сессия истекла: открой мини‑апп из Telegram заново"
          : status === 403
            ? "У этого Telegram-аккаунта нет прав администратора на сервере"
            : "Не удалось сохранить категорию";
      toast.error(message);
      console.error("[catalog] save category failed", e?.body ?? e);
      throw e;
    }
  },
  deleteCategory: async (slug) => {
    try {
      await Admin.deleteCategory(slug);
      set((s) => ({ categories: s.categories.filter((c) => c.slug !== slug) }));
    } catch (e: any) {
      const status = typeof e?.status === "number" ? e.status : null;
      const message =
        status === 401
          ? "Сессия истекла: открой мини‑апп из Telegram заново"
          : status === 403
            ? "У этого Telegram-аккаунта нет прав администратора на сервере"
            : "Не удалось удалить категорию";
      toast.error(message);
      console.error("[catalog] delete category failed", e?.body ?? e);
      throw e;
    }
  },
  reset: () => set({ categories: DEFAULT_CATEGORIES, products: [], loaded: false }),
}));

// Чистим устаревший persist-кэш, чтобы не падать на старых браузерах.
if (typeof window !== "undefined") {
  try {
    localStorage.removeItem("loveshop-catalog-v5");
    localStorage.removeItem("loveshop-catalog-v4");
    localStorage.removeItem("loveshop-catalog-v3");
  } catch {}
}
