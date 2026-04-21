/**
 * Моковые данные для дашборда аналитики.
 * При подключении к VPS-боту заменить на fetch('/api/stats').
 */

export interface DailyPoint {
  date: string;
  value: number;
}

export interface AnalyticsSnapshot {
  totals: {
    users: number;
    activations: number; // /start hits
    dau: number;
    wau: number;
    mau: number;
    gmvUSD: number;
    ordersToday: number;
    avgCheckUSD: number;
  };
  funnel: {
    starts: number;
    captchaPassed: number;
    miniAppOpened: number;
    firstOrder: number;
  };
  depositsFunnel: {
    created: number;
    paid: number;
    confirmed: number;
  };
  activations7d: DailyPoint[];
  dau7d: DailyPoint[];
  topProducts: { name: string; orders: number; gmvUSD: number }[];
  sources: { source: string; users: number }[];
}

const day = (d: number) => {
  const dt = new Date();
  dt.setDate(dt.getDate() - d);
  return dt.toISOString().slice(5, 10); // MM-DD
};

export const MOCK_ANALYTICS: AnalyticsSnapshot = {
  totals: {
    users: 1248,
    activations: 1612,
    dau: 187,
    wau: 642,
    mau: 1103,
    gmvUSD: 18420,
    ordersToday: 34,
    avgCheckUSD: 47,
  },
  funnel: {
    starts: 1612,
    captchaPassed: 1389,
    miniAppOpened: 1248,
    firstOrder: 612,
  },
  depositsFunnel: {
    created: 824,
    paid: 612,
    confirmed: 587,
  },
  activations7d: [
    { date: day(6), value: 142 },
    { date: day(5), value: 168 },
    { date: day(4), value: 201 },
    { date: day(3), value: 189 },
    { date: day(2), value: 234 },
    { date: day(1), value: 256 },
    { date: day(0), value: 278 },
  ],
  dau7d: [
    { date: day(6), value: 98 },
    { date: day(5), value: 112 },
    { date: day(4), value: 134 },
    { date: day(3), value: 128 },
    { date: day(2), value: 156 },
    { date: day(1), value: 172 },
    { date: day(0), value: 187 },
  ],
  topProducts: [
    { name: "🍫 Hash Sundae", orders: 142, gmvUSD: 4260 },
    { name: "🌿 Northern Lights", orders: 98, gmvUSD: 2940 },
    { name: "🍇 Grape Soda", orders: 76, gmvUSD: 2280 },
    { name: "🥭 Mango Kush", orders: 64, gmvUSD: 1920 },
    { name: "🍋 Lemon Haze", orders: 51, gmvUSD: 1530 },
  ],
  sources: [
    { source: "Direct", users: 624 },
    { source: "Instagram", users: 312 },
    { source: "Telegram ads", users: 184 },
    { source: "Referral", users: 128 },
  ],
};
