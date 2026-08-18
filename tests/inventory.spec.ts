import { test, expect } from "@playwright/test";
import { setLowStockThreshold, setStock } from "@/lib/inventory";
import { getVendorBySlug, createTestProduct, deleteProduct, prisma } from "./helpers/db";

/**
 * Direct coverage for src/lib/inventory.ts's setStock()/setLowStockThreshold()
 * - AC #5's optimistic-lock guard had zero executed coverage until this file
 * (Story 1.2 review, round 1, patch #4). Lives here rather than as a Vitest
 * unit test because both functions touch Prisma directly - project-context.md's
 * Testing Rules reserve `src/**\/*.test.ts` for pure functions/helpers and
 * route anything needing Prisma/Clerk to this suite instead (Story 1.2
 * review, round 2, finding P9).
 *
 * No Clerk session needed - these call the library functions directly, not
 * an HTTP route, so this suite isn't blocked by the stale
 * playwright/.auth/vendor.json fixture the way tests/dashboard.spec.ts and
 * tests/products-api.spec.ts are.
 */
test.describe("setStock / setLowStockThreshold", () => {
  test("updates stockQuantity when expectedCurrentValue matches", async () => {
    const vendor = await getVendorBySlug("corner-sourdough");
    const product = await createTestProduct(vendor.id, {
      stockQuantity: 20,
      lowStockThreshold: 5,
    });

    try {
      const updated = await setStock(product.id, 15, 20);
      expect(updated).toBe(true);

      const result = await prisma.product.findUnique({ where: { id: product.id } });
      expect(result?.stockQuantity).toBe(15);
    } finally {
      await deleteProduct(product.id);
    }
  });

  test("rejects the write and leaves the row unchanged when expectedCurrentValue is stale", async () => {
    const vendor = await getVendorBySlug("corner-sourdough");
    const product = await createTestProduct(vendor.id, {
      stockQuantity: 20,
      lowStockThreshold: 5,
    });

    try {
      // Simulate a concurrent sale that already moved stock away from 20.
      await prisma.product.update({
        where: { id: product.id },
        data: { stockQuantity: 18 },
      });

      const updated = await setStock(product.id, 15, 20);
      expect(updated).toBe(false);

      const result = await prisma.product.findUnique({ where: { id: product.id } });
      expect(result?.stockQuantity).toBe(18);
    } finally {
      await deleteProduct(product.id);
    }
  });

  test("clears stockIsPlaceholder when the vendor genuinely changes stockQuantity", async () => {
    const vendor = await getVendorBySlug("corner-sourdough");
    const product = await createTestProduct(vendor.id, {
      stockQuantity: 100,
      lowStockThreshold: 5,
      stockIsPlaceholder: true,
    });

    try {
      await setStock(product.id, 42, 100);

      const result = await prisma.product.findUnique({ where: { id: product.id } });
      expect(result?.stockQuantity).toBe(42);
      expect(result?.stockIsPlaceholder).toBe(false);
    } finally {
      await deleteProduct(product.id);
    }
  });

  test("does NOT clear stockIsPlaceholder on a same-value resubmission (review round 2, D3)", async () => {
    const vendor = await getVendorBySlug("corner-sourdough");
    const product = await createTestProduct(vendor.id, {
      stockQuantity: 100,
      lowStockThreshold: 5,
      stockIsPlaceholder: true,
    });

    try {
      // The vendor's form always posts stockQuantity even if they only
      // touched the threshold field - resubmitting the unchanged value must
      // not tell Story 1.6 this was a deliberate stock=100 choice.
      await setStock(product.id, 100, 100);

      const result = await prisma.product.findUnique({ where: { id: product.id } });
      expect(result?.stockIsPlaceholder).toBe(true);
    } finally {
      await deleteProduct(product.id);
    }
  });

  test("clears thresholdIsPlaceholder when the vendor genuinely changes lowStockThreshold, even to 0", async () => {
    const vendor = await getVendorBySlug("corner-sourdough");
    const product = await createTestProduct(vendor.id, {
      stockQuantity: 20,
      lowStockThreshold: 5,
      thresholdIsPlaceholder: true,
    });

    try {
      const updated = await setLowStockThreshold(product.id, 0, 5);
      expect(updated).toBe(true);

      const result = await prisma.product.findUnique({ where: { id: product.id } });
      expect(result?.lowStockThreshold).toBe(0);
      expect(result?.thresholdIsPlaceholder).toBe(false);
    } finally {
      await deleteProduct(product.id);
    }
  });

  test("does NOT clear thresholdIsPlaceholder on a same-value resubmission (review round 2, D3)", async () => {
    const vendor = await getVendorBySlug("corner-sourdough");
    const product = await createTestProduct(vendor.id, {
      stockQuantity: 20,
      lowStockThreshold: 0,
      thresholdIsPlaceholder: true,
    });

    try {
      // The vendor's form always posts lowStockThreshold even if they only
      // touched Stock Quantity - resubmitting the unchanged placeholder 0
      // must not clear the flag Story 1.6 depends on.
      const updated = await setLowStockThreshold(product.id, 0, 0);
      expect(updated).toBe(true);

      const result = await prisma.product.findUnique({ where: { id: product.id } });
      expect(result?.thresholdIsPlaceholder).toBe(true);
    } finally {
      await deleteProduct(product.id);
    }
  });

  test("returns false instead of throwing when the product no longer exists (review round 2, P3)", async () => {
    const vendor = await getVendorBySlug("corner-sourdough");
    const product = await createTestProduct(vendor.id, {
      stockQuantity: 20,
      lowStockThreshold: 5,
    });
    await prisma.product.delete({ where: { id: product.id } });

    const updated = await setLowStockThreshold(product.id, 9, 5);
    expect(updated).toBe(false);
  });
});
