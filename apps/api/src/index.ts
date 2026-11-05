// Entrypoint for Node and for Vercel's Fastify preset (which requires this file to import fastify).
import Fastify from "fastify";
import type { Address } from "viem";
import { registerRoutes } from "./routes.js";
import { liveDataSource } from "./data.js";

const app = Fastify({ logger: true });

await registerRoutes(app, {
  corsOrigin: process.env.CORS_ORIGIN?.split(",") ?? true,
  data: liveDataSource({
    rpcUrl: process.env.BASE_RPC_URL,
    factory: (process.env.BASKET_FACTORY || undefined) as Address | undefined,
  }),
});

// Not awaited: on Vercel the Fastify shim takes over listen(), and awaiting it at module top level
// blocks module evaluation so the function never becomes ready.
app.listen({ port: Number(process.env.PORT ?? 4000), host: process.env.HOST ?? "0.0.0.0" }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
});
