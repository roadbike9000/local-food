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
 *
 * The actual sign-in mechanics live in ./clerk-auth.ts's signInAndSave(),
 * shared with tests/products-api.spec.ts, which re-mints the vendor session
 * on its own schedule - see that file's own comment for why a single mint
 * here isn't enough for it (Clerk's session token has a 60s TTL, and this
 * file's own tests can outlast that for a suite reaching them late).
 */
import { type FullConfig } from "@playwright/test";
import { clerkSetup } from "@clerk/testing/playwright";
import { join } from "node:path";
import { signInAndSave } from "./clerk-auth";

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
    try {
      await signInAndSave(
        baseURL,
        vendorEmail,
        join(__dirname, "../.auth/vendor.json"),
      );
    } catch (err) {
      // Caught, not rethrown - a transient sign-in failure for one identity
      // (network blip, Clerk rate limit) must not abort globalSetup and
      // take the other, independently-configured identity down with it.
      // Both identities' own test.skip(!existsSync(authFile), ...) guards
      // already handle a missing auth file gracefully.
      console.warn("[global-setup] vendor sign-in failed, skipping vendor auth fixture:", err);
    }
  }

  const adminEmail = process.env.E2E_ADMIN_EMAIL;
  if (!adminEmail) {
    console.warn(
      "[global-setup] E2E_ADMIN_EMAIL not set - skipping admin auth fixture.",
    );
  } else {
    try {
      await signInAndSave(
        baseURL,
        adminEmail,
        join(__dirname, "../.auth/admin.json"),
      );
    } catch (err) {
      console.warn("[global-setup] admin sign-in failed, skipping admin auth fixture:", err);
    }
  }
}
