import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { isAddress, type Address } from "viem";
import type { DataSource } from "./data.js";

export interface RouteOptions {
  data: DataSource;
  corsOrigin?: string | string[] | boolean;
}

export interface AppOptions extends RouteOptions {
  logger?: boolean;
}

/** Build a standalone app (used by tests). The Vercel/Node entrypoint is src/index.ts. */
export async function buildApp({ logger = false, ...opts }: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger });
  await registerRoutes(app, opts);
  return app;
}

/**
 * Read-only HTTP API over Coinbase tokenized stocks and StockBaskets on Base.
 * Routes are versioned under /v1 and cache-friendly (s-maxage + stale-while-revalidate).
 */
export async function registerRoutes(app: FastifyInstance, { data, corsOrigin = true }: RouteOptions) {
  await app.register(cors, { origin: corsOrigin, methods: ["GET"] });

  const cache = (seconds: number) => `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 4}`;

  app.get("/health", async () => ({ ok: true }));

  app.get("/v1/board", async (_req, reply) => {
    reply.header("cache-control", cache(30));
    return { stocks: await data.board() };
  });

  app.get("/v1/stocks", async (_req, reply) => {
    reply.header("cache-control", cache(300));
    const stocks = await data.stocks();
    return { count: stocks.length, stocks };
  });

  app.get("/v1/baskets/preview/mag7", async (_req, reply) => {
    reply.header("cache-control", cache(30));
    return await data.mag7();
  });

  app.get("/v1/baskets", async (_req, reply) => {
    reply.header("cache-control", cache(15));
    return { baskets: await data.baskets() };
  });

  app.get<{ Params: { address: string } }>("/v1/baskets/:address", async (req, reply) => {
    const { address } = req.params;
    if (!isAddress(address)) return reply.code(400).send({ error: "invalid address" });
    try {
      reply.header("cache-control", cache(15));
      return await data.basket(address as Address);
    } catch {
      return reply.code(404).send({ error: "not a StockBasket" });
    }
  });
}
