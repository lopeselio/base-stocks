import { describe, expect, it } from "vitest";
import { formatFixed, formatUsd, toRaw, toShares, valueUsd } from "../src/math.js";

const WAD = 10n ** 18n;
const GOOGL_MULT = 1_000377118676784179n; // live value, 2026-11-05

describe("multiplier math", () => {
  it("identity at multiplier 1", () => {
    expect(toShares(123_45678901n, WAD)).toBe(123_45678901n);
  });

  it("matches onchain toUIAmount rounding (floor)", () => {
    // 1 token at GOOGLc multiplier -> 1.00037711 shares (8 dp, floored)
    expect(toShares(1_00000000n, GOOGL_MULT)).toBe(1_00037711n);
  });

  it("round-trips within 1 unit of dust", () => {
    const raw = 987_65432109n;
    const back = toRaw(toShares(raw, GOOGL_MULT), GOOGL_MULT);
    expect(raw - back).toBeLessThanOrEqual(1n);
    expect(raw - back).toBeGreaterThanOrEqual(0n);
  });

  it("handles splits (2x)", () => {
    expect(toShares(5_00000000n, 2n * WAD)).toBe(10_00000000n);
  });

  it("rejects a zero multiplier", () => {
    expect(() => toRaw(1n, 0n)).toThrow();
  });
});

describe("valueUsd", () => {
  const feed = 290_79462274n; // $290.79462274

  it("perToken ignores the multiplier", () => {
    expect(valueUsd(2_00000000n, feed, GOOGL_MULT)).toBe(581_58924548n);
  });

  it("perShare applies the multiplier", () => {
    const v = valueUsd(2_00000000n, feed, GOOGL_MULT, "perShare");
    expect(v).toBeGreaterThan(581_58924548n);
    expect(formatUsd(v)).toBe("581.80");
  });
});

describe("formatFixed", () => {
  it("formats without float error", () => {
    expect(formatFixed(377_76458834n, 8)).toBe("377.76458834");
    expect(formatFixed(100000000n, 8)).toBe("1");
    expect(formatFixed(-5n, 8)).toBe("-0.00000005");
    expect(formatUsd(377_76458834n)).toBe("377.76");
    expect(formatUsd(556_40000000n)).toBe("556.40");
    expect(formatUsd(100_00000000n)).toBe("100.00");
  });
});
