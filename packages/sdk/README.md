# @base-stocks/sdk

TypeScript + viem SDK for Coinbase tokenized stocks (B20) on Base.

- **Discovery:** typed client for the public Tokenized Stocks API (all ~300 stocks, paginated for you)
- **Multiplier-correct math:** `toShares` / `toRaw` match onchain ERC-8056 rounding
- **Safe prices:** `readFeedPrice` flags Chainlink feeds that froze outside market hours
- **Portfolios:** `readPortfolio` reads every position in one multicall
- **Baskets:** `readBasket`, `previewBasketMint`, `listBaskets` for StockBasket indexes

```bash
npm i @base-stocks/sdk viem
```

```ts
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { StocksApi, readFeedPrice, feedFor, readPortfolio, formatUsd } from "@base-stocks/sdk";

const client = createPublicClient({ chain: base, transport: http() });

const stocks = await new StocksApi().listStocks();
const price = await readFeedPrice(client, feedFor("NVDAc")!);
if (price.stale) console.warn("market closed or feed frozen");

for (const p of await readPortfolio(client, "0x…")) {
  console.log(p.symbol, p.shares, p.valueUsd && formatUsd(p.valueUsd));
}
```

Feeds report total-return values. The SDK treats them as **per-token** by default (they match the
API's `nav_price`) and never multiplies by the multiplier twice. See
[docs/research.md](https://github.com/lopeselio/base-stocks/blob/main/docs/research.md).

Not affiliated with Coinbase or Base. MIT.
