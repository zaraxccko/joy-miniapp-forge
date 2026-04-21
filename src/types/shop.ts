export type Currency = "USDT_TRC20" | "USDT_TON" | "TON" | "BTC" | "SOL" | "TRX";

export const CURRENCIES: { code: Currency; label: string; short: string; network: string; icon: string }[] = [
  { code: "USDT_TRC20", label: "USDT", short: "USDT", network: "TRC-20 (Tron)", icon: "💵" },
  { code: "USDT_TON", label: "USDT", short: "USDT", network: "TON", icon: "💵" },
  { code: "TON", label: "Toncoin", short: "TON", network: "TON", icon: "💎" },
  { code: "BTC", label: "Bitcoin", short: "BTC", network: "Bitcoin", icon: "₿" },
  { code: "SOL", label: "Solana", short: "SOL", network: "Solana", icon: "◎" },
  { code: "TRX", label: "Tron", short: "TRX", network: "Tron", icon: "🔺" },
];

export type CategorySlug = string;

/** Either a plain string (same in both languages) or a per-language object. */
export type LocalizedString = string | { ru: string; en: string };

export interface Category {
  slug: string;
  name: LocalizedString;
  emoji: string;
  gradient: string;
}

/** A weight-based variant of a product (e.g. 1g, 2g, 5g). */
export interface ProductVariant {
  /** Unique id within the product, e.g. "1g". */
  id: string;
  /** Weight in grams. */
  grams: number;
  /** Price per country slug ("thailand", "vietnam", "bali", "kl"). */
  pricesByCountry: Partial<Record<string, number>>;
  /** District slugs where this variant is available. Empty = all districts of the product's cities. */
  districts?: string[];
}

export interface Product {
  id: string;
  name: LocalizedString;
  description: LocalizedString;
  category: string;
  /** @deprecated kept for backward compatibility — use variants[].pricesByCountry */
  priceTHB: number;
  thcMg?: number;
  cbdMg?: number;
  weight?: string;
  inStock: number;
  gradient: string;
  emoji: string;
  imageUrl?: string;
  featured?: boolean;
  badge?: LocalizedString;
  /** city slugs where product is available; empty = everywhere */
  cities?: string[];
  /** district slugs where product is available; empty = all districts of selected cities */
  districts?: string[];
  /** weight-based variants with per-country prices */
  variants?: ProductVariant[];
}

export interface CartLine {
  product: Product;
  qty: number;
  /** Selected variant id (e.g. "1g") */
  variantId?: string;
  /** District where it was added */
  districtSlug?: string;
  /** Price snapshot at add time (USD) */
  priceUSD?: number;
}

export type OrderStatus =
  | "awaiting_payment"
  | "verifying"
  | "paid"
  | "ready"
  | "completed"
  | "cancelled";

export interface OrderPayment {
  currency: Currency;
  cryptoAmount: string;
  walletAddress: string;
  txHash?: string;
  paidAt?: string;
}

export interface Order {
  id: string;
  shortId: string;
  createdAt: string;
  status: OrderStatus;
  items: CartLine[];
  totalTHB: number;
  customer: { name: string; phone: string; pickupTime: string; note?: string };
  payment: OrderPayment;
  telegramUserId?: number;
}

export const ORDER_STATUS_META: Record<OrderStatus, { label: string; color: string; description: string }> = {
  awaiting_payment: { label: "Ожидает оплату", color: "warning", description: "Переведите крипту и пришлите хеш" },
  verifying: { label: "Проверяем", color: "primary", description: "Сверяем поступление" },
  paid: { label: "Оплачен", color: "success", description: "Готовим заказ" },
  ready: { label: "Готов к выдаче", color: "success", description: "Можно забирать" },
  completed: { label: "Получен", color: "muted", description: "Спасибо!" },
  cancelled: { label: "Отменён", color: "destructive", description: "" },
};
