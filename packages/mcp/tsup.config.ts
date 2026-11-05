import { defineConfig } from "tsup";

// Bundle the workspace SDK so `npx @base-stocks/mcp` works without publishing it separately.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  clean: true,
  noExternal: ["@base-stocks/sdk"],
});
