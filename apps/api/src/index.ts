import type { Address } from "viem";
import { buildApp } from "./app.js";
import { liveDataSource } from "./data.js";

const app = await buildApp({
  logger: true,
  corsOrigin: process.env.CORS_ORIGIN?.split(",") ?? true,
  data: liveDataSource({
    rpcUrl: process.env.BASE_RPC_URL,
    factory: (process.env.BASKET_FACTORY || undefined) as Address | undefined,
  }),
});

await app.listen({ port: Number(process.env.PORT ?? 4000), host: process.env.HOST ?? "0.0.0.0" });
