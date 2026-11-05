import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { describe, expect, it } from "vitest";
import { StocksApi } from "@base-stocks/sdk";
import { createServer, type ServerDeps } from "../src/server.js";

async function connect(deps: ServerDeps) {
  const server = createServer(deps);
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0" });
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}

const text = (r: unknown) => JSON.parse((r as { content: { text: string }[] }).content[0]!.text);

const fakeDeps: ServerDeps = {
  client: {} as ServerDeps["client"],
  api: {
    listStocks: async () =>
      [
        { symbol: "TSLAc", name: "Tesla, Inc.", contractAddress: "0xb2000000000000000000001e800a7f5189430cD0", multiplier: 1, totalSupply: 5917, navPrice: 377.76, pausedFeatures: [], decimals: 8 },
        { symbol: "PMc", name: "Philip Morris", contractAddress: "0xB2000000000000000000008FC2A8C23cf5937b66", multiplier: 1.5588, totalSupply: 10, pausedFeatures: [], decimals: 8 },
      ] as never,
    getCorporateAction: async () => {
      throw new Error("404");
    },
  },
};

describe("mcp server (unit)", () => {
  it("exposes only read-only tools", async () => {
    const c = await connect(fakeDeps);
    const { tools } = await c.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(
      [
        "get_basket",
        "get_corporate_action",
        "get_portfolio",
        "get_prices",
        "get_stock",
        "list_baskets",
        "list_stocks",
        "preview_basket_mint",
      ].sort(),
    );
    expect(tools.every((t) => t.annotations?.readOnlyHint === true)).toBe(true);
  });

  it("searches stocks by name", async () => {
    const c = await connect(fakeDeps);
    const r = text(await c.callTool({ name: "list_stocks", arguments: { query: "philip" } }));
    expect(r.count).toBe(1);
    expect(r.stocks[0]).toMatchObject({ symbol: "PMc", navPriceUsd: null, multiplier: 1.5588 });
  });

  it("returns tool errors instead of throwing", async () => {
    const c = await connect(fakeDeps);
    const unknown = await c.callTool({ name: "get_stock", arguments: { symbol: "NOPEc" } });
    expect(unknown.isError).toBe(true);
    const noFactory = await c.callTool({ name: "list_baskets", arguments: {} });
    expect(noFactory.isError).toBe(true);
    const ca = await c.callTool({
      name: "get_corporate_action",
      arguments: { id: "e82812a6-0b24-41c4-8ed1-322d1b466d33" },
    });
    expect(ca.isError).toBe(true);
  });

  it("validates addresses", async () => {
    const c = await connect(fakeDeps);
    const r = await c.callTool({ name: "get_portfolio", arguments: { address: "0x123" } });
    expect(r.isError).toBe(true);
  });
});

describe.skipIf(!process.env.LIVE)("mcp server (live Base mainnet)", () => {
  const deps: ServerDeps = {
    client: createPublicClient({ chain: base, transport: http(process.env.BASE_RPC_URL) }),
    api: new StocksApi(),
  };

  it("reads live prices and a stock", async () => {
    const c = await connect(deps);
    const prices = text(await c.callTool({ name: "get_prices", arguments: {} }));
    expect(prices.prices).toHaveLength(10);
    const nvda = text(await c.callTool({ name: "get_stock", arguments: { symbol: "nvdac" } }));
    expect(nvda.symbol).toBe("NVDAc");
    expect(nvda.multiplier).toBeGreaterThan(1);
    expect(nvda.price.source).toBe("chainlink");
  }, 60_000);
});
