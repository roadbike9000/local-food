/**
 * Runs once before every `npx playwright test` invocation. Authenticates the
 * E2E test vendor via Clerk's Backend API (@clerk/testing) — no UI
 * navigation, no email 2FA challenge, no human required — and saves the
 * resulting session to playwright/.auth/vendor.json, the same path
 * tests/dashboard.spec.ts and tests/products-api.spec.ts already reference
 * via `test.use({ storageState: authFile })`.
 *
 * This replaces the old playwright/support/generate-vendor-auth.ts, which
 * drove the real sign-in UI and needed a human to read an emailed
 * verification code. Because this now runs automatically on every test run,
 * the "stale session, nobody regenerated it" failure mode (tracked since
 * Story 1.1's review, grew to 17 blocked tests by the end of Epic 1) can't
 * recur — the session is always fresh for whichever run is using it.
 *
 * If E2E_VENDOR_EMAIL/CLERK_SECRET_KEY aren't set (e.g. a fresh clone
 * without test credentials configured yet), this warns and skips writing
 * the auth file rather than failing the whole suite — the existing
 * `test.skip(!existsSync(authFile), ...)` guards in dashboard.spec.ts and
 * products-api.spec.ts already handle that gracefully.
 */
import { chromium, type FullConfig } from "@playwright/test";
import { clerkSetup, clerk } from "@clerk/testing/playwright";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

export default async function globalSetup(config: FullConfig) {
  const email = process.env.E2E_VENDOR_EMAIL;
  const secretKey = process.env.CLERK_SECRET_KEY;

  if (!email || !secretKey) {
    console.warn(
      "[global-setup] E2E_VENDOR_EMAIL/CLERK_SECRET_KEY not set - skipping vendor auth fixture. Authenticated tests will skip themselves via their existing existsSync(authFile) guard.",
    );
    return;
  }

  await clerkSetup();

  const baseURL =
    config.projects[0]?.use?.baseURL ?? "http://localhost:3000";

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(baseURL);
  await clerk.signIn({ page, emailAddress: email });

  const outPath = join(__dirname, "../.auth/vendor.json");
  mkdirSync(dirname(outPath), { recursive: true });
  await page.context().storageState({ path: outPath });

  await browser.close();
}
