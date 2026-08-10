import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const rootDir = new URL(".", import.meta.url).pathname;

// Unit tests for pure functions/helpers, co-located next to their source
// files as *.test.ts. Kept entirely separate from tests/ (Playwright's e2e
// specs) — no shared testDir, no risk of either runner picking up the
// other's files.
export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(rootDir, "./src"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
