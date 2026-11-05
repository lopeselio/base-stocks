#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createPublicClient, http, type Address } from "viem";
import { base } from "viem/chains";
import { StocksApi } from "@base-stocks/sdk";
import { createServer } from "./server.js";

const client = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL),
  batch: { multicall: true },
});

const server = createServer({
  client,
  api: new StocksApi(),
  factory: (process.env.BASKET_FACTORY || undefined) as Address | undefined,
});

await server.connect(new StdioServerTransport());
