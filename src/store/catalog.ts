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
  upsertCategory: (c: Category) => void;
  deleteCategory: (slug: string) => void;
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
      const products = await Catalog.list();
      set({
        products: Array.isArray(products) ? (products as Product[]) : [],
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
      const reason = e?.body && typeof e.body === "object" && "error" in e.body
        ? String((e.body as { error?: unknown }).error)
        : null;
      toast.error(reason ? `Не удалось сохранить товар: ${reason}` : "Не удалось сохранить товар");
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

  upsertCategory: (c) =>
    set((s) => {
      const exists = s.categories.some((x) => x.slug === c.slug);
      return {
        categories: exists
          ? s.categories.map((x) => (x.slug === c.slug ? c : x))
          : [...s.categories, c],
      };
    }),
  deleteCategory: (slug) =>
    set((s) => ({ categories: s.categories.filter((c) => c.slug !== slug) })),
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
