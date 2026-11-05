import type { Address, PublicClient } from "viem";
import { b20Abi } from "./abi/b20.js";
import { aggregatorV3Abi } from "./abi/chainlink.js";
import { KNOWN_STOCKS } from "./constants.js";
import { type PriceBasis, toShares, valueUsd } from "./math.js";

/**
 * The SDK only needs these two methods, so any viem client works, including chain-specific clients
 * such as `createPublicClient({ chain: base })`, whose OP-stack tx types don't widen to `PublicClient`.
 */
export type StocksClient = Pick<PublicClient, "multicall" | "readContract">;

export interface StockState {
  token: Address;
  symbol: string;
  decimals: number;
  /** Raw token supply. */
  totalSupply: bigint;
  /** Current ERC-8056 UI multiplier, WAD (1e18). */
  multiplier: bigint;
  /** Scheduled multiplier change, if any. */
  pending?: { multiplier: bigint; effectiveAt: Date };
}

export interface FeedPrice {
  feed: Address;
  /** 8-decimal total-return value. */
  answer: bigint;
  updatedAt: Date;
  ageSeconds: number;
  /** True when older than `maxAgeSeconds`. Off-hours feeds hold their last value. */
  stale: boolean;
}

/** Default staleness bound: the feed heartbeat is 24h during market hours. */
export const DEFAULT_MAX_PRICE_AGE = 26 * 60 * 60;

export async function readStock(client: StocksClient, token: Address): Promise<StockState> {
  const c = { address: token, abi: b20Abi } as const;
  const [symbol, decimals, totalSupply, multiplier, newMult, effectiveAt] = await client.multicall({
    allowFailure: false,
    contracts: [
      { ...c, functionName: "symbol" },
      { ...c, functionName: "decimals" },
      { ...c, functionName: "totalSupply" },
      { ...c, functionName: "uiMultiplier" },
      { ...c, functionName: "newUIMultiplier" },
      { ...c, functionName: "effectiveAt" },
    ],
  });
  const pending =
    effectiveAt > 0n && newMult !== multiplier
      ? { multiplier: newMult, effectiveAt: new Date(Number(effectiveAt) * 1000) }
      : undefined;
  return { token, symbol, decimals, totalSupply, multiplier, pending };
}

export async function readFeedPrice(
  client: StocksClient,
  feed: Address,
  opts: { maxAgeSeconds?: number; now?: number } = {},
): Promise<FeedPrice> {
  const [, answer, , updatedAt] = await client.readContract({
    address: feed,
    abi: aggregatorV3Abi,
    functionName: "latestRoundData",
  });
  if (answer <= 0n) throw new Error(`feed ${feed} returned non-positive answer`);
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  const ageSeconds = Math.max(0, now - Number(updatedAt));
  return {
    feed,
    answer,
    updatedAt: new Date(Number(updatedAt) * 1000),
    ageSeconds,
    stale: ageSeconds > (opts.maxAgeSeconds ?? DEFAULT_MAX_PRICE_AGE),
  };
}

export function feedFor(tokenOrSymbol: string): Address | undefined {
  const k = tokenOrSymbol.toLowerCase();
  return KNOWN_STOCKS.find((s) => s.token.toLowerCase() === k || s.symbol.toLowerCase() === k)?.feed;
}

export interface Position {
  token: Address;
  symbol: string;
  rawBalance: bigint;
  /** Underlying shares (raw * multiplier). */
  shares: bigint;
  multiplier: bigint;
  price?: FeedPrice;
  /** 8-decimal USD, undefined when no feed is known. */
  valueUsd?: bigint;
}

/**
 * Read an account's positions across tokens in one multicall round-trip (plus one for feeds).
 * Defaults to every stock in KNOWN_STOCKS.
 */
export async function readPortfolio(
  client: StocksClient,
  account: Address,
  opts: { tokens?: Address[]; basis?: PriceBasis; includeZero?: boolean; maxAgeSeconds?: number } = {},
): Promise<Position[]> {
  const tokens = opts.tokens ?? KNOWN_STOCKS.map((s) => s.token);
  const res = await client.multicall({
    allowFailure: true,
    contracts: tokens.flatMap((t) => [
      { address: t, abi: b20Abi, functionName: "symbol" },
      { address: t, abi: b20Abi, functionName: "balanceOf", args: [account] },
      { address: t, abi: b20Abi, functionName: "uiMultiplier" },
    ] as const),
  });

  // A failure of every call means the batch itself failed (RPC error, or a call that burned all gas,
  // e.g. an unexecutable B20 precompile in a local fork). Never report that as an empty portfolio.
  if (tokens.length > 0 && res.every((r) => r.status === "failure")) {
    const first = res[0];
    throw new Error(
      `readPortfolio: every call failed; refusing to return an empty portfolio (${
        first?.status === "failure" ? (first.error as Error).message.split("\n")[0] : "unknown error"
      })`,
    );
  }

  const positions: Position[] = [];
  tokens.forEach((token, i) => {
    const [sym, bal, mult] = [res[i * 3], res[i * 3 + 1], res[i * 3 + 2]];
    if (sym?.status !== "success" || bal?.status !== "success" || mult?.status !== "success") return;
    const rawBalance = bal.result as bigint;
    if (rawBalance === 0n && !opts.includeZero) return;
    const multiplier = mult.result as bigint;
    positions.push({ token, symbol: sym.result as string, rawBalance, multiplier, shares: toShares(rawBalance, multiplier) });
  });

  await Promise.all(
    positions.map(async (p) => {
      const feed = feedFor(p.token);
      if (!feed) return;
      p.price = await readFeedPrice(client, feed, { maxAgeSeconds: opts.maxAgeSeconds });
      p.valueUsd = valueUsd(p.rawBalance, p.price.answer, p.multiplier, opts.basis);
    }),
  );
  return positions;
}
