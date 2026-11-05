import type { Address } from "viem";
import { COINBASE_STOCKS_API } from "./constants.js";

/** A stock as returned by GET /v1/tokenized-stocks, with omitted defaults filled in. */
export interface StockListing {
  contractAddress: Address;
  symbol: string;
  name: string;
  decimals: number;
  iconUrl?: string;
  isin?: string;
  adgmIsin?: string;
  /** Token units (not shares), already normalized by decimals. */
  totalSupply: number;
  /** 1 = no adjustment. Float; read onchain for exact math. */
  multiplier: number;
  pausedFeatures: number[];
  /** Chainlink-based total-return reference value (not a bid/ask). */
  navPrice?: number;
  navPriceUpdatedAt?: Date;
  description?: string;
  firstMintDate?: Date;
}

export interface ChainContracts {
  chainId: number;
  chain: string;
  policyRegistry: Address;
  tokenSupplyManager: Address;
  tokenFactory: Address;
}

export type CorporateActionStatus = "UNSPECIFIED" | "ANNOUNCED" | "APPLIED";

export interface CorporateAction {
  id: string;
  uri: string;
  contractAddress: Address;
  symbol: string;
  description: string;
  status: CorporateActionStatus;
  announcedAt?: Date;
  appliedAt?: Date;
  multiplierBefore?: number;
  multiplierAfter?: number;
  announcements: {
    announcementId: string;
    description: string;
    txHash: string;
    blockNumber: bigint;
    blockTime: Date;
  }[];
}

export class StocksApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: number | undefined,
    message: string,
  ) {
    super(message);
    this.name = "StocksApiError";
  }
}

export interface StocksApiOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
}

const date = (v: unknown) => (typeof v === "string" ? new Date(v) : undefined);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseListing(t: any): StockListing {
  return {
    contractAddress: t.contract_address,
    symbol: t.symbol,
    name: t.name,
    decimals: Number(t.decimals ?? 0),
    iconUrl: t.icon_url,
    isin: t.isin,
    adgmIsin: t.adgm_isin,
    totalSupply: Number(t.total_supply ?? 0),
    multiplier: Number(t.multiplier ?? 1),
    pausedFeatures: (t.paused_features ?? []).map(Number),
    navPrice: t.nav_price === undefined ? undefined : Number(t.nav_price),
    navPriceUpdatedAt: date(t.nav_price_updated_at),
    description: t.description,
    firstMintDate: date(t.first_mint_date),
  };
}

const stripStatus = (s: string | undefined): CorporateActionStatus =>
  ((s ?? "").replace("CORPORATE_ACTION_STATUS_", "") || "UNSPECIFIED") as CorporateActionStatus;

/** Read-only client for https://api.coinbase.com/v1/tokenized-stocks (no API key). */
export class StocksApi {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(opts: StocksApiOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? COINBASE_STOCKS_API).replace(/\/$/, "");
    this.fetchFn = opts.fetch ?? globalThis.fetch.bind(globalThis);
  }

  private async get<T>(path: string): Promise<T> {
    const res = await this.fetchFn(this.baseUrl + path, { headers: { accept: "application/json" } });
    const text = await res.text();
    if (!res.ok) {
      let code: number | undefined;
      let message = text;
      try {
        const j = JSON.parse(text);
        code = j.code;
        message = j.message ?? text;
      } catch {
        /* plain-text error */
      }
      throw new StocksApiError(res.status, code, message);
    }
    return JSON.parse(text) as T;
  }

  /** One page of listings. */
  async listPage(pageSize = 500, pageToken?: string) {
    const q = new URLSearchParams({ page_size: String(pageSize) });
    if (pageToken) q.set("page_token", pageToken);
    const r = await this.get<{ tokens?: unknown[]; next_page_token?: string }>(`?${q}`);
    return { stocks: (r.tokens ?? []).map(parseListing), nextPageToken: r.next_page_token || undefined };
  }

  /** All listings, following pagination. */
  async listStocks(): Promise<StockListing[]> {
    const out: StockListing[] = [];
    let token: string | undefined;
    do {
      const page = await this.listPage(500, token);
      out.push(...page.stocks);
      token = page.nextPageToken;
    } while (token);
    return out;
  }

  async getChains(): Promise<ChainContracts[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await this.get<{ chains?: any[] }>("/chains");
    return (r.chains ?? []).map((c) => ({
      chainId: Number(c.chain_id),
      chain: c.chain,
      policyRegistry: c.policy_registry_address,
      tokenSupplyManager: c.token_supply_manager_address,
      tokenFactory: c.token_factory_address,
    }));
  }

  /** Total supply in token units (already normalized; do not divide again). */
  async getTotalSupply(contractAddress: Address): Promise<number> {
    return Number(await this.get<number | string>(`/total-supply/${contractAddress}`));
  }

  /** Ticker includes the `c` suffix (e.g. "TSLAc"); case-insensitive. */
  async getMetadata(ticker: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await this.get<any>(`/metadata/${encodeURIComponent(ticker)}`);
    return {
      contractAddress: r.contract_address as Address,
      name: r.name as string,
      symbol: r.symbol as string,
      image: r.image as string | undefined,
      prospectusUrl: r.prospectus_url as string | undefined,
      description: r.description as string | undefined,
    };
  }

  /** Stable URL that 302-redirects to the prospectus PDF. */
  prospectusUrl(ticker: string): string {
    return `${this.baseUrl}/prospectus/${encodeURIComponent(ticker)}`;
  }

  /** `id` is the UUID from the onchain Announcement URI. */
  async getCorporateAction(id: string): Promise<CorporateAction> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await this.get<any>(`/corporate-actions/${encodeURIComponent(id)}`);
    return {
      id: r.id,
      uri: r.uri,
      contractAddress: r.contract_address,
      symbol: r.symbol,
      description: r.description,
      status: stripStatus(r.status),
      announcedAt: date(r.announced_at),
      appliedAt: date(r.applied_at),
      multiplierBefore: r.multiplier_before === undefined ? undefined : Number(r.multiplier_before),
      multiplierAfter: r.multiplier_after === undefined ? undefined : Number(r.multiplier_after),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      announcements: (r.announcements ?? []).map((a: any) => ({
        announcementId: a.announcement_id,
        description: a.description,
        txHash: a.tx_hash,
        blockNumber: BigInt(a.block_number ?? 0),
        blockTime: new Date(a.block_time),
      })),
    };
  }
}
