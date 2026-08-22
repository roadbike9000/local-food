import { existsSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";
import {
  createTestVendor,
  createTestProduct,
  deleteProduct,
  deleteVendorBySlug,
} from "./helpers/db";

/**
 * UI-level coverage for /admin/inventory (Story 3.1) — the cross-vendor
 * stock-level dashboard (FR-9). Same admin/vendor/unauthenticated
 * three-identity shape as tests/admin.spec.ts and
 * tests/admin-deactivate-vendor.spec.ts: the admin-granted cases run as
 * the seeded Admin (playwright/.auth/admin.json), the denial case
 * deliberately uses the *Vendor* session (playwright/.auth/vendor.json)
 * to prove the route's own getCurrentAdmin() check, and a final
 * fully-unauthenticated case needs no fixture at all.
 */
const adminAuthFile = join(process.cwd(), "playwright/.auth/admin.json");
const vendorAuthFile = join(process.cwd(), "playwright/.auth/vendor.json");

test.describe("GET /admin/inventory (ATDD, Story 3.1)", () => {
  test.describe("as a signed-in admin", () => {
    // storageState is resolved at browser-context creation, before the
    // beforeEach test.skip guard below ever runs — a missing file throws
    // ENOENT and fails the suite instead of skipping (Story 2.1 review
    // finding, applied verbatim in every authenticated block since).
    test.use({
      storageState: existsSync(adminAuthFile) ? adminAuthFile : undefined,
    });
    // Serial, not parallel — shares the admin session with every other
    // admin-authenticated file (clerk/javascript#7891).
    test.describe.configure({ mode: "serial" });

    test.beforeEach(async ({ page }) => {
      test.skip(
        !existsSync(adminAuthFile),
        "No admin session — E2E_ADMIN_EMAIL/CLERK_SECRET_KEY not configured",
      );
      // Clerk's saved session needs one full page load to become valid
      // against the middleware before the real navigation below (same
      // warm-up as tests/admin-vendors.spec.ts/tests/dashboard.spec.ts).
      await page.goto("/");
    });

    test(
      "[P0] admin sees a product's Stock Quantity and Low-Stock Threshold rendered (AC #1)",
      async ({ page }) => {
        let vendor: Awaited<ReturnType<typeof createTestVendor>> | undefined;
        let product: Awaited<ReturnType<typeof createTestProduct>> | undefined;
        try {
          vendor = await createTestVendor();
          product = await createTestProduct(vendor.id, {
            name: "Playwright Inventory Dashboard Product",
            stockQuantity: 42,
            lowStockThreshold: 10,
          });

          await page.goto("/admin/inventory");

          const row = page.getByRole("row").filter({ hasText: product.name });
          await expect(row).toBeVisible();
          // Scoped to the specific cells, not just "somewhere in the
          // row" — otherwise swapping the Stock Quantity/Low-Stock
          // Threshold columns would still pass (review finding).
          const cells = row.getByRole("cell");
          await expect(cells.nth(2)).toContainText("42");
          await expect(cells.nth(3)).toHaveText("10");
        } finally {
          if (product) await deleteProduct(product.id);
          if (vendor) await deleteVendorBySlug(vendor.slug);
        }
      },
    );

    test(
      "[P0] a product at/below its Low-Stock Threshold is visually flagged; one comfortably above it is not (AC #2)",
      async ({ page }) => {
        let vendor: Awaited<ReturnType<typeof createTestVendor>> | undefined;
        let lowProduct: Awaited<ReturnType<typeof createTestProduct>> | undefined;
        let healthyProduct: Awaited<ReturnType<typeof createTestProduct>> | undefined;
        try {
          vendor = await createTestVendor();
          // Deliberately does NOT contain the substring "low stock" —
          // the badge itself renders the literal text "Low stock", and a
          // fixture name containing that phrase makes
          // row.getByText(/low stock/i) match two elements (the name
          // cell and the badge) and throw a strict-mode violation
          // (review finding, reproduced).
          lowProduct = await createTestProduct(vendor.id, {
            name: "Playwright Understocked Product",
            stockQuantity: 3,
            lowStockThreshold: 5,
          });
          healthyProduct = await createTestProduct(vendor.id, {
            name: "Playwright Wellstocked Product",
            stockQuantity: 50,
            lowStockThreshold: 5,
          });

          await page.goto("/admin/inventory");

          const lowRow = page
            .getByRole("row")
            .filter({ hasText: lowProduct.name });
          const healthyRow = page
            .getByRole("row")
            .filter({ hasText: healthyProduct.name });

          // Accessible flag, not a title-only tooltip (Epic 1's recurring
          // a11y gap, Stories 1.5/1.6) — asserting on visible text, not a
          // hover-only title attribute.
          await expect(
            lowRow.getByText("Low stock", { exact: true }),
          ).toBeVisible();

          // Assert the row itself rendered before asserting the badge's
          // absence — otherwise this passes vacuously if the row (or
          // the whole table) never rendered at all (review finding).
          await expect(healthyRow).toBeVisible();
          await expect(
            healthyRow.getByText("Low stock", { exact: true }),
          ).toHaveCount(0);
        } finally {
          if (lowProduct) await deleteProduct(lowProduct.id);
          if (healthyProduct) await deleteProduct(healthyProduct.id);
          if (vendor) await deleteVendorBySlug(vendor.slug);
        }
      },
    );

    test(
      "[P1] a product belonging to a deactivated vendor still appears in the list (deliberate 'all vendors' scope, Task 2)",
      async ({ page }) => {
        let vendor: Awaited<ReturnType<typeof createTestVendor>> | undefined;
        let product: Awaited<ReturnType<typeof createTestProduct>> | undefined;
        try {
          vendor = await createTestVendor({ deletedAt: new Date() });
          product = await createTestProduct(vendor.id, {
            name: "Playwright Deactivated Vendor Inventory Product",
            stockQuantity: 7,
            lowStockThreshold: 2,
          });

          await page.goto("/admin/inventory");

          await expect(
            page.getByRole("row").filter({ hasText: product.name }),
          ).toBeVisible();
        } finally {
          if (product) await deleteProduct(product.id);
          if (vendor) await deleteVendorBySlug(vendor.slug);
        }
      },
    );
  });

  test.describe("as a signed-in vendor (not an admin)", () => {
    // This is the one case in this file that needs the *vendor* fixture,
    // not the admin one — proves the route's own getCurrentAdmin() check,
    // not just middleware (which only proves authenticated).
    test.use({
      storageState: existsSync(vendorAuthFile) ? vendorAuthFile : undefined,
    });
    test.describe.configure({ mode: "serial" });

    test.beforeEach(async ({ page }) => {
      test.skip(
        !existsSync(vendorAuthFile),
        "No vendor session — E2E_VENDOR_EMAIL/CLERK_SECRET_KEY not configured",
      );
      // Clerk's saved session needs one full page load to become valid
      // against the middleware before the real navigation below — same
      // warm-up as the admin block above and every other
      // vendor-authenticated block in this codebase (tests/admin.spec.ts,
      // tests/dashboard.spec.ts). Missing this can bounce the very first
      // navigation to /sign-in (a 200) and fail the 404 assertion below
      // (review finding).
      await page.goto("/");
    });

    // Note: this 404 is indistinguishable from "the route doesn't exist
    // at all" — the codebase has no custom not-found.tsx anywhere, so a
    // genuinely-missing route and a real notFound() call produce the
    // identical response. This is an inherited limitation, not new to
    // this file (tests/admin.spec.ts's own vendor-denial test against
    // the already-existing /admin has the identical shape) — flagged
    // here because it means this specific test could not, on its own,
    // have proven /admin/inventory ever existed during this story's red
    // phase. The real proof that AC #1/#2's behavior is correct is the
    // admin-authenticated tests above, which cannot pass without the
    // page's actual content (review finding).
    test(
      "[P0] a signed-in vendor (not an admin) is denied (404, AC #3)",
      async ({ page }) => {
        const response = await page.goto("/admin/inventory");
        expect(response?.status()).toBe(404);
      },
    );
  });

  // No storageState at all — a genuinely anonymous caller. Needs no
  // fixture, so it always runs regardless of E2E_VENDOR_*/E2E_ADMIN_*
  // configuration, matching the pattern every prior admin-page test file
  // in this codebase already established.
  test(
    "[P0] a fully unauthenticated request is redirected to sign-in",
    async ({ page }) => {
      await page.goto("/admin/inventory");
      await expect(page).toHaveURL(/sign-in/);
    },
  );
});
