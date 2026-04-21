export const formatTHB = (n: number) => `฿${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n)}`;

export const shortId = () =>
  Math.random().toString(36).slice(2, 8).toUpperCase();
