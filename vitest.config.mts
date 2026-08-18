import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

const rootDir = new URL(".", import.meta.url).pathname;

// Vitest (unlike `next dev`/`next build`) doesn't load .env into
// process.env on its own - Vite's loadEnv only populates import.meta.env
// by default. Prisma reads process.env.DATABASE_URL directly, so without
// this, any test that touches the DB fails with "environment variable not
// found: DATABASE_URL" regardless of whether a .env file exists.
for (const [key, value] of Object.entries(loadEnv("", rootDir, ""))) {
  process.env[key] ??= value;
}

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
