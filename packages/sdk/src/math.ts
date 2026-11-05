import { FEED_DECIMALS, STOCK_DECIMALS, WAD } from "./constants.js";

/**
 * Raw B20 token amount -> underlying share amount (same 8-decimal scale).
 * Mirrors the onchain `toUIAmount`: raw * multiplier / 1e18, rounded down.
 */
export function toShares(rawAmount: bigint, multiplierWad: bigint): bigint {
  return (rawAmount * multiplierWad) / WAD;
}

/** Underlying share amount -> raw token amount (rounded down, like `fromUIAmount`). */
export function toRaw(shareAmount: bigint, multiplierWad: bigint): bigint {
  if (multiplierWad === 0n) throw new Error("multiplier is zero");
  return (shareAmount * WAD) / multiplierWad;
}

export type PriceBasis = "perToken" | "perShare";

/**
 * USD value of a raw token balance, in feed decimals (8).
 *
 * `perToken` (default) treats the feed as a per-token total-return value, matching the API's
 * `nav_price`, so no multiplier is applied. `perShare` treats the feed as a per-share price and
 * multiplies by the share amount. See docs/research.md: the docs are ambiguous, so pick one
 * explicitly and never apply both.
 */
export function valueUsd(
  rawAmount: bigint,
  feedAnswer: bigint,
  multiplierWad: bigint,
  basis: PriceBasis = "perToken",
): bigint {
  const units = basis === "perToken" ? rawAmount : toShares(rawAmount, multiplierWad);
  return (units * feedAnswer) / 10n ** BigInt(STOCK_DECIMALS);
}

/** Format a fixed-point bigint as a decimal string without precision loss. */
export function formatFixed(value: bigint, decimals: number, maxFraction = decimals, minFraction = 0): string {
  const neg = value < 0n;
  const abs = neg ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  let frac = (abs % base).toString().padStart(decimals, "0").slice(0, maxFraction).replace(/0+$/, "").padEnd(minFraction, "0");
  return `${neg ? "-" : ""}${whole}${frac ? "." + frac : ""}`;
}

export const formatUsd = (v: bigint, maxFraction = 2) => formatFixed(v, FEED_DECIMALS, maxFraction, Math.min(2, maxFraction));
export const formatMultiplier = (m: bigint) => formatFixed(m, 18);
