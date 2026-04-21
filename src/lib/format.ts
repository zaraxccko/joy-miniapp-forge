/** Format a price. All prices in the app are displayed in US dollars. */
export const formatTHB = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export const shortId = () =>
  Math.random().toString(36).slice(2, 8).toUpperCase();
