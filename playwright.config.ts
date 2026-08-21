import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Some tests (webhook + API-level specs) talk to Prisma/Stripe directly from
// the Node test process, not just through the app's own browser-driven HTTP
// calls — that process needs its own copy of .env, since only Next.js
// (running as the webServer below) auto-loads it. Same minimal loader as
// playwright/support/generate-vendor-auth.ts; no dotenv dependency in this repo.
function loadEnvFile() {
  const path = join(__dirname, ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
  }
}
loadEnvFile();

// Playwright drives a real browser against the running app. In CI we start the
// dev server automatically (webServer below).
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // `next dev` compiles routes on demand; with 4 parallel workers now hitting
  // many more distinct routes than the original 9-test suite did, first-hit
  // compilation can occasionally outrun the 30s default, especially under
  // machine load. Bumped rather than reducing worker count, to keep wall-clock
  // suite time down.
  timeout: 45_000,
  reporter: "html",
  // Authenticates the E2E vendor via Clerk's Backend API and writes
  // playwright/.auth/vendor.json fresh before every run - see
  // playwright/support/global-setup.ts for why this replaced a manual,
  // human-in-the-loop script.
  globalSetup: "./playwright/support/global-setup.ts",
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
