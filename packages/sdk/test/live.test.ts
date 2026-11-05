/** Hits Base mainnet + api.coinbase.com. Run with: LIVE=1 pnpm test */
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { describe, expect, it } from "vitest";
import { KNOWN_STOCKS, StocksApi, WAD, readFeedPrice, readPortfolio, readStock } from "../src/index.js";

const client = createPublicClient({ chain: base, transport: http(process.env.BASE_RPC_URL) });
const GOOGL = KNOWN_STOCKS.find((s) => s.symbol === "GOOGLc")!;

describe.skipIf(!process.env.LIVE)("live: Base mainnet", () => {
  it("reads GOOGLc state", async () => {
    const s = await readStock(client, GOOGL.token);
    expect(s.symbol).toBe("GOOGLc");
    expect(s.decimals).toBe(8);
    expect(s.multiplier).toBeGreaterThanOrEqual(WAD);
  });

  it("feed price matches API nav_price", async () => {
    const [p, list] = await Promise.all([readFeedPrice(client, GOOGL.feed), new StocksApi().listStocks()]);
    const listing = list.find((s) => s.symbol === "GOOGLc")!;
    expect(Number(p.answer) / 1e8).toBeCloseTo(listing.navPrice!, 2);
  });

  it("lists all stocks across pages", async () => {
    const list = await new StocksApi().listStocks();
    expect(list.length).toBeGreaterThan(100);
  });

  it("reads a portfolio for the supply manager (likely empty) without throwing", async () => {
    const pos = await readPortfolio(client, "0xD1Ca4dAcdf3231011D175351f1f02D15C7c5664C", { includeZero: true });
    expect(pos.length).toBe(KNOWN_STOCKS.length);
  });
});
