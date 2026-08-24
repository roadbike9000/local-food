import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";
import { getVendorBySlug, deleteProduct, prisma, createTestProduct } from "./helpers/db";

/**
 * API-level coverage for PATCH /api/products/[id] — Story 1.2's new
 * stock-edit endpoint (AC #4, #5).
 *
 * playwright/support/global-setup.ts authenticates via Clerk's Backend API
 * and writes playwright/.auth/vendor.json fresh before every run — the saved
 * session belongs to the seeded "Corner Sourdough" vendor (prisma/seed.ts
 * binds E2E_VENDOR_CLERK_ID to it), which is why every test below
 * authenticates as Corner Sourdough and uses "Green Valley Produce" as the
 * *other* vendor for the ownership-scoping case.
 */
const authFile = join(process.cwd(), "playwright/.auth/vendor.json");

test.describe("PATCH /api/products/[id] (ATDD, Story 1.2)", () => {
  // See the matching comment (and its "confirmed via repro" note) in
  // dashboard.spec.ts - a missing authFile otherwise throws ENOENT here
  // instead of letting the beforeEach test.skip guard below handle it.
  test.use({ storageState: existsSync(authFile) ? authFile : undefined });
  // Serial, not parallel - see the matching comment in dashboard.spec.ts.
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    test.skip(
      !existsSync(authFile),
      "No vendor session — E2E_VENDOR_EMAIL/CLERK_SECRET_KEY not configured",
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
            expectedStockVersion: 0, // freshly-created products start at version 0
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
            expectedStockVersion: 0,
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
            expectedStockVersion: 0,
          },
        });

        expect(response.status()).toBe(400);
      } finally {
        await deleteProduct(product.id);
      }
    },
  );

  test(
    "[P0] returns 409 when expectedStockVersion is stale (optimistic-lock conflict, AD-3)",
    async ({ request }) => {
      // This is the entire point of AD-3's design: setStock()'s conditional
      // UPDATE ... WHERE id = :productId AND stockVersion = :expected must
      // reject an edit built against a version someone else already moved
      // past (e.g. a concurrent sale's decrementStock() call), not silently
      // clobber it.
      const vendor = await getVendorBySlug("corner-sourdough");
      const product = await createTestProduct(vendor.id, {
        name: "Conflict Test Product",
        stockQuantity: 20,
        lowStockThreshold: 2,
      });

      try {
        // Simulate a concurrent change that happened after the vendor's
        // form loaded stockQuantity=20/version=0 — e.g. a sale decrementing
        // it, which also bumps stockVersion the same way this update does.
        await prisma.product.update({
          where: { id: product.id },
          data: { stockQuantity: 18, stockVersion: { increment: 1 } },
        });

        const response = await request.patch(`/api/products/${product.id}`, {
          data: {
            stockQuantity: 15,
            lowStockThreshold: 9, // deliberately different from the seeded 2
            expectedStockVersion: 0, // stale: actual version is now 1
          },
        });

        expect(response.status()).toBe(409);
        const body = await response.json();
        // Message reworded in review round 2 (P6) to past tense - the
        // client auto-refreshes on 409, so "refresh and try again" was no
        // longer accurate. See src/app/api/products/[id]/route.ts's 409
        // branch for the current wording.
        expect(body.error).toMatch(/changed since you loaded this page/i);

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

  test(
    "[P1] confirmPlaceholder clears both placeholder flags on a same-value resubmission ('Confirm as-is', deferred-work.md)",
    async ({ request }) => {
      // A vendor whose value genuinely is the placeholder default has no
      // other single-save way to clear the flag - the normal Save path
      // only clears it on a genuine value change (the 409 test above's
      // sibling cases, and inventory.spec.ts, cover that). This proves the
      // explicit override actually clears it without changing the value.
      const vendor = await getVendorBySlug("corner-sourdough");
      const product = await createTestProduct(vendor.id, {
        name: "Confirm As-Is Test Product",
        stockQuantity: 100,
        lowStockThreshold: 0,
        stockIsPlaceholder: true,
        thresholdIsPlaceholder: true,
      });

      try {
        const response = await request.patch(`/api/products/${product.id}`, {
          data: {
            stockQuantity: 100, // unchanged
            lowStockThreshold: 0, // unchanged
            expectedStockVersion: 0,
            confirmPlaceholder: true,
          },
        });

        expect(response.status()).toBe(200);

        const persisted = await prisma.product.findUnique({
          where: { id: product.id },
        });
        expect(persisted?.stockQuantity).toBe(100);
        expect(persisted?.lowStockThreshold).toBe(0);
        expect(persisted?.stockIsPlaceholder).toBe(false);
        expect(persisted?.thresholdIsPlaceholder).toBe(false);
      } finally {
        await deleteProduct(product.id);
      }
    },
  );
});

/**
 * Story 4.1 — POST /api/products/upload-image.
 */
test.describe("POST /api/products/upload-image (Story 4.1)", () => {
  test.use({ storageState: existsSync(authFile) ? authFile : undefined });
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    test.skip(
      !existsSync(authFile),
      "No vendor session — E2E_VENDOR_EMAIL/CLERK_SECRET_KEY not configured",
    );
  });

  const testImageBase64 = readFileSync(
    join(process.cwd(), "tests/fixtures/test-product-image.png"),
  ).toString("base64");

  // Skipped: this Cloudinary account is disabled ("cloud_name is disabled",
  // 401 from cloudinary.uploader.upload — confirmed via a direct probe
  // outside the app, not an app-code bug). Same class of dependency-skip
  // this codebase already uses for Stripe (payment.spec.ts). Un-skip once
  // CLOUDINARY_* in .env point at a working account.
  test.skip(
    "[P0] uploads a real image as the signed-in vendor and returns a Cloudinary URL (200)",
    async ({ request }) => {
      const response = await request.post("/api/products/upload-image", {
        data: { image: `data:image/png;base64,${testImageBase64}` },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.imageUrl).toMatch(/^https:\/\/res\.cloudinary\.com\//);
    },
  );

  test(
    "[P0] a malformed (non-image) value is rejected (400)",
    async ({ request }) => {
      const response = await request.post("/api/products/upload-image", {
        data: { image: "not an image" },
      });

      expect(response.status()).toBe(400);
    },
  );

  test(
    "[P1] an oversized payload is rejected (400) with a size-specific error",
    async ({ request }) => {
      // ~4,000,000 base64 characters ≈ the 3MB-raw-file cap's encoded size
      // (Dev Notes, Story 4.1).
      const oversized = "A".repeat(4_100_000);
      const response = await request.post("/api/products/upload-image", {
        data: { image: `data:image/png;base64,${oversized}` },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toMatch(/too large/i);
    },
  );
});

// No storageState at all - a genuinely anonymous caller, distinct from
// "signed in" above. Needs no fixture, so it always runs regardless of
// E2E_VENDOR_* configuration (same pattern as
// admin-vendors-api.spec.ts's equivalent case).
test(
  "[P0] POST /api/products/upload-image: a fully unauthenticated request is rejected (401)",
  async ({ request }) => {
    const response = await request.post("/api/products/upload-image", {
      data: { image: "data:image/png;base64,AAAA" },
    });

    expect(response.status()).toBe(401);
  },
);
