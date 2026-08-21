/**
 * Runs once before every `npx playwright test` invocation. Authenticates the
 * E2E test Vendor and Admin identities via Clerk's Backend API
 * (@clerk/testing) — no UI navigation, no email 2FA challenge, no human
 * required — and saves each resulting session to its own storageState file:
 * playwright/.auth/vendor.json and playwright/.auth/admin.json.
 * tests/dashboard.spec.ts, tests/products-api.spec.ts, and tests/admin.spec.ts
 * reference these via `test.use({ storageState: authFile })`.
 *
 * This replaces the old playwright/support/generate-vendor-auth.ts, which
 * drove the real sign-in UI and needed a human to read an emailed
 * verification code. Because this now runs automatically on every test run,
 * the "stale session, nobody regenerated it" failure mode (tracked since
 * Story 1.1's review, grew to 17 blocked tests by the end of Epic 1) can't
 * recur — the session is always fresh for whichever run is using it.
 *
 * Each identity is gated independently: if E2E_VENDOR_EMAIL or
 * E2E_ADMIN_EMAIL isn't set (e.g. a fresh clone, or CI before the Admin
 * secret is configured), this warns and skips writing just that identity's
 * auth file, without affecting the other — the existing
 * `test.skip(!existsSync(authFile), ...)` guards in the relevant spec files
 * already handle a missing file gracefully. Nothing runs at all if
 * CLERK_SECRET_KEY itself is unset, since both identities need it.
 */
import { chromium, type FullConfig } from "@playwright/test";
import { clerkSetup, clerk } from "@clerk/testing/playwright";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

async function signInAndSave(
  baseURL: string,
  email: string,
  outPath: string,
) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(baseURL);
  await clerk.signIn({ page, emailAddress: email });

  mkdirSync(dirname(outPath), { recursive: true });
  await page.context().storageState({ path: outPath });

  await browser.close();
}

export default async function globalSetup(config: FullConfig) {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    console.warn(
      "[global-setup] CLERK_SECRET_KEY not set - skipping both Vendor and Admin auth fixtures. Authenticated tests will skip themselves via their existing existsSync(authFile) guards.",
    );
    return;
  }

  await clerkSetup();

  const baseURL =
    config.projects[0]?.use?.baseURL ?? "http://localhost:3000";

  const vendorEmail = process.env.E2E_VENDOR_EMAIL;
  if (!vendorEmail) {
    console.warn(
      "[global-setup] E2E_VENDOR_EMAIL not set - skipping vendor auth fixture.",
    );
  } else {
    await signInAndSave(
      baseURL,
      vendorEmail,
      join(__dirname, "../.auth/vendor.json"),
    );
  }

  const adminEmail = process.env.E2E_ADMIN_EMAIL;
  if (!adminEmail) {
    console.warn(
      "[global-setup] E2E_ADMIN_EMAIL not set - skipping admin auth fixture.",
    );
  } else {
    await signInAndSave(
      baseURL,
      adminEmail,
      join(__dirname, "../.auth/admin.json"),
    );
  }
}
