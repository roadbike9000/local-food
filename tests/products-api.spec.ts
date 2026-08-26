import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";
import { signInAndSave } from "../playwright/support/clerk-auth";
import { getVendorBySlug, deleteProduct, prisma, createTestProduct } from "./helpers/db";
import { MAX_BASE64_LENGTH } from "../src/app/api/products/upload-image/schema";
import { deleteImage, extractPublicId, cloudinary } from "../src/lib/cloudinary";

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

// Single outer serial block wrapping both authenticated describe blocks
// below - merges what used to be two independently-serial blocks sharing
// one Clerk session, so every test in this file runs one at a time. Real
// root cause, and full diagnosis history, below.
//
// Clerk's session token (the __session JWT, minted by global-setup.ts once
// before the whole suite runs) has a 60-second TTL. This file makes only
// raw request.*() calls - no page navigation - and Playwright's `request`
// fixture reads a *static* snapshot of playwright/.auth/vendor.json at
// context-creation time; it does not share live cookie state with a `page`
// fixture, so a page.goto("/") + clerk.loaded() warm-up (tried, confirmed
// ineffective) can't refresh it. Once 60s of suite wall-clock time pass
// since global-setup ran - trivial once this file (12th of 15
// alphabetically) is reached in a full run - every request here 401s,
// permanently. dashboard.spec.ts never hits this because it drives
// everything through `page` (real navigation), the one context Clerk's
// client-side SDK actually keeps fresh.
//
// Fix: re-mint the session file whenever it's more than SESSION_MAX_AGE_MS
// old, checked before every test - not just once at global-setup, and not
// just once at this block's start either (this block's own serial runtime,
// with real Cloudinary round-trips in a few tests, can itself exceed the
// 60s TTL by its last few tests). Re-minting mid-run originally failed with
// "Clerk: Failed to sign in: You're already signed in" - clerk-auth.ts's
// signInAndSave() now signs out first (harmless no-op if nothing to sign
// out of, e.g. global-setup's very first mint) before signing back in,
// which resolved it.
//
// The single-serial-block merge above is still worth keeping (removes
// ordering ambiguity between the two inner blocks) but does not by itself
// fix session expiry - a cross-worker concurrent-sign-in race
// (clerk/javascript#7891) was the original, wrong, suspected cause;
// reproducing the identical failure at a literal --workers=1 (zero
// concurrency possible) ruled that out.
const SESSION_MAX_AGE_MS = 45_000; // 15s margin under Clerk's 60s TTL

