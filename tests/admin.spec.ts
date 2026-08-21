import { existsSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";

// Two independent identities, two independent auth files -
// playwright/support/global-setup.ts writes each one only if its own
// E2E_*_EMAIL/CLERK_SECRET_KEY are configured. Either can be present
// without the other.
const vendorAuthFile = join(process.cwd(), "playwright/.auth/vendor.json");
const adminAuthFile = join(process.cwd(), "playwright/.auth/admin.json");

// Story 2.1: a signed-in Vendor (no Admin row) hitting /admin must be
// denied - proves AC #3's "signed-in non-admin" case using the existing
// vendor fixture, no new fixture needed.
test.describe("admin gating (signed in as vendor)", () => {
  // `storageState` is resolved at browser-context creation, before
  // beforeEach's test.skip() below ever runs - a missing file throws
  // ENOENT instead of skipping gracefully. Passing undefined when the file
  // doesn't exist yet gives Playwright an empty (unauthenticated) context
  // instead, so the file-existence check below is what actually decides
  // skip-vs-run.
  test.use({
    storageState: existsSync(vendorAuthFile) ? vendorAuthFile : undefined,
  });
  // Serial - shares the vendor session with dashboard.spec.ts/
  // products-api.spec.ts, same Clerk/Playwright concurrency issue
  // (clerk/javascript#7891) those files already work around.
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    test.skip(
      !existsSync(vendorAuthFile),
      "No vendor session — E2E_VENDOR_EMAIL/CLERK_SECRET_KEY not configured",
    );
    // Clerk's saved session needs one full page load to become valid
    // against the middleware - see dashboard.spec.ts's identical warm-up.
    await page.goto("/");
  });

  test("a vendor (not an admin) visiting /admin is denied", async ({
    page,
  }) => {
    const response = await page.goto("/admin");
    expect(response?.status()).toBe(404);
  });
});

// A signed-in Admin hitting /admin succeeds - proves AC #2's full
// round-trip (middleware authenticates, getCurrentAdmin() authorizes).
test.describe("admin gating (signed in as admin)", () => {
  // See the matching comment in the vendor block above.
  test.use({
    storageState: existsSync(adminAuthFile) ? adminAuthFile : undefined,
  });
  // Serial - same Clerk/Playwright concurrency issue as the vendor block
  // above, for this file's own (new) admin session.
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    test.skip(
      !existsSync(adminAuthFile),
      "No admin session — E2E_ADMIN_EMAIL/CLERK_SECRET_KEY not configured",
    );
    await page.goto("/");
  });

  test("an admin visiting /admin is granted access", async ({ page }) => {
    const response = await page.goto("/admin");
    // A middleware redirect to /sign-in also resolves with a 200 (the
    // sign-in page itself loads fine) - the status check alone can't tell
    // "granted" from "bounced to sign-in", so also pin the URL and the
    // page content, not just the response status.
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
  });
});
