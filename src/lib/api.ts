// ============================================================
// 🌐 API client
// ============================================================
// Тонкая обёртка над fetch с авто-подстановкой JWT-токена.
// Базовый URL берётся из VITE_API_URL (см. .env.example).
// ============================================================

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "/api";

const TOKEN_KEY = "loveshop-token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string | null) => {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  },
};

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

type ReqInit = Omit<RequestInit, "body"> & { body?: unknown };

export async function api<T = unknown>(path: string, init: ReqInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = tokenStore.get();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let body: BodyInit | undefined;
  if (init.body !== undefined) {
    if (init.body instanceof FormData) {
      body = init.body;
    } else {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(init.body);
    }
  }

  const res = await fetch(`${BASE}${path}`, { ...init, headers, body });
  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    throw new ApiError(res.status, `${res.status} ${res.statusText}`, data);
  }
  return data as T;
}

function safeJson(s: string) {
  try { return JSON.parse(s); } catch { return s; }
}

// ============================================================
// Эндпоинты
// ============================================================

export interface MeUser {
  tgId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  photoUrl?: string;
  lang: "ru" | "en";
  citySlug?: string | null;
  balanceUSD: number;
  isAdmin: boolean;
}

export const Auth = {
  loginWithTelegram: (initData: string) =>
    api<{ token: string; user: MeUser }>("/auth/telegram", { method: "POST", body: { initData } }),
  me: () => api<MeUser>("/me"),
};

export const Catalog = {
  list: (city?: string) =>
    api<any[]>(`/catalog${city ? `?city=${encodeURIComponent(city)}` : ""}`),
  categories: () => api<string[]>("/categories"),
};

export const Deposits = {
  create: (amountUSD: number, crypto: string) =>
    api<any>("/deposits", { method: "POST", body: { amountUSD, crypto } }),
  markPaid: (id: string) => api<any>(`/deposits/${id}/paid`, { method: "POST" }),
  cancel: (id: string) => api<any>(`/deposits/${id}/cancel`, { method: "POST" }),
  mine: () => api<any[]>("/deposits/me"),
};

export const Orders = {
  create: (payload: {
    totalUSD: number;
    items: any[];
    delivery: boolean;
    deliveryAddress?: string;
    crypto?: string;
    payAddress?: string;
  }) => api<any>("/orders", { method: "POST", body: payload }),
  mine: () => api<any[]>("/orders/me"),
};

export const Admin = {
  awaiting: () => api<{ orders: any[]; deposits: any[] }>("/admin/awaiting"),
  history: (limit = 50, offset = 0) =>
    api<{ orders: any[]; deposits: any[] }>(`/admin/history?limit=${limit}&offset=${offset}`),
  confirmDeposit: (id: string) => api(`/admin/deposits/${id}/confirm`, { method: "POST" }),
  cancelDeposit: (id: string) => api(`/admin/deposits/${id}/cancel`, { method: "POST" }),
  confirmOrder: (id: string, payload: { photo?: File; text?: string }) => {
    const fd = new FormData();
    if (payload.photo) fd.append("photo", payload.photo);
    if (payload.text) fd.append("text", payload.text);
    return api(`/admin/orders/${id}/confirm`, { method: "POST", body: fd });
  },
  cancelOrder: (id: string) => api(`/admin/orders/${id}/cancel`, { method: "POST" }),
  createProduct: (data: any) => api("/admin/products", { method: "POST", body: data }),
  updateProduct: (id: string, data: any) => api(`/admin/products/${id}`, { method: "PUT", body: data }),
  deleteProduct: (id: string) => api(`/admin/products/${id}`, { method: "DELETE" }),
  analytics: () => api<any>("/admin/analytics"),
  broadcast: (payload: any) => api("/broadcast", { method: "POST", body: payload }),
};
