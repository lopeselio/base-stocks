import { describe, expect, it } from "vitest";
import { readPortfolio } from "../src/onchain.js";
import type { StocksClient } from "../src/onchain.js";

const A = "0x0000000000000000000000000000000000000001" as const;

describe("readPortfolio", () => {
  it("throws instead of returning [] when the whole batch failed", async () => {
    const client = {
      multicall: async ({ contracts }: { contracts: unknown[] }) =>
        contracts.map(() => ({ status: "failure", error: new Error("out of gas") })),
    } as unknown as StocksClient;
    await expect(readPortfolio(client, A, { tokens: [A] })).rejects.toThrow(/every call failed/);
  });

  it("skips individual failed tokens but keeps the rest", async () => {
    const client = {
      multicall: async () => [
        { status: "failure", error: new Error("revert") },
        { status: "failure", error: new Error("revert") },
        { status: "failure", error: new Error("revert") },
        { status: "success", result: "XYZc" },
        { status: "success", result: 5n * 10n ** 8n },
        { status: "success", result: 10n ** 18n },
      ],
    } as unknown as StocksClient;
    const pos = await readPortfolio(client, A, { tokens: [A, "0x0000000000000000000000000000000000000002"] });
    expect(pos).toHaveLength(1);
    expect(pos[0]).toMatchObject({ symbol: "XYZc", shares: 5n * 10n ** 8n });
  });
});
