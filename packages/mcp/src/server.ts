import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { isAddress, parseUnits, type Address } from "viem";
import { z } from "zod";
import {
  KNOWN_STOCKS,
  StocksApi,
  feedFor,
  listBaskets,
  previewBasketMint,
  readBasket,
  readFeedPrice,
  readPortfolio,
  readStock,
  type StocksClient,
} from "@base-stocks/sdk";

export interface ServerDeps {
  client: StocksClient;
  api: Pick<StocksApi, "listStocks" | "getCorporateAction">;
  /** Default BasketFactory for list_baskets. */
  factory?: Address;
}

const json = (v: unknown) => ({
  content: [
    {
      type: "text" as const,
      text: JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x), 2),
    },
  ],
});

const fail = (message: string) => ({ isError: true, content: [{ type: "text" as const, text: message }] });

const address = z
  .string()
  .refine((a) => isAddress(a), "must be a 0x-prefixed 20-byte address")
  .transform((a) => a as Address);

const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const;

/**
 * Read-only MCP tools over Coinbase tokenized stocks on Base. No tool signs or sends transactions.
 * Prices are Chainlink total-return values that freeze outside market hours: tools report `stale`.
 */
export function createServer(deps: ServerDeps): McpServer {
  const server = new McpServer({ name: "base-stocks", version: "0.0.1" });
  let listingCache: { at: number; rows: Awaited<ReturnType<ServerDeps["api"]["listStocks"]>> } | undefined;
  const listings = async () => {
    if (!listingCache || Date.now() - listingCache.at > 5 * 60_000) {
      listingCache = { at: Date.now(), rows: await deps.api.listStocks() };
    }
    return listingCache.rows;
  };

  server.registerTool(
    "list_stocks",
    {
      title: "List tokenized stocks",
      description:
        "Search the ~300 Coinbase tokenized stocks on Base by ticker or company name. Returns symbol, name, token address, NAV price (USD) and shares-per-token multiplier.",
      inputSchema: { query: z.string().optional(), limit: z.number().int().min(1).max(500).default(25) },
      annotations: READ_ONLY,
    },
    async ({ query, limit }) => {
      const q = query?.trim().toLowerCase();
      const rows = (await listings())
        .filter((s) => !q || s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
        .slice(0, limit)
        .map((s) => ({
          symbol: s.symbol,
          name: s.name,
          address: s.contractAddress,
          navPriceUsd: s.navPrice ?? null,
          multiplier: s.multiplier,
          totalSupplyTokens: s.totalSupply,
        }));
      return json({ count: rows.length, stocks: rows });
    },
  );

  server.registerTool(
    "get_stock",
    {
      title: "Get one stock",
      description:
        "Onchain state for a tokenized stock by symbol (e.g. NVDAc) or address: multiplier, any scheduled multiplier change, supply, and the live Chainlink price with staleness when a feed exists.",
      inputSchema: { symbol: z.string().describe("Ticker with the c suffix, e.g. TSLAc, or a 0x address") },
      annotations: READ_ONLY,
    },
    async ({ symbol }) => {
      const k = symbol.toLowerCase();
      const listing = (await listings()).find(
        (s) => s.symbol.toLowerCase() === k || s.contractAddress.toLowerCase() === k,
      );
      if (!listing) return fail(`Unknown stock "${symbol}". Use list_stocks to search.`);
      const state = await readStock(deps.client, listing.contractAddress);
      const feed = feedFor(listing.contractAddress);
      const price = feed ? await readFeedPrice(deps.client, feed) : undefined;
      return json({
        symbol: state.symbol,
        name: listing.name,
        address: listing.contractAddress,
        decimals: state.decimals,
        multiplier: Number(state.multiplier) / 1e18,
        pendingMultiplierChange: state.pending
          ? { multiplier: Number(state.pending.multiplier) / 1e18, effectiveAt: state.pending.effectiveAt.toISOString() }
          : null,
        totalSupplyTokens: Number(state.totalSupply) / 10 ** state.decimals,
        price: price
          ? {
              usd: Number(price.answer) / 1e8,
              updatedAt: price.updatedAt.toISOString(),
              ageSeconds: price.ageSeconds,
              stale: price.stale,
              source: "chainlink",
            }
          : listing.navPrice
            ? { usd: listing.navPrice, updatedAt: listing.navPriceUpdatedAt?.toISOString() ?? null, source: "coinbase-api" }
            : null,
      });
    },
  );

  server.registerTool(
    "get_prices",
    {
      title: "Live prices",
      description:
        "Live Chainlink prices for every stock with an onchain feed (AAPL, AMZN, GOOGL, META, MSFT, MSTR, NVDA, SNDK, SPCX, TSLA). Each includes age and a stale flag; feeds freeze when US markets are closed.",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () => {
      const rows = await Promise.all(
        KNOWN_STOCKS.map(async (s) => {
          const p = await readFeedPrice(deps.client, s.feed);
          return {
            symbol: s.symbol,
            usd: Number(p.answer) / 1e8,
            updatedAt: p.updatedAt.toISOString(),
            stale: p.stale,
          };
        }),
      );
      return json({ prices: rows });
    },
  );

  server.registerTool(
    "get_portfolio",
    {
      title: "Wallet stock portfolio",
      description:
        "Tokenized-stock positions of a wallet on Base: raw tokens, underlying shares (multiplier-adjusted) and USD value for stocks with a feed.",
      inputSchema: { address },
      annotations: READ_ONLY,
    },
    async ({ address: account }) => {
      const positions = await readPortfolio(deps.client, account);
      return json({
        address: account,
        positions: positions.map((p) => ({
          symbol: p.symbol,
          tokens: Number(p.rawBalance) / 1e8,
          shares: Number(p.shares) / 1e8,
          usd: p.valueUsd === undefined ? null : Number(p.valueUsd) / 1e8,
          priceStale: p.price?.stale ?? null,
        })),
        totalUsd: positions.reduce((a, p) => a + (p.valueUsd === undefined ? 0 : Number(p.valueUsd) / 1e8), 0),
      });
    },
  );

  server.registerTool(
    "get_basket",
    {
      title: "Get a StockBasket",
      description:
        "Composition, NAV per unit, feed freshness and supply of a StockBasket (an onchain index of tokenized stocks).",
      inputSchema: { address },
      annotations: READ_ONLY,
    },
    async ({ address: basket }) => {
      try {
        const b = await readBasket(deps.client, basket);
        return json({
          address: b.address,
          name: b.name,
          symbol: b.symbol,
          unitsOutstanding: Number(b.totalSupply) / 1e18,
          navPerUnitUsd: Number(b.navPerUnit) / 1e18,
          navFresh: b.navFresh,
          components: b.components.map((c) => ({
            symbol: c.symbol,
            token: c.token,
            tokensPerUnit: Number(c.unitAmount) / 1e8,
            sharesPerUnit: Number(c.sharesPerUnit) / 1e8,
          })),
        });
      } catch {
        return fail(`${basket} is not a StockBasket on this network.`);
      }
    },
  );

  server.registerTool(
    "list_baskets",
    {
      title: "List StockBaskets",
      description: "All baskets registered in a BasketFactory.",
      inputSchema: { factory: address.optional().describe("Defaults to the configured BASKET_FACTORY") },
      annotations: READ_ONLY,
    },
    async ({ factory }) => {
      const f = factory ?? deps.factory;
      if (!f) return fail("No factory given and BASKET_FACTORY is not configured.");
      return json({ factory: f, baskets: await listBaskets(deps.client, f) });
    },
  );

  server.registerTool(
    "preview_basket_mint",
    {
      title: "Preview basket mint",
      description:
        "Exact tokenized-stock amounts required to mint a number of basket units (mint is in-kind; approve each token for the basket first). Does not send anything.",
      inputSchema: { basket: address, units: z.string().regex(/^\d+(\.\d+)?$/).describe("Basket units, e.g. \"1.5\"") },
      annotations: READ_ONLY,
    },
    async ({ basket, units }) => {
      const [b, amounts] = await Promise.all([
        readBasket(deps.client, basket),
        previewBasketMint(deps.client, basket, parseUnits(units, 18)),
      ]);
      return json({
        basket: b.symbol,
        units,
        deposit: b.components.map((c, i) => ({
          symbol: c.symbol,
          token: c.token,
          amount: Number(amounts[i] ?? 0n) / 1e8,
          raw: amounts[i] ?? 0n,
        })),
      });
    },
  );

  server.registerTool(
    "get_corporate_action",
    {
      title: "Corporate action",
      description:
        "Details of a corporate action (dividend, split) by the UUID found in an onchain Announcement URI: status, multiplier before/after and announcement transactions.",
      inputSchema: { id: z.string().uuid() },
      annotations: READ_ONLY,
    },
    async ({ id }) => {
      try {
        return json(await deps.api.getCorporateAction(id));
      } catch (e) {
        return fail(`Corporate action ${id} not found: ${(e as Error).message}`);
      }
    },
  );

  return server;
}
