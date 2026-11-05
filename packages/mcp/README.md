# @base-stocks/mcp

An MCP server that gives AI agents **read-only** access to Coinbase tokenized stocks (B20) and
StockBaskets on Base. No tool signs or sends a transaction.

| Tool | What it returns |
|---|---|
| `list_stocks` | Search ~300 stocks by ticker or company: address, NAV, multiplier |
| `get_stock` | Onchain state for one stock: multiplier, scheduled change, supply, live price with staleness |
| `get_prices` | Live Chainlink prices for every stock with a feed, with `stale` flags |
| `get_portfolio` | A wallet's stock positions: tokens, underlying shares, USD value |
| `get_basket` | A StockBasket's composition, NAV per unit and feed freshness |
| `list_baskets` | All baskets in a BasketFactory |
| `preview_basket_mint` | Exact stock amounts needed to mint N basket units |
| `get_corporate_action` | Dividend/split details by announcement UUID |

Prices are Chainlink total-return values that **freeze when US markets are closed**. Every price
carries `stale`, so agents can avoid acting on frozen data.

## Use with Claude Code

```bash
claude mcp add base-stocks -- npx -y @base-stocks/mcp
```

## Use with Claude Desktop

```json
{
  "mcpServers": {
    "base-stocks": {
      "command": "npx",
      "args": ["-y", "@base-stocks/mcp"],
      "env": { "BASE_RPC_URL": "https://mainnet.base.org" }
    }
  }
}
```

## From source

```bash
pnpm --filter @base-stocks/mcp build
claude mcp add base-stocks -- node /path/to/base-stocks/packages/mcp/dist/index.js
```

| Env | Default |
|---|---|
| `BASE_RPC_URL` | viem's public Base RPC |
| `BASKET_FACTORY` | unset (pass `factory` to `list_baskets`) |
