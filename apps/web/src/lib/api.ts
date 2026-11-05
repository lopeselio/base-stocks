import "server-only";
import type { Address } from "viem";

/** Server-side client for the Fastify API (apps/api). */
const API_URL = (process.env.API_URL ?? "http://localhost:4000").replace(/\/$/, "");

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
  supply: number;
}

export interface PreviewComponent {
  symbol: string;
  units: number;
  shares: number;
  price: number;
  value: number;
  stale: boolean;
}

export interface Mag7Preview {
  nav: number;
  allFresh: boolean;
  components: PreviewComponent[];
}

export interface BasketJson {
  address: Address;
  name: string;
  symbol: string;
  totalSupply: string;
  navPerUnit: number;
  navFresh: boolean;
  components: { token: Address; symbol: string; unitAmount: string; sharesPerUnit: string; feed: Address }[];
}

export class ApiError extends Error {
  constructor(public status: number, path: string) {
    super(`API ${status} for ${path}`);
  }
}

async function get<T>(path: string, revalidate: number): Promise<T> {
  const res = await fetch(API_URL + path, { next: { revalidate } });
  if (!res.ok) throw new ApiError(res.status, path);
  return res.json() as Promise<T>;
}

export const api = {
  board: () => get<{ stocks: BoardRow[] }>("/v1/board", 30).then((r) => r.stocks),
  stocks: () => get<{ stocks: ListingRow[] }>("/v1/stocks", 300).then((r) => r.stocks),
  mag7: () => get<Mag7Preview>("/v1/baskets/preview/mag7", 30),
  baskets: () => get<{ baskets: BasketJson[] }>("/v1/baskets", 15).then((r) => r.baskets),
  basket: (address: Address) => get<BasketJson>(`/v1/baskets/${address}`, 15),
};
