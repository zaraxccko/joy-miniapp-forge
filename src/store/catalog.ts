import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Category, Product } from "@/types/shop";
import { CATEGORIES as DEFAULT_CATEGORIES, PRODUCTS as DEFAULT_PRODUCTS } from "@/data/mockProducts";

interface CatalogState {
  categories: Category[];
  products: Product[];
  setCategories: (c: Category[]) => void;
  setProducts: (p: Product[]) => void;
  upsertProduct: (p: Product) => void;
  deleteProduct: (id: string) => void;
  upsertCategory: (c: Category) => void;
  deleteCategory: (slug: string) => void;
  reset: () => void;
}

export const useCatalog = create<CatalogState>()(
  persist(
    (set) => ({
      categories: DEFAULT_CATEGORIES,
      products: DEFAULT_PRODUCTS,
      setCategories: (categories) => set({ categories }),
      setProducts: (products) => set({ products }),
      upsertProduct: (p) =>
        set((s) => {
          const exists = s.products.some((x) => x.id === p.id);
          // Only one product can be the "featured / pick of the day".
          // If this one is featured, unset the flag on every other product.
          const normalize = (list: Product[]) =>
            p.featured ? list.map((x) => (x.id === p.id ? x : { ...x, featured: false })) : list;
          return {
            products: normalize(
              exists ? s.products.map((x) => (x.id === p.id ? p : x)) : [...s.products, p]
            ),
          };
        }),
      deleteProduct: (id) =>
        set((s) => ({ products: s.products.filter((p) => p.id !== id) })),
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
      reset: () => set({ categories: DEFAULT_CATEGORIES, products: DEFAULT_PRODUCTS }),
    }),
    { name: "loveshop-catalog-v2" }
  )
);
