import { existsSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";
import { getVendorBySlug, deleteProduct, prisma, createTestProduct } from "./helpers/db";

/**
 * API-level coverage for PATCH /api/products/[id] — Story 1.2's new
 * stock-edit endpoint (AC #4, #5).
 *
 * Requires playwright/support/generate-vendor-auth.ts to have been run once
 * (same pre-existing stale-fixture limitation documented in
 * tests/dashboard.spec.ts and deferred-work.md) — the saved session belongs
 * to the seeded "Corner Sourdough" vendor (prisma/seed.ts binds
 * E2E_VENDOR_CLERK_ID to it), which is why every test below authenticates
 * as Corner Sourdough and uses "Green Valley Produce" as the *other* vendor
 * for the ownership-scoping case.
 */
const authFile = join(process.cwd(), "playwright/.auth/vendor.json");

test.describe("PATCH /api/products/[id] (ATDD, Story 1.2)", () => {
  test.use({ storageState: authFile });

  test.beforeEach(async () => {
    test.skip(
      !existsSync(authFile),
      "No saved vendor session — run `npm run test:e2e:auth` first",
    );
  });

  test(
    "[P0] updates stockQuantity and lowStockThreshold for the caller's own product (200)",
    async ({ request }) => {
      const vendor = await getVendorBySlug("corner-sourdough");
      const product = await createTestProduct(vendor.id, {
        name: "PATCH Success Test Product",
        stockQuantity: 20,
        lowStockThreshold: 5,
      });

      try {
        const response = await request.patch(`/api/products/${product.id}`, {
          data: {
            stockQuantity: 15,
            lowStockThreshold: 3,
            expectedStockQuantity: 20, // matches what was just seeded above
          },
        });

        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body.product).toMatchObject({
          id: product.id,
          stockQuantity: 15,
          lowStockThreshold: 3,
        });
      } finally {
        await deleteProduct(product.id);
      }
    },
  );

  test(
    "[P0] returns 404 when the product belongs to a different vendor (ownership scoping)",
    async ({ request }) => {
      // Ownership scoping is P0 in this codebase's own discipline
      // (project-context.md's "Critical Don't-Miss Rules": vendor/product
      // queries must scope by ownership, never trust a client-supplied ID
      // alone). The authenticated session is Corner Sourdough (see file
      // header) — Green Valley Produce's product must be invisible to it.
      const otherVendor = await getVendorBySlug("green-valley-produce");
      const foreignProduct = await createTestProduct(otherVendor.id, {
        name: "Ownership Scoping Test Product",
        stockQuantity: 10,
        lowStockThreshold: 2,
      });

      try {
        const response = await request.patch(`/api/products/${foreignProduct.id}`, {
          data: {
            stockQuantity: 5,
            lowStockThreshold: 1,
            expectedStockQuantity: 10,
          },
        });

        // Never 200 (leaked write), never a 403 that would confirm the ID
        // exists — 404 is the same "not found or not yours" shape every
        // other vendor-scoped route in this codebase already uses.
        expect(response.status()).toBe(404);
      } finally {
        await deleteProduct(foreignProduct.id);
      }
    },
  );

  test(
    "[P0] returns 400 when the request body fails validation",
    async ({ request }) => {
      const vendor = await getVendorBySlug("corner-sourdough");
      const product = await createTestProduct(vendor.id, {
        name: "Validation Test Product",
        stockQuantity: 10,
        lowStockThreshold: 2,
      });

      try {
        const response = await request.patch(`/api/products/${product.id}`, {
          data: {
            stockQuantity: -5, // UpdateProductStockSchema requires nonnegative
            lowStockThreshold: 2,
            expectedStockQuantity: 10,
          },
        });

        expect(response.status()).toBe(400);
      } finally {
        await deleteProduct(product.id);
      }
    },
  );

  test(
    "[P0] returns 409 when expectedStockQuantity is stale (optimistic-lock conflict, AD-3)",
    async ({ request }) => {
      // This is the entire point of AD-3's design: setStock()'s conditional
      // UPDATE ... WHERE id = :productId AND stockQuantity = :expected must
      // reject an edit built against a value someone else already changed
      // (e.g. a concurrent sale's decrementStock() call), not silently
      // clobber it.
      const vendor = await getVendorBySlug("corner-sourdough");
      const product = await createTestProduct(vendor.id, {
        name: "Conflict Test Product",
        stockQuantity: 20,
        lowStockThreshold: 2,
      });

      try {
        // Simulate a concurrent change that happened after the vendor's
        // form loaded stockQuantity=20 — e.g. a sale decrementing it.
        await prisma.product.update({
          where: { id: product.id },
          data: { stockQuantity: 18 },
        });

        const response = await request.patch(`/api/products/${product.id}`, {
          data: {
            stockQuantity: 15,
            lowStockThreshold: 9, // deliberately different from the seeded 2
            expectedStockQuantity: 20, // stale: actual value is now 18
          },
        });

        expect(response.status()).toBe(409);
        const body = await response.json();
        // Task 5: "an error message the UI surfaces (\"Stock changed since
        // you loaded this page — refresh and try again\")".
        expect(body.error).toMatch(/refresh/i);

        // Review follow-up: a stock conflict must not silently discard the
        // Low-Stock Threshold half of the edit - it has no concurrent
        // writer of its own and is written unconditionally.
        const persisted = await prisma.product.findUnique({
          where: { id: product.id },
        });
        expect(persisted?.lowStockThreshold).toBe(9);
        expect(persisted?.stockQuantity).toBe(18); // stock write correctly rejected
      } finally {
        await deleteProduct(product.id);
      }
    },
  );
});
