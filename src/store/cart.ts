import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartLine, Product } from "@/types/shop";

const lineKey = (l: Pick<CartLine, "product" | "variantId" | "districtSlug"> & { isGift?: boolean }) =>
  `${l.product.id}::${l.variantId ?? ""}::${l.districtSlug ?? ""}${l.isGift ? "::gift" : ""}`;

interface AddOptions {
  variantId?: string;
  districtSlug?: string;
  priceUSD?: number;
}

export interface DisplayCartLine extends CartLine {
  isGift?: boolean;
}

interface CartState {
  lines: CartLine[];
  add: (product: Product, opts?: AddOptions) => void;
  remove: (key: string) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
  totalQty: () => number;
  totalTHB: () => number;
  /** Paid lines + auto-generated gift lines (5g free for each unit ≥5g). */
  linesWithGifts: () => DisplayCartLine[];
}

/** Find a 5g variant on the product (by id "5g" or grams===5). */
const find5gVariant = (product: Product) =>
  product.variants?.find((v) => v.id === "5g" || v.grams === 5);

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
      linesWithGifts: () => {
        const out: DisplayCartLine[] = [];
        for (const l of get().lines) {
          out.push(l);
          const variant = l.product.variants?.find((v) => v.id === l.variantId);
          const grams = variant?.grams ?? 0;
          if (grams >= 5) {
            const giftVariant = find5gVariant(l.product);
            if (giftVariant) {
              out.push({
                product: l.product,
                qty: l.qty, // 1 gift per unit purchased
                variantId: giftVariant.id,
                districtSlug: l.districtSlug,
                priceUSD: 0,
                isGift: true,
              });
            }
          }
        }
        return out;
      },
    }),
    { name: "sweetleaf-cart" }
  )
);

export { lineKey };
