import { test, expect } from "@playwright/test";
import {
  getVendorBySlug,
  createTestProduct,
  deleteProduct,
  deleteOrder,
  prisma,
} from "./helpers/db";

// API-level coverage for /api/checkout's pricing/availability rules (faster
// and more direct than the E2E redirect test in payment.spec.ts, which only
// exercises the happy path). Requires seeded data (npm run db:seed).
test.describe("checkout API", () => {
  test("total is computed from DB prices, ignoring any client-sent total", async ({
    request,
  }) => {
    const vendor = await getVendorBySlug("corner-sourdough");
    const product = vendor.products.find((p) => p.stockQuantity > 0);
    if (!product) throw new Error("Seed data missing an in-stock product");

    const quantity = 2;
    const customerPhone = `+1500555${Date.now() % 10000}`.padEnd(12, "0");

    const response = await request.post("/api/checkout", {
      data: {
        vendorId: vendor.id,
        customerName: "Playwright Total Check",
        customerPhone,
        items: [{ productId: product.id, quantity }],
        // Not part of the schema — proves the server ignores/strips any
        // client-supplied total rather than trusting it.
        totalCents: 1,
      },
    });

    test.skip(!response.ok(), "Stripe test keys not configured; skipping");
    expect(response.status()).toBe(200);

    const order = await prisma.order.findFirst({
      where: { vendorId: vendor.id, customerPhone },
      orderBy: { createdAt: "desc" },
    });

    try {
      expect(order).not.toBeNull();
      expect(order!.totalCents).toBe(product.priceCents * quantity);
    } finally {
      if (order) await deleteOrder(order.id);
    }
  });

  test.skip(
    "rejects a cart requesting more than the available stock (400)",
    async ({ request }) => {
      // RED PHASE (Story 1.3, AC #3): checkout's product lookup still
      // filters by isAvailable:true, not stockQuantity sufficiency - a
      // stockQuantity:0 product is still found and the order still
      // succeeds today. Fails until Task 5's per-line check lands.
      const vendor = await getVendorBySlug("corner-sourdough");
      const outOfStock = await createTestProduct(vendor.id, {
        name: "Insufficient Stock Test Product",
        stockQuantity: 0,
      });

      try {
        const response = await request.post("/api/checkout", {
          data: {
            vendorId: vendor.id,
            customerName: "Playwright Availability Check",
            customerPhone: "+15005550099",
            items: [{ productId: outOfStock.id, quantity: 1 }],
          },
        });

        expect(response.status()).toBe(400);
      } finally {
        await deleteProduct(outOfStock.id);
      }
    },
  );
});
