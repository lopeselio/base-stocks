export const usd = (n: number, digits = 2) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits });

export const compactUsd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });

export const num = (n: number, digits = 4) =>
  n.toLocaleString("en-US", { maximumFractionDigits: digits });

export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function ago(ms: number, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 90) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 90) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export const basescan = (a: string) => `https://basescan.org/address/${a}`;
