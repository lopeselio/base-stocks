/**
 * Live board of Coinbase tokenized stocks on Base.
 *   pnpm --filter @base-stocks/example-quickstart start [0xYourAddress]
 */
import { createPublicClient, http, type Address } from "viem";
import { base } from "viem/chains";
import {
  KNOWN_STOCKS,
  StocksApi,
  formatFixed,
  formatMultiplier,
  formatUsd,
  readFeedPrice,
  readPortfolio,
  readStock,
} from "@base-stocks/sdk";

const client = createPublicClient({ chain: base, transport: http(process.env.BASE_RPC_URL) });

const all = await new StocksApi().listStocks();
console.log(`${all.length} Coinbase tokenized stocks listed on Base\n`);

const rows = await Promise.all(
  KNOWN_STOCKS.map(async (s) => {
    const [state, price] = await Promise.all([readStock(client, s.token), readFeedPrice(client, s.feed)]);
    return {
      symbol: s.symbol,
      price: `$${formatUsd(price.answer)}`,
      multiplier: formatMultiplier(state.multiplier).slice(0, 10),
      updated: `${Math.round(price.ageSeconds / 60)}m ago${price.stale ? " ⚠ stale" : ""}`,
      pending: state.pending ? state.pending.effectiveAt.toISOString() : "-",
    };
  }),
);
console.table(rows);

const account = process.argv[2] as Address | undefined;
if (account) {
  const positions = await readPortfolio(client, account);
  console.log(`\nPortfolio of ${account}`);
  console.table(
    positions.map((p) => ({
      symbol: p.symbol,
      tokens: formatFixed(p.rawBalance, 8),
      shares: formatFixed(p.shares, 8),
      usd: p.valueUsd === undefined ? "n/a" : `$${formatUsd(p.valueUsd)}`,
    })),
  );
}
