# Roadmap

Built in public during Base Stocks Maxxing (Nov 5 – Dec 5, 2026). Track: **Programmable Stock Markets**.

## Week 0 — foundations (Nov 5) ✅
- [x] Verified field notes on B20, ERC-8056 multipliers, Chainlink feeds and the Coinbase API
- [x] `@base-stocks/sdk`: API client, onchain reads, staleness-aware prices, multicall portfolio
- [x] `StockPriceLib`: fresh-price guards and value math (unit + fuzz tests)
- [x] `B20ForkUtils.etchLive`: B20 tokens work in Foundry forks (found that `code == 0xef`)
- [x] Quickstart CLI and CI with mainnet fork tests

## Week 1 — correctness (Nov 6–13, partner brainstorm)
- [ ] Settle the per-token vs per-share feed question with the Base team; lock the default
- [ ] Decode `UIMultiplierUpdated` / `Announcement` events; build multiplier history from logs
- [ ] Corporate-action timeline: onchain announcements joined with `/corporate-actions/{id}`
- [ ] Market-hours helper (NYSE calendar plus feed 24/5 schedule)
- [ ] Policy registry checks (`isAuthorized`, `policyExists`) before transfers
- [ ] Publish `@base-stocks/sdk` to npm

## Weeks 2–3 — flagship primitive (Nov 13 – Dec 5)
- [ ] **Onchain stock baskets**: an ERC-4626-style index vault over B20 stocks (e.g. Mag7) that is
      multiplier-correct and pauses on stale feeds or imminent corporate actions
- [ ] React hooks (`useStock`, `usePortfolio`, `useStockPrice`)
- [ ] MCP server so agents can read stocks, prices and corporate actions (Agentic Stock Finance)
- [ ] Demo app + video for submission

## Ideas welcome
Open an issue. If you're building on B20 and hit a sharp edge, we want to hear about it.
