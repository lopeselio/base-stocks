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
| [`packages/contracts`](packages/contracts) | Foundry. `StockBasket`, `BasketFactory`, `StockPriceLib`, `IB20Asset`, `B20Mock`, `B20ForkUtils` |
| [`packages/mcp`](packages/mcp) | `@base-stocks/mcp`: read-only MCP server so AI agents can query stocks, prices, portfolios and baskets |
| [`apps/api`](apps/api) | Fastify API (`/v1/board`, `/v1/stocks`, `/v1/baskets`, …) with caching |
| [`apps/web`](apps/web) | Next.js app: live board, all stocks, basket pages with in-kind mint/redeem (disabled for US visitors) |
| [`examples/quickstart`](examples/quickstart) | Live stock board + portfolio CLI |
| [`scripts/local-fork.sh`](scripts/local-fork.sh) | Base mainnet fork with working B20 stocks and a deployed Mag7 basket |

## Run the app locally

```bash
./scripts/local-fork.sh                      # anvil fork + etched stocks + bMAG7, prints the factory
BASE_RPC_URL=http://127.0.0.1:8545 BASKET_FACTORY=<factory> pnpm --filter @base-stocks/api dev   # :4000
API_URL=http://localhost:4000 NEXT_PUBLIC_BASE_RPC_URL=http://127.0.0.1:8545 pnpm --filter @base-stocks/web dev
```

Without the fork (`BASE_RPC_URL` unset), the API and app read Base mainnet and show the Mag7 basket as a
live preview until a factory is deployed.

## Agents (MCP)

```bash
claude mcp add base-stocks -- npx -y @base-stocks/mcp
```

Then ask: *"What's the NAV of bMAG7 and are all its feeds fresh?"* or *"Value the stock portfolio of
0x…"*. Details in [packages/mcp](packages/mcp).

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

### Stock baskets (on-chain indexes)

`StockBasket` is a fixed-composition ERC-20 backed 1:1 by B20 stocks, minted and redeemed **in-kind**
(like ETF creation units). Anyone can launch one through `BasketFactory`.

- **No oracle on mint/redeem.** It works 24/7, including weekends when equity feeds are frozen, and
  can't be oracle-manipulated.
- **Dividends compound automatically.** The vault holds raw B20 tokens, so reinvested dividends (multiplier
  increases) raise the shares behind every basket unit. No keeper, no rebalancing.
- **Always solvent.** Mint rounds up and redeem rounds down. This is checked by stateful invariant tests
  (128k random calls).
- **`nav()` is for display only** and returns `allFresh` so integrators never price against stale feeds.

```solidity
address bMAG7 = factory.createBasket("Base Mag7", "bMAG7", tokens, unitAmounts, feeds, 4 days);
uint256[] memory need = StockBasket(bMAG7).previewMint(1e18); // approve each, then:
StockBasket(bMAG7).mint(1e18, msg.sender);
(uint256 navPerUnit, bool fresh) = StockBasket(bMAG7).nav();
```

```ts
import { readBasket } from "@base-stocks/sdk";
const b = await readBasket(client, bMAG7); // components, sharesPerUnit, navPerUnit, navFresh
```

Live check on a Base mainnet fork: a 7-stock bMAG7 (0.1 of each) priced at **$268.19 per unit**
against the real Chainlink feeds (`test/BasketFork.t.sol`). Deploy with `script/DeployMag7.s.sol`.

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

Pre-alpha, built in public. Open questions and verified facts are in
[docs/research.md](docs/research.md). Corrections are very welcome.

> Not affiliated with Coinbase or Base. Not financial advice. Tokenized stocks are restricted in some
> jurisdictions (including the US). Read the issuer's terms.

MIT licensed.
