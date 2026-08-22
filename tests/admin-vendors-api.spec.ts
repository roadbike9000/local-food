import { existsSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";
import { deleteVendorBySlug, prisma } from "./helpers/db";

/**
 * API-level coverage for POST /api/admin/vendors — Story 2.2's new
 * admin-vendor-creation endpoint (AC #1, #2). Red-phase ATDD scaffold:
 * every test below is `test.skip`ped on purpose, and the route doesn't
 * exist yet (src/app/api/admin/vendors/route.ts lands in Task 4) - until
 * then, an unskipped run here would 404/network-error, not fail on an
 * assertion.
 *
 * Two identities are needed, same shape as admin.spec.ts: the success/
 * slug-collision/400 cases run as the seeded Admin (playwright/.auth/
 * admin.json, Story 2.1's fixture), and the 401 case deliberately uses the
 * *Vendor* session (playwright/.auth/vendor.json) instead - proving the
 * route's own getCurrentAdmin() check rejects a signed-in-but-not-admin
 * caller. This route is NOT covered by middleware.ts's /admin(.*) matcher
 * (its real path, /api/admin/vendors, is a different prefix - see the
 * story's Task 4 notes), so that self-check is the only thing standing
 * between a regular vendor and admin-only vendor creation.
 */
const adminAuthFile = join(process.cwd(), "playwright/.auth/admin.json");
const vendorAuthFile = join(process.cwd(), "playwright/.auth/vendor.json");

test.describe("POST /api/admin/vendors (ATDD, Story 2.2)", () => {
  test.describe("as a signed-in admin", () => {
    // See the matching comment in admin.spec.ts - a missing authFile
    // otherwise throws ENOENT here instead of letting the beforeEach
    // test.skip guard below handle it.
    test.use({
      storageState: existsSync(adminAuthFile) ? adminAuthFile : undefined,
    });
    // Serial, not parallel - shares the admin session with admin.spec.ts,
    // same Clerk/Playwright concurrency workaround (clerk/javascript#7891)
    // already applied everywhere else authenticated tests exist in this
    // codebase.
    test.describe.configure({ mode: "serial" });

    test.beforeEach(async () => {
      test.skip(
        !existsSync(adminAuthFile),
        "No admin session — E2E_ADMIN_EMAIL/CLERK_SECRET_KEY not configured",
      );
    });

    test.skip(
      "[P0] creates a vendor with clerkUserId: null and createdByAdminId set to the acting admin (201)",
      async ({ request }) => {
        const unique = Date.now();
        const name = `Test Vendor ${unique}`;
        const slug = `test-vendor-${unique}`;

        try {
          const response = await request.post("/api/admin/vendors", {
            data: {
              name,
              slug,
              phone: "+15555550199",
              description: "ATDD-created vendor, Story 2.2.",
            },
          });

          expect(response.status()).toBe(201);
          const body = await response.json();
          expect(body.vendor).toMatchObject({ name, slug, clerkUserId: null });

          // AC #1: createdByAdminId must target Admin.id (the row id), not
          // Admin.clerkUserId (AD-5's attribution FK) - verify via a direct
          // Prisma read-back, not just the response body. Resolve the
          // acting admin's row the same way prisma/seed.ts binds it.
          const actingAdmin = await prisma.admin.findUnique({
            where: {
              clerkUserId: process.env.E2E_ADMIN_CLERK_ID || "seed_user_admin",
            },
          });
          const persisted = await prisma.vendor.findUnique({ where: { slug } });
          expect(persisted?.clerkUserId).toBeNull();
          expect(persisted?.createdByAdminId).toBe(actingAdmin?.id);
        } finally {
          await deleteVendorBySlug(slug);
        }
      },
    );

    test.skip(
      "[P0] rejects a slug that collides with a seeded vendor (409, no duplicate row)",
      async ({ request }) => {
        // corner-sourdough is one of the two seeded vendors (prisma/
        // seed.ts) - the deliberate collision target called out in this
        // story's Testing Standards Summary. Never touch the seeded row
        // itself, just collide with its slug.
        const collidingSlug = "corner-sourdough";
        const beforeCount = await prisma.vendor.count({
          where: { slug: collidingSlug },
        });

        const response = await request.post("/api/admin/vendors", {
          data: { name: `Test Vendor ${Date.now()}`, slug: collidingSlug },
        });

        expect(response.status()).toBe(409);
        const body = await response.json();
        expect(body.error).toMatch(/already in use/i);

        const afterCount = await prisma.vendor.count({
          where: { slug: collidingSlug },
        });
        expect(afterCount).toBe(beforeCount);
      },
    );

    test.skip(
      "[P0] rejects a request body missing the required name field (400)",
      async ({ request }) => {
        const response = await request.post("/api/admin/vendors", {
          data: { slug: `test-vendor-${Date.now()}` },
        });

        expect(response.status()).toBe(400);
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
    // products-api.spec.ts/admin.spec.ts, same Clerk/Playwright concurrency
    // issue those files already work around.
    test.describe.configure({ mode: "serial" });

    test.beforeEach(async () => {
      test.skip(
        !existsSync(vendorAuthFile),
        "No vendor session — E2E_VENDOR_EMAIL/CLERK_SECRET_KEY not configured",
      );
    });

    test.skip(
      "[P0] a signed-in vendor (not an admin) is rejected (401)",
      async ({ request }) => {
        const response = await request.post("/api/admin/vendors", {
          data: {
            name: `Test Vendor ${Date.now()}`,
            slug: `test-vendor-${Date.now()}`,
          },
        });

        expect(response.status()).toBe(401);
      },
    );
  });
});
