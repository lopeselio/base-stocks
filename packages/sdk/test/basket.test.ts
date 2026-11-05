import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { listBaskets, readBasket } from "../src/basket.js";
import type { StocksClient } from "../src/onchain.js";

const A = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as Address;

describe("readBasket", () => {
  it("maps multicall results into BasketState", async () => {
    let call = 0;
    const client = {
      multicall: async () => {
        call++;
        if (call === 1) {
          return [
            "Base Mag7",
            "bMAG7",
            10n ** 19n,
            [
              { token: A(1), unitAmount: 10_000_000n, feed: A(11) },
              { token: A(2), unitAmount: 10_000_000n, feed: A(12) },
            ],
            [10_003_771n, 10_000_000n],
            [268n * 10n ** 18n, true],
            345_600n,
          ];
        }
        return [
          { status: "success", result: "GOOGLc" },
          { status: "failure", error: new Error("x") },
        ];
      },
    } as unknown as StocksClient;

    const b = await readBasket(client, A(99));
    expect(b.symbol).toBe("bMAG7");
    expect(b.navFresh).toBe(true);
    expect(b.navPerUnit).toBe(268n * 10n ** 18n);
    expect(b.components[0]).toMatchObject({ symbol: "GOOGLc", sharesPerUnit: 10_003_771n });
    expect(b.components[1]!.symbol).toBe("?");
  });
});

describe("listBaskets", () => {
  it("follows pagination until a short page", async () => {
    const all = Array.from({ length: 5 }, (_, i) => A(i + 1));
    const offsets: bigint[] = [];
    const client = {
      readContract: async ({ args }: { args: [bigint, bigint] }) => {
        const [offset, limit] = args;
        offsets.push(offset);
        return all.slice(Number(offset), Number(offset + limit));
      },
    } as unknown as StocksClient;
    expect(await listBaskets(client, A(0), 2n)).toEqual(all);
    expect(offsets).toEqual([0n, 2n, 4n]);
  });
});
