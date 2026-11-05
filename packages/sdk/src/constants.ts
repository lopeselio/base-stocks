import type { Address } from "viem";

export const BASE_CHAIN_ID = 8453;
export const WAD = 10n ** 18n;
/** All Coinbase tokenized stocks use 8 decimals (verified onchain). */
export const STOCK_DECIMALS = 8;
export const FEED_DECIMALS = 8;

export const COINBASE_STOCKS_API = "https://api.coinbase.com/v1/tokenized-stocks";

/** Protocol contracts on Base mainnet, from GET /v1/tokenized-stocks/chains. */
export const BASE_STOCKS_CONTRACTS = {
  policyRegistry: "0x8453000000000000000000000000000000000002",
  tokenSupplyManager: "0xD1Ca4dAcdf3231011D175351f1f02D15C7c5664C",
  tokenFactory: "0x4bA3E29E254F25E94E61C4c9d67b37027331534D",
  onchainRegistry: "0x3f3E8cf41cdd3b1D118c16471aB0113DfDDd5CaD",
} as const satisfies Record<string, Address>;

export interface KnownStock {
  symbol: string;
  token: Address;
  /** Chainlink "Coinbase <TICKER>" total-return feed. */
  feed: Address;
}

/** Stocks with a documented Chainlink feed on Base (docs.base.org, 2026-11). */
export const KNOWN_STOCKS: readonly KnownStock[] = [
  { symbol: "AAPLc", token: "0xb200000000000000000000C2e324d24d7eEcd1fb", feed: "0x787f13dEa48Db0897CbCDD985de77809D837F988" },
  { symbol: "AMZNc", token: "0xb200000000000000000000d9192b6B456483C2E8", feed: "0x06A8E4b3aBB3B7543d8396FB2B763d22820cB295" },
  { symbol: "GOOGLc", token: "0xb2000000000000000000002D0BA3164cc74f58B7", feed: "0x5bF49E0ffA937CE2FfF033c739aD7C634c4D34F2" },
  { symbol: "METAc", token: "0xb2000000000000000000008bC8786B856E61707C", feed: "0x6526aE6797A76123638b863AeE4dD27Ba4E4b27D" },
  { symbol: "MSFTc", token: "0xB200000000000000000000Ab99cFa739E253872B", feed: "0xeB10A6c9aa7E537aEd766C08c35Dae35B321b18c" },
  { symbol: "MSTRc", token: "0xb2000000000000000000004884b426556b92883d", feed: "0xB3cE282CD188b35DA0E38D8Bc7d58e33173D202a" },
  { symbol: "NVDAc", token: "0xb20000000000000000000078ee7ce2fE4908108C", feed: "0x04689a41629776563E6822F76f2e57D148d28513" },
  { symbol: "SNDKc", token: "0xb200000000000000000000397293Cb8cda9a10c5", feed: "0x388b0dC46C0Fb05A74BeE0994fa5b02c6Fcca2eA" },
  { symbol: "SPCXc", token: "0xb2000000000000000000007b9fcbd005511aCBd5", feed: "0x6A634B235903C4ad6376892180d6fF8612e3Fa68" },
  { symbol: "TSLAc", token: "0xb2000000000000000000001e800a7f5189430cD0", feed: "0xFaf869185383a24F8cb00e27BdA6b63B9905DCb4" },
];

export function isB20Address(addr: string): boolean {
  return /^0x[bB]2[0-9a-fA-F]{38}$/.test(addr) && addr.toLowerCase().startsWith("0xb2000000");
}
