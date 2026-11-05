# base-stocks

**Open-source developer toolkit for Coinbase tokenized stocks (B20) on Base.**
Built in public for [Base Stocks Maxxing](https://www.base.org/stocksmaxxing) (Nov 5 – Dec 5, 2026).

There are 298 tokenized US equities on Base today. Every team building on them runs into the same problems:

| Problem | What goes wrong | What this repo gives you |
|---|---|---|
| **Multipliers** | Dividends and splits change shares-per-token (ERC-8056). `balanceOf` ≠ shares. | `toShares` / `toRaw` that match onchain rounding, and pending-change detection |
| **Frozen feeds** | Chainlink equity feeds run 24/5 and *hold the last value* off-hours. | Staleness-aware `readFeedPrice` (TS) and `StockPriceLib.freshPrice` (Solidity) |
| **Double counting** | Feeds are total-return values. Multiplying by the multiplier again overstates value. | One explicit `PriceBasis`, documented in [docs/research.md](docs/research.md) |
| **Fork tests revert** | B20 tokens are native precompiles (`code == 0xef`). Foundry/Anvil hit `OpcodeNotFound`. | `B20ForkUtils.etchLive(token)`: real chain state, executable locally |
| **Discovery** | 298 stocks, a paginated API, and defaults omitted from responses. | Typed `StocksApi` client with pagination and normalized fields |

## Packages

| | |
|---|---|
| [`packages/sdk`](packages/sdk) | `@base-stocks/sdk`: TypeScript + viem. API client, onchain reads, multicall portfolio, math |
| [`packages/contracts`](packages/contracts) | Foundry. `StockPriceLib`, `IB20Asset`, `B20Mock`, `B20ForkUtils` |
| [`examples/quickstart`](examples/quickstart) | Live stock board + portfolio CLI |

## Quickstart

```bash
git clone --recurse-submodules https://github.com/lopeselio/base-stocks
cd base-stocks && pnpm install && pnpm build
pnpm --filter @base-stocks/example-quickstart start            # live board
pnpm --filter @base-stocks/example-quickstart start 0xYourAddr # + your positions
```

```ts
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { StocksApi, readPortfolio, readFeedPrice, feedFor, formatUsd } from "@base-stocks/sdk";

const client = createPublicClient({ chain: base, transport: http() });

const stocks = await new StocksApi().listStocks();           // all 298, paginated for you
const price = await readFeedPrice(client, feedFor("NVDAc")!); // { answer, updatedAt, ageSeconds, stale }
if (price.stale) console.warn("market closed or feed frozen");

for (const p of await readPortfolio(client, "0x…")) {
  console.log(p.symbol, p.shares, p.valueUsd && formatUsd(p.valueUsd));
}
```

### Solidity

```bash
forge install lopeselio/base-stocks
echo "base-stocks/=lib/base-stocks/packages/contracts/src/" >> remappings.txt
```

```solidity
import {StockPriceLib} from "base-stocks/StockPriceLib.sol";

// reverts StalePrice / InvalidPrice / IncompleteRound. Never settle against a frozen feed.
uint256 usd18 = StockPriceLib.valueOf(NVDAc, NVDA_FEED, amount, 1 days);
if (StockPriceLib.multiplierChangeImminent(NVDAc, 1 hours)) revert CorporateActionWindow();
```

### Fork testing B20

```solidity
import {B20ForkUtils} from "base-stocks/testing/B20ForkUtils.sol";

function setUp() public {
    vm.createSelectFork(vm.envString("BASE_RPC_URL"));
    B20ForkUtils.etchLive(GOOGLc);            // live symbol/decimals/multiplier/supply
    B20ForkUtils.deal(GOOGLc, alice, 10e8);   // 10 tokens
}
```

## Develop

```bash
pnpm --filter @base-stocks/sdk test                 # unit
LIVE=1 pnpm --filter @base-stocks/sdk test          # + Base mainnet
cd packages/contracts && forge test                 # unit + fuzz
BASE_RPC_URL=https://mainnet.base.org forge test --mc ForkTest
```

## Status

Pre-alpha, built in public. See [ROADMAP.md](ROADMAP.md). Open questions and verified facts are in
[docs/research.md](docs/research.md). Corrections are very welcome.

> Not affiliated with Coinbase or Base. Not financial advice. Tokenized stocks are restricted in some
> jurisdictions (including the US). Read the issuer's terms.

MIT licensed.
