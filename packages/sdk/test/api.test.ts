import { describe, expect, it } from "vitest";
import { StocksApi, StocksApiError } from "../src/api.js";

function mockFetch(routes: Record<string, { status?: number; body: unknown }>) {
  const calls: string[] = [];
  const fn = (async (url: string) => {
    calls.push(url);
    const key = Object.keys(routes).find((k) => url.endsWith(k));
    if (!key) return new Response("404 page not found", { status: 404 });
    const r = routes[key]!;
    const body = typeof r.body === "string" ? r.body : JSON.stringify(r.body);
    return new Response(body, { status: r.status ?? 200 });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const BASE = "https://x.test/v1/tokenized-stocks";

describe("StocksApi", () => {
  it("follows pagination and fills omitted defaults", async () => {
    const { fn, calls } = mockFetch({
      "?page_size=500": {
        body: {
          tokens: [{ contract_address: "0xb2000000000000000000001e800a7f5189430cD0", symbol: "TSLAc", name: "Tesla", decimals: 8, nav_price: 377.76 }],
          next_page_token: "p2",
        },
      },
      "?page_size=500&page_token=p2": {
        body: { tokens: [{ contract_address: "0xb200", symbol: "PMc", name: "Philip Morris", decimals: 8, multiplier: 1.5588 }] },
      },
    });
    const api = new StocksApi({ baseUrl: BASE, fetch: fn });
    const all = await api.listStocks();
    expect(calls).toHaveLength(2);
    expect(all.map((s) => s.symbol)).toEqual(["TSLAc", "PMc"]);
    expect(all[0]!.multiplier).toBe(1);
    expect(all[0]!.pausedFeatures).toEqual([]);
    expect(all[1]!.navPrice).toBeUndefined();
  });

  it("parses total supply as a bare number", async () => {
    const { fn } = mockFetch({ "/total-supply/0xabc": { body: "5917.74951293" } });
    const api = new StocksApi({ baseUrl: BASE, fetch: fn });
    expect(await api.getTotalSupply("0xabc" as `0x${string}`)).toBeCloseTo(5917.7495);
  });

  it("maps corporate action status and announcements", async () => {
    const { fn } = mockFetch({
      "/corporate-actions/e8": {
        body: {
          id: "e8", uri: "u", contract_address: "0xb2", symbol: "GOOGLc", description: "Cash Dividend",
          status: "CORPORATE_ACTION_STATUS_APPLIED", multiplier_before: 1.0001, multiplier_after: 1.0003,
          announcements: [{ announcement_id: "a1", description: "d", tx_hash: "0x1", block_number: "123", block_time: "2026-10-01T00:00:00Z" }],
        },
      },
    });
    const ca = await new StocksApi({ baseUrl: BASE, fetch: fn }).getCorporateAction("e8");
    expect(ca.status).toBe("APPLIED");
    expect(ca.announcements[0]!.blockNumber).toBe(123n);
  });

  it("surfaces structured API errors", async () => {
    const { fn } = mockFetch({
      "/metadata/NOPEc": { status: 404, body: { code: 5, message: 'ticker "NOPEC" is not a listed tokenized equity token' } },
    });
    const err = await new StocksApi({ baseUrl: BASE, fetch: fn }).getMetadata("NOPEc").catch((e) => e);
    expect(err).toBeInstanceOf(StocksApiError);
    expect(err.status).toBe(404);
    expect(err.code).toBe(5);
  });
});
