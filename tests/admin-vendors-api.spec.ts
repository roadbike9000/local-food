import { existsSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";
import { deleteVendorBySlug, prisma } from "./helpers/db";

/**
 * API-level coverage for POST /api/admin/vendors — Story 2.2's new
 * admin-vendor-creation endpoint (AC #1, #2).
 *
 * Two identities are needed, same shape as admin.spec.ts: the success/
 * slug-collision/400 cases run as the seeded Admin (playwright/.auth/
 * admin.json, Story 2.1's fixture), and the 401 case deliberately uses the
 * *Vendor* session (playwright/.auth/vendor.json) instead - proving the
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
      "[P0] creates a vendor with clerkUserId: null and createdByAdminId set to the acting admin (201)",
      async ({ page }) => {
        const unique = Date.now();
        const name = `Test Vendor ${unique}`;
        const slug = `test-vendor-${unique}`;
        // Cleanup must key off the *server-returned* slug, not the one
        // sent - resolveVendorSlug() normalizes, so a future fixture whose
        // input isn't already normalized would otherwise leak a row.
        let createdSlug: string | undefined;

        try {
          const response = await page.request.post("/api/admin/vendors", {
            data: {
              name,
              slug,
              phone: "+15555550199",
              description: "ATDD-created vendor, Story 2.2.",
            },
          });

          expect(response.status()).toBe(201);
          const body = await response.json();
          createdSlug = body.vendor.slug;
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
          expect(actingAdmin).not.toBeNull();
          const persisted = await prisma.vendor.findUnique({ where: { slug } });
          expect(persisted).not.toBeNull();
          expect(persisted?.clerkUserId).toBeNull();
          expect(persisted?.createdByAdminId).toBe(actingAdmin?.id);
        } finally {
          await deleteVendorBySlug(createdSlug ?? slug);
        }
      },
    );

    test(
      "[P0] normalizes a denormalized slug rather than storing it verbatim — review finding",
      async ({ page }) => {
        // slugify() lowercases, replaces non-alphanumeric runs with a
        // single "-", and trims leading/trailing "-". A slug submitted as
        // typed text (spaces, capitals) must come back normalized, not
        // stored as-is - this is the whole point of resolveVendorSlug()
        // normalizing *before* the uniqueness check, not after.
        const unique = Date.now();
        const submittedSlug = `  Test Vendor ${unique}!!  `;
        const expectedSlug = `test-vendor-${unique}`;

        try {
          const response = await page.request.post("/api/admin/vendors", {
            data: { name: `Test Vendor ${unique}`, slug: submittedSlug },
          });

          expect(response.status()).toBe(201);
          const body = await response.json();
          expect(body.vendor.slug).toBe(expectedSlug);

          const persisted = await prisma.vendor.findUnique({
            where: { slug: expectedSlug },
          });
          expect(persisted).not.toBeNull();
        } finally {
          await deleteVendorBySlug(expectedSlug);
        }
      },
    );

    test(
      "[P0] rejects a slug that collides with a seeded vendor (409, no duplicate row)",
      async ({ page }) => {
        // corner-sourdough is one of the two seeded vendors (prisma/
        // seed.ts) - the deliberate collision target called out in this
        // story's Testing Standards Summary. Never touch the seeded row
        // itself, just collide with its slug.
        const collidingSlug = "corner-sourdough";
        const beforeCount = await prisma.vendor.count({
          where: { slug: collidingSlug },
        });

        const response = await page.request.post("/api/admin/vendors", {
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

    test(
      "[P0] rejects a slug that normalizes to empty (409, no unreachable vendor created) — review finding",
      async ({ page }) => {
        // slugify() strips every non-alphanumeric character, so an
        // all-punctuation slug like "!!!" would otherwise normalize to ""
        // and create a Vendor whose storefront (/vendors/) matches no
        // route. resolveVendorSlug() rejects this before create() runs.
        const beforeCount = await prisma.vendor.count({ where: { slug: "" } });

        const response = await page.request.post("/api/admin/vendors", {
          data: { name: `Test Vendor ${Date.now()}`, slug: "!!!" },
        });

        expect(response.status()).toBe(409);
        const body = await response.json();
        expect(body.error).toMatch(/no usable characters/i);

        const afterCount = await prisma.vendor.count({ where: { slug: "" } });
        expect(afterCount).toBe(beforeCount);
      },
    );

    test(
      "[P0] rejects a request body missing the required name field (400)",
      async ({ page }) => {
        const response = await page.request.post("/api/admin/vendors", {
          data: { slug: `test-vendor-${Date.now()}` },
        });

        expect(response.status()).toBe(400);
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
    // products-api.spec.ts/admin.spec.ts, same Clerk/Playwright concurrency
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
        const response = await page.request.post("/api/admin/vendors", {
          data: {
            name: `Test Vendor ${Date.now()}`,
            slug: `test-vendor-${Date.now()}`,
          },
        });

        expect(response.status()).toBe(401);
      },
    );
  });

  // No storageState at all - a genuinely anonymous caller, distinct from
  // "signed in but not an admin" above. Needs no fixture, so it always
  // runs regardless of E2E_VENDOR_*/E2E_ADMIN_* configuration (review
  // finding: this case was previously untested even though nothing about
  // it required the missing admin credentials). Caught by middleware.ts's
  // isProtectedApiRoute matcher before this route's own getCurrentAdmin()
  // check ever runs.
  test("[P0] a fully unauthenticated request is rejected (401)", async ({
    request,
  }) => {
    const response = await request.post("/api/admin/vendors", {
      data: {
        name: `Test Vendor ${Date.now()}`,
        slug: `test-vendor-${Date.now()}`,
      },
    });

    expect(response.status()).toBe(401);
  });
});
