import type { Address } from "viem";
import { b20Abi } from "./abi/b20.js";
import { basketFactoryAbi, stockBasketAbi } from "./abi/basket.js";
import type { StocksClient } from "./onchain.js";

export interface BasketComponent {
  token: Address;
  symbol: string;
  /** Raw B20 amount per 1e18 basket units. */
  unitAmount: bigint;
  /** Underlying shares per 1e18 basket units (grows with reinvested dividends). */
  sharesPerUnit: bigint;
  feed: Address;
}

export interface BasketState {
  address: Address;
  name: string;
  symbol: string;
  totalSupply: bigint;
  components: BasketComponent[];
  /** USD (18 decimals) per 1e18 basket units. */
  navPerUnit: bigint;
  /** False if any feed is missing, stale or invalid. Don't settle against the NAV when false. */
  navFresh: boolean;
  maxPriceAge: bigint;
}

/** Read a StockBasket's full state in two multicall round-trips. */
export async function readBasket(client: StocksClient, basket: Address): Promise<BasketState> {
  const c = { address: basket, abi: stockBasketAbi } as const;
  const [name, symbol, totalSupply, components, shares, nav, maxPriceAge] = await client.multicall({
    allowFailure: false,
    contracts: [
      { ...c, functionName: "name" },
      { ...c, functionName: "symbol" },
      { ...c, functionName: "totalSupply" },
      { ...c, functionName: "components" },
      { ...c, functionName: "sharesPerUnit" },
      { ...c, functionName: "nav" },
      { ...c, functionName: "maxPriceAge" },
    ],
  });

  const symbols = await client.multicall({
    allowFailure: true,
    contracts: components.map((comp) => ({ address: comp.token, abi: b20Abi, functionName: "symbol" }) as const),
  });

  return {
    address: basket,
    name,
    symbol,
    totalSupply,
    maxPriceAge,
    navPerUnit: nav[0],
    navFresh: nav[1],
    components: components.map((comp, i) => ({
      token: comp.token,
      unitAmount: comp.unitAmount,
      feed: comp.feed,
      sharesPerUnit: shares[i] ?? 0n,
      symbol: symbols[i]?.status === "success" ? (symbols[i]!.result as string) : "?",
    })),
  };
}

/** Raw token amounts needed to mint `amount` basket units (approve each before calling `mint`). */
export async function previewBasketMint(client: StocksClient, basket: Address, amount: bigint) {
  return client.readContract({ address: basket, abi: stockBasketAbi, functionName: "previewMint", args: [amount] });
}

/** All baskets registered in a BasketFactory, paginated under the hood. */
export async function listBaskets(client: StocksClient, factory: Address, pageSize = 100n): Promise<Address[]> {
  const out: Address[] = [];
  for (let offset = 0n; ; offset += pageSize) {
    const page = await client.readContract({
      address: factory,
      abi: basketFactoryAbi,
      functionName: "baskets",
      args: [offset, pageSize],
    });
    out.push(...page);
    if (BigInt(page.length) < pageSize) return out;
  }
}
