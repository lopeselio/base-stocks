import "server-only";
import { headers } from "next/headers";

/**
 * Stocks Maxxing conditions: "Any projects that enable trading for U.S. users are not in scope."
 * Coinbase Tokenized Stocks are also unavailable to US persons. Trading UI is disabled for US visitors
 * (Vercel sets x-vercel-ip-country). Read-only data stays public.
 */
const RESTRICTED = new Set(["US", "PR", "GU", "VI", "AS", "MP", "UM"]);

export async function visitorCountry(): Promise<string | undefined> {
  const h = await headers();
  return h.get("x-vercel-ip-country") ?? process.env.DEV_COUNTRY ?? undefined;
}

export async function isTradingRestricted(): Promise<boolean> {
  const c = await visitorCountry();
  return c !== undefined && RESTRICTED.has(c.toUpperCase());
}
