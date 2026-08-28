import { existsSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";
import { createTestVendor, deleteVendorBySlug, prisma } from "./helpers/db";

/**
 * API-level coverage for PATCH /api/admin/vendors/[id] — Story 7.1's
 * admin-vendor-timezone-edit endpoint (AC #2, #5).
 *
 * Same three-identity shape as admin-vendors-api.spec.ts/
 * admin-deactivate-vendor.spec.ts: the success/malformed/404 cases run as
 * the seeded Admin (playwright/.auth/admin.json, Story 2.1's fixture),
 * the 401 case deliberately uses the *Vendor* session
 * (playwright/.auth/vendor.json) instead — proving the route's own
 * getCurrentAdmin() check rejects a signed-in-but-not-admin caller
 * (middleware.ts's isProtectedApiRoute matcher only proves "signed in",
 * not "is an Admin" — see its own comment for why the split exists). A
 * final fully-unauthenticated case needs no fixture at all and is caught
 * by middleware before this route's own check ever runs.
 *
 * Uses the `page` fixture (with a page.goto("/") warm-up), not a bare
 * `request` fixture, for both authenticated blocks — a storageState-only
 * APIRequestContext never runs any page JS, so Clerk's session cookie is
 * used exactly as captured at global-setup time with no live refresh
 * (code review finding, reproduced by an identical failure in
 * tests/dashboard.spec.ts: a request.newContext()-based admin call
 * started 401ing once that test ran late enough into a long full-suite
 * run for the captured cookie to go stale). A real page load lets Clerk's
 * client-side SDK do its normal refresh, matching every other
 * authenticated test in this codebase.
 */
const adminAuthFile = join(process.cwd(), "playwright/.auth/admin.json");
const vendorAuthFile = join(process.cwd(), "playwright/.auth/vendor.json");

test.describe("PATCH /api/admin/vendors/[id] (ATDD, Story 7.1)", () => {
  test.describe("as a signed-in admin", () => {
    // See the matching comment in admin-vendors-api.spec.ts - a missing
    // authFile otherwise throws ENOENT here instead of letting the
    // beforeEach test.skip guard below handle it.
    test.use({
      storageState: existsSync(adminAuthFile) ? adminAuthFile : undefined,
    });
    // Serial, not parallel - shares the admin session with admin.spec.ts/
    // admin-vendors-api.spec.ts/admin-deactivate-vendor.spec.ts, same
    // Clerk/Playwright concurrency workaround (clerk/javascript#7891)
    // already applied everywhere else authenticated tests exist in this
    // codebase.
    test.describe.configure({ mode: "serial" });

    test.beforeEach(async ({ page }) => {
      test.skip(
        !existsSync(adminAuthFile),
        "No admin session — E2E_ADMIN_EMAIL/CLERK_SECRET_KEY not configured",
      );
      // Clerk's saved session needs one full page load to become valid
      // against the middleware, and to let Clerk's client SDK refresh a
      // session close to its TTL - see the file header comment.
      await page.goto("/");
    });

    test(
      "[P0] updates an existing vendor's timezone (200, persisted)",
      async ({ page }) => {
        const vendor = await createTestVendor({ timezone: "America/New_York" });

        try {
          const response = await page.request.patch(`/api/admin/vendors/${vendor.id}`, {
            data: { timezone: "Asia/Tokyo" },
          });

          expect(response.status()).toBe(200);
          const body = await response.json();
          expect(body.vendor.timezone).toBe("Asia/Tokyo");

          const persisted = await prisma.vendor.findUnique({
            where: { id: vendor.id },
          });
          expect(persisted?.timezone).toBe("Asia/Tokyo");
        } finally {
          await deleteVendorBySlug(vendor.slug);
        }
      },
    );

    test(
      "[P0] rejects a malformed timezone string (400, value unchanged)",
      async ({ page }) => {
        const vendor = await createTestVendor({ timezone: "America/New_York" });

        try {
          const response = await page.request.patch(`/api/admin/vendors/${vendor.id}`, {
            data: { timezone: "Not/AZone" },
          });

          expect(response.status()).toBe(400);

          const persisted = await prisma.vendor.findUnique({
            where: { id: vendor.id },
          });
          expect(persisted?.timezone).toBe("America/New_York");
        } finally {
          await deleteVendorBySlug(vendor.slug);
        }
      },
    );

    test(
      "[P0] editing a nonexistent vendor id returns 404",
      async ({ page }) => {
        const response = await page.request.patch(
          "/api/admin/vendors/nonexistent-vendor-id",
          { data: { timezone: "Asia/Tokyo" } },
        );

        expect(response.status()).toBe(404);
      },
    );
  });

  test.describe("as a signed-in vendor (not an admin)", () => {
    // This is the one case in this file that needs the *vendor* fixture,
    // not the admin one - proves the route's own getCurrentAdmin() check
    // rejects a signed-in-but-not-admin caller (middleware only proves
    // "signed in" - see the file header comment above).
    test.use({
      storageState: existsSync(vendorAuthFile) ? vendorAuthFile : undefined,
    });
    // Serial - shares the vendor session with dashboard.spec.ts/
    // products-api.spec.ts/admin.spec.ts/admin-vendors-api.spec.ts/
    // admin-deactivate-vendor.spec.ts, same Clerk/Playwright concurrency
    // issue those files already work around.
    test.describe.configure({ mode: "serial" });

    test.beforeEach(async ({ page }) => {
      test.skip(
        !existsSync(vendorAuthFile),
        "No vendor session — E2E_VENDOR_EMAIL/CLERK_SECRET_KEY not configured",
      );
      await page.goto("/");
    });

    test(
      "[P0] a signed-in vendor (not an admin) is rejected (401)",
      async ({ page }) => {
        const response = await page.request.patch(
          "/api/admin/vendors/nonexistent-vendor-id",
          { data: { timezone: "Asia/Tokyo" } },
        );

        expect(response.status()).toBe(401);
      },
    );
  });

  // No storageState at all - a genuinely anonymous caller, distinct from
  // "signed in but not an admin" above. Needs no fixture (no session to
  // go stale), so it always runs regardless of E2E_VENDOR_*/E2E_ADMIN_*
  // configuration, same pattern the sibling spec files' reviews added.
  // Caught by middleware.ts's isProtectedApiRoute matcher before this
  // route's own getCurrentAdmin() check ever runs.
  test(
    "[P0] a fully unauthenticated request is rejected (401)",
    async ({ request }) => {
      const response = await request.patch(
        "/api/admin/vendors/nonexistent-vendor-id",
        { data: { timezone: "Asia/Tokyo" } },
      );

      expect(response.status()).toBe(401);
    },
  );
});
