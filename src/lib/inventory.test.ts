import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import { setLowStockThreshold, setStock } from "./inventory";

// Real DB, not mocked (project convention) - setStock's optimistic lock is
// the story's central guarantee (AC #5) and had zero executed coverage
// before this file. A mocked prisma client would assert the where-clause
// shape, not that the guard actually rejects a stale write.
describe("setStock / setLowStockThreshold", () => {
  let vendorId: string;

  beforeAll(async () => {
    const vendor = await prisma.vendor.create({
      data: {
        clerkUserId: `test-inventory-${Date.now()}`,
        name: "Inventory Test Vendor",
        slug: `inventory-test-vendor-${Date.now()}`,
      },
    });
    vendorId = vendor.id;
  });

  afterAll(async () => {
    await prisma.vendor.delete({ where: { id: vendorId } });
  });

  async function createProduct(overrides: {
    stockQuantity: number;
    lowStockThreshold: number;
    thresholdIsPlaceholder?: boolean;
  }) {
    return prisma.product.create({
      data: {
        vendorId,
        name: "Test Product",
        priceCents: 500,
        ...overrides,
      },
    });
  }

  it("updates stockQuantity when expectedCurrentValue matches", async () => {
    const product = await createProduct({
      stockQuantity: 20,
      lowStockThreshold: 5,
    });

    const updated = await setStock(product.id, 15, 20);
    expect(updated).toBe(true);

    const result = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(result?.stockQuantity).toBe(15);
  });

  it("rejects the write and leaves the row unchanged when expectedCurrentValue is stale", async () => {
    const product = await createProduct({
      stockQuantity: 20,
      lowStockThreshold: 5,
    });

    // Simulate a concurrent sale that already moved stock away from 20.
    await prisma.product.update({
      where: { id: product.id },
      data: { stockQuantity: 18 },
    });

    const updated = await setStock(product.id, 15, 20);
    expect(updated).toBe(false);

    const result = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(result?.stockQuantity).toBe(18);
  });

  it("clears thresholdIsPlaceholder on any vendor-initiated write, even to 0", async () => {
    const product = await createProduct({
      stockQuantity: 20,
      lowStockThreshold: 0,
      thresholdIsPlaceholder: true,
    });

    await setLowStockThreshold(product.id, 0);

    const result = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(result?.lowStockThreshold).toBe(0);
    expect(result?.thresholdIsPlaceholder).toBe(false);
  });
});
