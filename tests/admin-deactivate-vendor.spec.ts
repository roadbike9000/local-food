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
 * caller. This route is NOT covered by middleware.ts's /admin(.*) matcher
 * (its real path, /api/admin/vendors/[id]/deactivate, is a different
 * prefix — same reasoning as admin-vendors-api.spec.ts's file header), so
 * that self-check is the only thing standing between a regular vendor and
 * admin-only vendor deactivation. A final fully-unauthenticated case needs
 * no fixture at all.
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

    test.beforeEach(async () => {
      test.skip(
        !existsSync(adminAuthFile),
        "No admin session — E2E_ADMIN_EMAIL/CLERK_SECRET_KEY not configured",
      );
    });

    test(
      "[P0] deactivates an active vendor: 200, deletedAt set, deletedByAdminId matches the acting admin (AC #1)",
      async ({ request }) => {
        const vendor = await createTestVendor();

        try {
          const response = await request.post(
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
      async ({ request }) => {
        // Pre-deactivated by a different (fake) admin id via the test
        // helper, bypassing the real route entirely - proves the route's
        // check-then-conditionally-update guard doesn't reassign
        // attribution to whoever double-clicks/retries the deactivate
        // call. The real seeded admin below is a *different* admin than
        // whoever "originally" deactivated this fixture.
        const originalDeactivatorId = "some-other-admin-id";
        const vendor = await createTestVendor({
          deletedAt: new Date(),
          deletedByAdminId: originalDeactivatorId,
        });

        try {
          const response = await request.post(
            `/api/admin/vendors/${vendor.id}/deactivate`,
          );

          expect(response.status()).toBe(200);

          const persisted = await prisma.vendor.findUnique({
            where: { id: vendor.id },
          });
          expect(persisted?.deletedAt).not.toBeNull();
          // Attribution must stay with whoever deactivated it first, not
          // get overwritten by this retry's caller.
          expect(persisted?.deletedByAdminId).toBe(originalDeactivatorId);
        } finally {
          await deleteVendorBySlug(vendor.slug);
        }
      },
    );

    test(
      "[P0] deactivating a nonexistent vendor id returns 404",
      async ({ request }) => {
        const response = await request.post(
          "/api/admin/vendors/nonexistent-vendor-id/deactivate",
        );

        expect(response.status()).toBe(404);
      },
    );
  });

  test.describe("as a signed-in vendor (not an admin)", () => {
    // This is the one case in this file that needs the *vendor* fixture,
    // not the admin one - proves the route's own getCurrentAdmin() check,
    // not just middleware (which doesn't cover this path at all - see the
    // file header comment above).
    test.use({
      storageState: existsSync(vendorAuthFile) ? vendorAuthFile : undefined,
    });
    // Serial - shares the vendor session with dashboard.spec.ts/
    // products-api.spec.ts/admin.spec.ts/admin-vendors-api.spec.ts, same
    // Clerk/Playwright concurrency issue those files already work around.
    test.describe.configure({ mode: "serial" });

    test.beforeEach(async () => {
      test.skip(
        !existsSync(vendorAuthFile),
        "No vendor session — E2E_VENDOR_EMAIL/CLERK_SECRET_KEY not configured",
      );
    });

    test(
      "[P0] a signed-in vendor (not an admin) is rejected (401)",
      async ({ request }) => {
        const response = await request.post(
          "/api/admin/vendors/nonexistent-vendor-id/deactivate",
        );

        expect(response.status()).toBe(401);
      },
    );
  });

  // No storageState at all - a genuinely anonymous caller, distinct from
  // "signed in but not an admin" above. Needs no fixture, so it always
  // runs regardless of E2E_VENDOR_*/E2E_ADMIN_* configuration, same
  // pattern admin-vendors-api.spec.ts's review added.
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
