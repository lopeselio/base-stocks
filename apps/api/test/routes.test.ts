import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/routes.js";
import { cached } from "../src/cache.js";
import { mag7FromBoard, MAG7, type BoardRow, type DataSource } from "../src/data.js";

const board: BoardRow[] = MAG7.map((symbol, i) => ({
  symbol,
  token: `0xb2${String(i).padStart(38, "0")}` as `0x${string}`,
  price: 100 * (i + 1),
  updatedAt: 0,
  stale: i === 6,
  multiplier: 1,
}));

const fake: DataSource = {
  board: async () => board,
  stocks: async () => [{ symbol: "TSLAc", name: "Tesla", contractAddress: "0xb2", multiplier: 1, supply: 1 } as never],
  mag7: async () => mag7FromBoard(board),
  baskets: async () => [],
  basket: async (a) => {
    if (a.toLowerCase().endsWith("dead")) throw new Error("not a basket");
    return { address: a, name: "Base Mag7", symbol: "bMAG7" } as never;
  },
};

describe("api", () => {
  it("serves the board and the mag7 preview", async () => {
    const app = await buildApp({ data: fake });
    const res = await app.inject("/v1/board");
    expect(res.statusCode).toBe(200);
    expect(res.json().stocks).toHaveLength(7);
    expect(res.headers["cache-control"]).toContain("s-maxage=30");

    const m = (await app.inject("/v1/baskets/preview/mag7")).json();
    // 0.1 * (100+200+...+700) = 280
    expect(m.nav).toBeCloseTo(280);
    expect(m.allFresh).toBe(false);
  });

  it("counts stocks", async () => {
    const app = await buildApp({ data: fake });
    expect((await app.inject("/v1/stocks")).json().count).toBe(1);
  });

  it("validates basket addresses", async () => {
    const app = await buildApp({ data: fake });
    expect((await app.inject("/v1/baskets/nope")).statusCode).toBe(400);
    expect((await app.inject(`/v1/baskets/0x${"0".repeat(36)}dead`)).statusCode).toBe(404);
    const ok = await app.inject(`/v1/baskets/0x${"1".repeat(40)}`);
    expect(ok.statusCode).toBe(200);
    expect(ok.json().symbol).toBe("bMAG7");
  });

  it("sends CORS headers", async () => {
    const app = await buildApp({ data: fake, corsOrigin: "https://example.com" });
    const res = await app.inject({ url: "/health", headers: { origin: "https://example.com" } });
    expect(res.headers["access-control-allow-origin"]).toBe("https://example.com");
  });
});

describe("cached", () => {
  it("dedupes concurrent loads and serves last good value on failure", async () => {
    const load = vi.fn().mockResolvedValueOnce(1).mockRejectedValueOnce(new Error("rpc down"));
    const get = cached(0, load);
    const [a, b] = await Promise.all([get(), get()]);
    expect([a, b]).toEqual([1, 1]);
    expect(load).toHaveBeenCalledTimes(1);
    expect(await get()).toBe(1); // ttl 0 -> reload fails -> stale value
    expect(load).toHaveBeenCalledTimes(2);
  });
});
