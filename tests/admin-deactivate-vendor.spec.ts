import { existsSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";
import { createTestVendor, deleteVendorBySlug, prisma } from "./helpers/db";

/**
 * API-level coverage for POST /api/admin/vendors/[id]/deactivate — Story
 * 2.3's admin-vendor-deactivation endpoint (AC #1).
 *
 * Same three-identity shape as admin-vendors-api.spec.ts: the success/
 * idempotency/404 cases run as the seeded Admin (playwright/.auth/
 * admin.json, Story 2.1's fixture), the 401 case deliberately uses the
 * *Vendor* session (playwright/.auth/vendor.json) instead — proving the
 * route's own getCurrentAdmin() check rejects a signed-in-but-not-admin
 * caller (middleware.ts's isProtectedApiRoute matcher, added after this
 * story shipped, only proves "signed in" - see its own comment for why
 * the split exists; the fully-unauthenticated case at the bottom of this
 * file is the one middleware alone actually catches).
 *
 * Uses the `page` fixture (with a page.goto("/") warm-up), not a bare
 * `request` fixture, for both authenticated blocks - a storageState-only
 * APIRequestContext never runs any page JS, so Clerk's session cookie is
 * used exactly as captured at global-setup time with no live refresh
 * (Story 7.1 code review finding, reproduced by an identical failure in
 * tests/dashboard.spec.ts once that test ran late enough into a long
 * full-suite run for the captured cookie to go stale). A real page load
 * lets Clerk's client-side SDK do its normal refresh.
 */
const adminAuthFile = join(process.cwd(), "playwright/.auth/admin.json");
const vendorAuthFile = join(process.cwd(), "playwright/.auth/vendor.json");

test.describe("POST /api/admin/vendors/[id]/deactivate (ATDD, Story 2.3)", () => {
  test.describe("as a signed-in admin", () => {
    // See the matching comment in admin-vendors-api.spec.ts - a missing
    // authFile otherwise throws ENOENT here instead of letting the
    // beforeEach test.skip guard below handle it.
    test.use({
      storageState: existsSync(adminAuthFile) ? adminAuthFile : undefined,
    });
    // Serial, not parallel - shares the admin session with admin.spec.ts/
    // admin-vendors-api.spec.ts, same Clerk/Playwright concurrency
    // workaround (clerk/javascript#7891) already applied everywhere else
    // authenticated tests exist in this codebase.
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
      "[P0] deactivates an active vendor: 200, deletedAt set, deletedByAdminId matches the acting admin (AC #1)",
      async ({ page }) => {
        const vendor = await createTestVendor();

        try {
          const response = await page.request.post(
            `/api/admin/vendors/${vendor.id}/deactivate`,
          );

          expect(response.status()).toBe(200);
          const body = await response.json();
          expect(body.vendor.deletedAt).not.toBeNull();

          // AC #1: deletedByAdminId must target Admin.id (the row id), not
          // Admin.clerkUserId (AD-5's attribution FK) - verify via a
          // direct Prisma read-back, same pattern as Story 2.2's creation
          // test. Resolve the acting admin's row the same way
          // prisma/seed.ts binds it.
          const actingAdmin = await prisma.admin.findUnique({
            where: {
              clerkUserId: process.env.E2E_ADMIN_CLERK_ID || "seed_user_admin",
            },
          });
          expect(actingAdmin).not.toBeNull();

          const persisted = await prisma.vendor.findUnique({
            where: { id: vendor.id },
          });
          expect(persisted?.deletedAt).not.toBeNull();
          expect(persisted?.deletedByAdminId).toBe(actingAdmin?.id);
        } finally {
          await deleteVendorBySlug(vendor.slug);
        }
      },
    );

    test(
      "[P0] deactivating an already-deactivated vendor is idempotent: 200, deletedByAdminId unchanged (Task 3)",
      async ({ page }) => {
        // Pre-deactivated by a *different, real* admin row via the test
        // helper, bypassing the real route entirely - proves the route's
        // atomic-claim guard (updateMany({ where: { deletedAt: null } }))
        // doesn't reassign attribution to whoever double-clicks/retries
        // the deactivate call. Must be a real Admin row, not a fake id
        // string: Vendor.deletedByAdminId has a real FK constraint
        // (review finding - the original version of this test used a
        // fake id and failed every run with P2003, invisible only because
        // the whole block was skipped for want of admin credentials).
        const originalDeactivator = await prisma.admin.create({
          data: { clerkUserId: `test-original-deactivator-${Date.now()}` },
        });
        const vendor = await createTestVendor({
          deletedAt: new Date(),
          deletedByAdminId: originalDeactivator.id,
        });

        try {
          const response = await page.request.post(
            `/api/admin/vendors/${vendor.id}/deactivate`,
          );

          expect(response.status()).toBe(200);

          const persisted = await prisma.vendor.findUnique({
            where: { id: vendor.id },
          });
          expect(persisted?.deletedAt).not.toBeNull();
          // Attribution must stay with whoever deactivated it first, not
          // get overwritten by this retry's caller.
          expect(persisted?.deletedByAdminId).toBe(originalDeactivator.id);
        } finally {
          await deleteVendorBySlug(vendor.slug);
          await prisma.admin.delete({ where: { id: originalDeactivator.id } });
        }
      },
    );

    test(
      "[P0] deactivating a nonexistent vendor id returns 404",
      async ({ page }) => {
        const response = await page.request.post(
          "/api/admin/vendors/nonexistent-vendor-id/deactivate",
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
    // products-api.spec.ts/admin.spec.ts/admin-vendors-api.spec.ts, same
    // Clerk/Playwright concurrency issue those files already work around.
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
        const response = await page.request.post(
          "/api/admin/vendors/nonexistent-vendor-id/deactivate",
        );

        expect(response.status()).toBe(401);
      },
    );
  });

  // No storageState at all - a genuinely anonymous caller, distinct from
  // "signed in but not an admin" above. Needs no fixture, so it always
  // runs regardless of E2E_VENDOR_*/E2E_ADMIN_* configuration, same
  // pattern admin-vendors-api.spec.ts's review added. Caught by
  // middleware.ts's isProtectedApiRoute matcher before this route's own
  // getCurrentAdmin() check ever runs.
  test(
    "[P0] a fully unauthenticated request is rejected (401)",
    async ({ request }) => {
      const response = await request.post(
        "/api/admin/vendors/nonexistent-vendor-id/deactivate",
      );

      expect(response.status()).toBe(401);
    },
  );
});