test.describe("authenticated product API (Story 1.2, Story 4.1)", () => {
  test.use({ storageState: existsSync(authFile) ? authFile : undefined });
  test.describe.configure({ mode: "serial" });

  let lastMintedAt = 0;

  async function ensureFreshSession(): Promise<void> {
    if (Date.now() - lastMintedAt < SESSION_MAX_AGE_MS) return;
    if (!process.env.CLERK_SECRET_KEY || !process.env.E2E_VENDOR_EMAIL) return;
    try {
      await signInAndSave(
        process.env.BASE_URL ?? "http://localhost:3000",
        process.env.E2E_VENDOR_EMAIL,
        authFile,
      );
      lastMintedAt = Date.now();
    } catch (err) {
      // Mirrors global-setup.ts's own error-swallowing: a transient sign-in
      // failure here must not hard-fail the file - the per-test
      // test.skip(!existsSync(authFile), ...) guard below already handles
      // "no session available" gracefully, and falling back to whatever
      // session is already on disk is strictly no worse than not trying.
      console.warn("[products-api.spec.ts] session re-mint failed:", err);
    }
  }

  test.beforeEach(async () => {
    test.skip(
      !existsSync(authFile),
      "No vendor session — E2E_VENDOR_EMAIL/CLERK_SECRET_KEY not configured",
    );
    await ensureFreshSession();
  });

  test.describe("PATCH /api/products/[id] (ATDD, Story 1.2)", () => {
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
    const testImageBase64 = readFileSync(
      join(process.cwd(), "tests/fixtures/test-product-image.png"),
    ).toString("base64");

    test(
      "[P0] uploads a real image as the signed-in vendor and returns a Cloudinary URL (200)",
      async ({ request }) => {
        // CLOUDINARY_* is not provisioned in this repo's CI secrets today -
        // skip gracefully rather than hard-failing, same convention
        // payment.spec.ts uses for Stripe test keys (Story 4.1 review finding).
        test.skip(
          !process.env.CLOUDINARY_CLOUD_NAME ||
            !process.env.CLOUDINARY_API_KEY ||
            !process.env.CLOUDINARY_API_SECRET,
          "Cloudinary not configured — CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET missing",
        );

        const response = await request.post("/api/products/upload-image", {
          data: { image: `data:image/png;base64,${testImageBase64}` },
        });

        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body.imageUrl).toMatch(/^https:\/\/res\.cloudinary\.com\//);

        // Clean up the real Cloudinary asset this test just uploaded — it's
        // never attached to a Product row, so nothing else will ever delete
        // it (review-deferred item, resolved 2026-08-26).
        await deleteImage(body.imageUrl);
      },
    );

    test(
      "[P0] a malformed (non-image) value is rejected (400) with a format-specific error, distinct from the size error",
      async ({ request }) => {
        const response = await request.post("/api/products/upload-image", {
          data: { image: "not an image" },
        });

        expect(response.status()).toBe(400);
        const body = await response.json();
        expect(body.error).not.toMatch(/too large/i);
      },
    );

    test(
      "[P1] an oversized payload is rejected (400) with a size-specific error",
      async ({ request }) => {
        const oversized = "A".repeat(MAX_BASE64_LENGTH + 1);
        const response = await request.post("/api/products/upload-image", {
          data: { image: `data:image/png;base64,${oversized}` },
        });

        expect(response.status()).toBe(400);
        const body = await response.json();
        expect(body.error).toMatch(/too large/i);
      },
    );

    test(
      "[P1] DELETE refuses to delete an image still referenced by a Product (400)",
      async ({ request }) => {
        // No real Cloudinary asset needed - the in-use check runs against
        // Prisma before deleteImage() ever touches Cloudinary.
        const vendor = await getVendorBySlug("corner-sourdough");
        const imageUrl =
          "https://res.cloudinary.com/demo/image/upload/v1/local-food/in-use-fixture.jpg";
        const product = await createTestProduct(vendor.id, { imageUrl });

        try {
          const response = await request.delete("/api/products/upload-image", {
            data: { imageUrl },
          });
          expect(response.status()).toBe(400);
          const body = await response.json();
          expect(body.error).toMatch(/in use/i);
        } finally {
          await deleteProduct(product.id);
        }
      },
    );

    test(
      "[P1] DELETE removes a genuine orphaned upload from Cloudinary (200)",
      async ({ request }) => {
        test.skip(
          !process.env.CLOUDINARY_CLOUD_NAME ||
            !process.env.CLOUDINARY_API_KEY ||
            !process.env.CLOUDINARY_API_SECRET,
          "Cloudinary not configured — CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET missing",
        );

        const uploadRes = await request.post("/api/products/upload-image", {
          data: { image: `data:image/png;base64,${testImageBase64}` },
        });
        const { imageUrl } = await uploadRes.json();

        const deleteRes = await request.delete("/api/products/upload-image", {
          data: { imageUrl },
        });
        expect(deleteRes.status()).toBe(200);

        // Prove the asset is actually gone from Cloudinary, not just that the
        // route returned 200 - cloudinary.api.resource() 404s for a
        // public_id that no longer exists. Cloudinary's admin API isn't
        // instantly consistent right after destroy() under concurrent load
        // (reproduced: reliable in isolation, flaked once when other Cloudinary-
        // touching spec files ran in parallel against the same account) - a
        // short poll absorbs that lag without weakening what's actually proven.
        const publicId = extractPublicId(imageUrl);
        expect(publicId).not.toBeNull();
        await expect(async () => {
          let stillExists = true;
          try {
            await cloudinary.api.resource(publicId!);
          } catch {
            stillExists = false;
          }
          expect(stillExists).toBe(false);
        }).toPass({ timeout: 10_000 });
      },
    );
  });
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
