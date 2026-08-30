import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [".wrangler/**", "node_modules/**"],
  },
});
