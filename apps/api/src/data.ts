import { createPublicClient, http, type Address } from "viem";
import { base } from "viem/chains";
import {
  KNOWN_STOCKS,
  StocksApi,
  listBaskets,
  readBasket,
  readFeedPrice,
  readStock,
} from "@base-stocks/sdk";
import { cached, cachedBy } from "./cache.js";

/** JSON-safe shapes served by the API (bigints become decimal strings). */
export interface BoardRow {
  symbol: string;
  token: Address;
  price: number;
  updatedAt: number;
  stale: boolean;
  multiplier: number;
  pendingAt?: number;
}

export interface ListingRow {
  symbol: string;
  name: string;
  contractAddress: Address;
  multiplier: number;
  navPrice?: number;
  iconUrl?: string;
  supply: number;
}

export interface BasketJson {
  address: Address;
  name: string;
  symbol: string;
  totalSupply: string;
  navPerUnit: number;
  navFresh: boolean;
  maxPriceAge: number;
  components: { token: Address; symbol: string; unitAmount: string; sharesPerUnit: string; feed: Address }[];
}

export interface Mag7Preview {
  nav: number;
  allFresh: boolean;
  components: { symbol: string; units: number; shares: number; price: number; value: number; stale: boolean }[];
}

export interface DataSource {
  board(): Promise<BoardRow[]>;
  stocks(): Promise<ListingRow[]>;
  mag7(): Promise<Mag7Preview>;
  baskets(): Promise<BasketJson[]>;
  basket(address: Address): Promise<BasketJson>;
}

export const MAG7 = ["AAPLc", "AMZNc", "GOOGLc", "METAc", "MSFTc", "NVDAc", "TSLAc"] as const;
export const MAG7_UNIT = 0.1;

/** Computed exactly like StockBasket.nav(): feed value treated as per-token. */
export function mag7FromBoard(board: BoardRow[]): Mag7Preview {
  const components = MAG7.map((sym) => {
    const r = board.find((b) => b.symbol === sym);
    if (!r) throw new Error(`missing ${sym} on board`);
    return {
      symbol: sym,
      units: MAG7_UNIT,
      shares: MAG7_UNIT * r.multiplier,
      price: r.price,
      value: MAG7_UNIT * r.price,
      stale: r.stale,
    };
  });
  return { components, nav: components.reduce((a, c) => a + c.value, 0), allFresh: components.every((c) => !c.stale) };
}

export function liveDataSource(opts: { rpcUrl?: string; factory?: Address } = {}): DataSource {
  const client = createPublicClient({ chain: base, transport: http(opts.rpcUrl), batch: { multicall: true } });
  const api = new StocksApi();

  const board = cached(30_000, async (): Promise<BoardRow[]> =>
    Promise.all(
      KNOWN_STOCKS.map(async (s) => {
        const [state, price] = await Promise.all([readStock(client, s.token), readFeedPrice(client, s.feed)]);
        return {
          symbol: s.symbol,
          token: s.token,
          price: Number(price.answer) / 1e8,
          updatedAt: price.updatedAt.getTime(),
          stale: price.stale,
          multiplier: Number(state.multiplier) / 1e18,
          pendingAt: state.pending?.effectiveAt.getTime(),
        };
      }),
    ),
  );

  const stocks = cached(5 * 60_000, async (): Promise<ListingRow[]> => {
    const all = await api.listStocks();
    return all
      .map((s) => ({
        symbol: s.symbol,
        name: s.name,
        contractAddress: s.contractAddress,
        multiplier: s.multiplier,
        navPrice: s.navPrice,
        iconUrl: s.iconUrl,
        supply: s.totalSupply,
      }))
      .sort((a, b) => (b.navPrice ?? 0) * b.supply - (a.navPrice ?? 0) * a.supply);
  });

  const basket = cachedBy(15_000, async (address: Address): Promise<BasketJson> => {
    const b = await readBasket(client, address);
    return {
      address: b.address,
      name: b.name,
      symbol: b.symbol,
      totalSupply: b.totalSupply.toString(),
      navPerUnit: Number(b.navPerUnit) / 1e18,
      navFresh: b.navFresh,
      maxPriceAge: Number(b.maxPriceAge),
      components: b.components.map((c) => ({
        token: c.token,
        symbol: c.symbol,
        unitAmount: c.unitAmount.toString(),
        sharesPerUnit: c.sharesPerUnit.toString(),
        feed: c.feed,
      })),
    };
  });

  const baskets = cached(15_000, async () => {
    if (!opts.factory) return [];
    const addrs = await listBaskets(client, opts.factory);
    return Promise.all(addrs.map((a) => basket(a)));
  });

  return {
    board,
    stocks,
    baskets,
    basket,
    mag7: async () => mag7FromBoard(await board()),
  };
}
