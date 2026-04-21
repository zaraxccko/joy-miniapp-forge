import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartLine, Product } from "@/types/shop";

const lineKey = (l: Pick<CartLine, "product" | "variantId" | "districtSlug">) =>
  `${l.product.id}::${l.variantId ?? ""}::${l.districtSlug ?? ""}`;

interface AddOptions {
  variantId?: string;
  districtSlug?: string;
  priceUSD?: number;
}

interface CartState {
  lines: CartLine[];
  add: (product: Product, opts?: AddOptions) => void;
  remove: (key: string) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
  totalQty: () => number;
  totalTHB: () => number;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      add: (product, opts) =>
        set((state) => {
          const candidate: CartLine = {
            product,
            qty: 1,
            variantId: opts?.variantId,
            districtSlug: opts?.districtSlug,
            priceUSD: opts?.priceUSD,
          };
          const key = lineKey(candidate);
          const existing = state.lines.find((l) => lineKey(l) === key);
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                lineKey(l) === key ? { ...l, qty: l.qty + 1 } : l
              ),
            };
          }
          return { lines: [...state.lines, candidate] };
        }),
      remove: (key) =>
        set((state) => ({ lines: state.lines.filter((l) => lineKey(l) !== key) })),
      setQty: (key, qty) =>
        set((state) => ({
          lines:
            qty <= 0
              ? state.lines.filter((l) => lineKey(l) !== key)
              : state.lines.map((l) => (lineKey(l) === key ? { ...l, qty } : l)),
        })),
      clear: () => set({ lines: [] }),
      totalQty: () => get().lines.reduce((s, l) => s + l.qty, 0),
      totalTHB: () =>
        get().lines.reduce(
          (s, l) => s + l.qty * (l.priceUSD ?? l.product.priceTHB ?? 0),
          0
        ),
    }),
    { name: "sweetleaf-cart" }
  )
);

export { lineKey };
