import { test, expect } from "@playwright/test";
import {
  getVendorBySlug,
  createTestProduct,
  createTestVendor,
  deleteProduct,
  deleteOrder,
  deleteVendorBySlug,
  prisma,
} from "./helpers/db";

// Story 5.1: seeded vendors' own pickupSlots[0] (via getVendorBySlug's
// pickupSlots include) is reused directly below rather than
// createTestPickupSlot() - both seeded vendors already have exactly one
// upcoming slot each (prisma/seed.ts), so no extra fixture/cleanup is
// needed for these three tests.

// API-level coverage for /api/checkout's pricing/availability rules (faster
// and more direct than the E2E redirect test in payment.spec.ts, which only
// exercises the happy path). Requires seeded data (npm run db:seed).
test.describe("checkout API", () => {
  test("total is computed from DB prices, ignoring any client-sent total", async ({
    request,
  }) => {
    const quantity = 2;
    const vendor = await getVendorBySlug("corner-sourdough");
    // Must have enough stock for `quantity`, not just be non-zero — this
    // test's own request would otherwise get rejected by the sufficiency
    // check once seed stock drops below 2 (e.g. after Story 1.4's
    // decrement lands and a prior test run has consumed it).
    const product = vendor.products.find((p) => p.stockQuantity >= quantity);
    if (!product) throw new Error("Seed data missing a product with enough stock");
    const customerPhone = `+1500555${Date.now() % 10000}`.padEnd(12, "0");

    const response = await request.post("/api/checkout", {
      data: {
        vendorId: vendor.id,
        pickupSlotId: vendor.pickupSlots[0].id,
        customerName: "Playwright Total Check",
        customerPhone,
        items: [{ productId: product.id, quantity }],
        // Not part of the schema — proves the server ignores/strips any
        // client-supplied total rather than trusting it.
        totalCents: 1,
      },
    });

    // Only skip on a genuine Stripe-config failure (an unhandled exception
    // from an invalid/missing key surfaces as 500, since the route doesn't
    // wrap the stripe.checkout.sessions.create call). A 400 here would mean
    // our own request was rejected — e.g. by a regression in the
    // sufficiency check — and must fail the test, not silently skip it
    // (review round 2 finding: the old `!response.ok()` condition masked
    // exactly this).
    test.skip(response.status() === 500, "Stripe test keys not configured; skipping");
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

  test(
    "checkout-session creation never writes stockQuantity (AC #4) — the decrement only happens later, in the webhook (Story 1.4)",
    async ({ request }) => {
      // Story 1.4's Task 6 claimed this coverage without a test actually
      // exercising it (review round 1 bookkeeping finding) — AC #4 itself
      // does hold (verified by code inspection at review time), this test
      // makes the claim true rather than just correcting the wording.
      const vendor = await getVendorBySlug("corner-sourdough");
      const product = await createTestProduct(vendor.id, { stockQuantity: 10 });

      try {
        const response = await request.post("/api/checkout", {
          data: {
            vendorId: vendor.id,
            pickupSlotId: vendor.pickupSlots[0].id,
            customerName: "Playwright Stock Write Check",
            customerPhone: "+15005550097",
            items: [{ productId: product.id, quantity: 3 }],
          },
        });

        test.skip(response.status() === 500, "Stripe test keys not configured; skipping");
        expect(response.status()).toBe(200);

        const unchanged = await prisma.product.findUnique({ where: { id: product.id } });
        expect(unchanged?.stockQuantity).toBe(10);

        const order = await prisma.order.findFirst({
          where: { vendorId: vendor.id, customerPhone: "+15005550097" },
          orderBy: { createdAt: "desc" },
        });
        try {
          expect(order?.status).toBe("PENDING");
        } finally {
          if (order) await deleteOrder(order.id);
        }
      } finally {
        await deleteProduct(product.id);
      }
    },
  );

  test(
    "rejects a cart requesting more than the available stock (400)",
    async ({ request }) => {
      const vendor = await getVendorBySlug("corner-sourdough");
      const outOfStock = await createTestProduct(vendor.id, {
        name: "Insufficient Stock Test Product",
        stockQuantity: 0,
      });

      try {
        const response = await request.post("/api/checkout", {
          data: {
            vendorId: vendor.id,
            pickupSlotId: vendor.pickupSlots[0].id,
            customerName: "Playwright Availability Check",
            customerPhone: "+15005550099",
            items: [{ productId: outOfStock.id, quantity: 1 }],
          },
        });

        expect(response.status()).toBe(400);
        // Pins the sufficiency-check message specifically, not just the
        // status code — without this, deleting the sufficiency check and
        // falling back to the existence-only filter (which also 400s on a
        // missing/mismatched product) would pass this test undetected
        // (review round 2 finding).
        const body = await response.json();
        expect(body.error).toBe("One or more items don't have enough stock");
      } finally {
        await deleteProduct(outOfStock.id);
      }
    },
  );

  test(
    "rejects a cart requesting more than available stock even when some stock remains (400)",
    async ({ request }) => {
      // AD-2's sufficiency check is `stockQuantity >= quantity`, not
      // `stockQuantity > 0` — every other rejection test in this suite used
      // stockQuantity: 0, which a plain "in stock?" boolean check would
      // also satisfy. This is the one case that actually proves the
      // per-quantity comparison (review round 2 finding).
      const vendor = await getVendorBySlug("corner-sourdough");
      const lowStock = await createTestProduct(vendor.id, {
        name: "Low Stock Test Product",
        stockQuantity: 1,
      });

      try {
        const response = await request.post("/api/checkout", {
          data: {
            vendorId: vendor.id,
            pickupSlotId: vendor.pickupSlots[0].id,
            customerName: "Playwright Sufficiency Check",
            customerPhone: "+15005550098",
            items: [{ productId: lowStock.id, quantity: 2 }],
          },
        });

        expect(response.status()).toBe(400);
        const body = await response.json();
        expect(body.error).toBe("One or more items don't have enough stock");
      } finally {
        await deleteProduct(lowStock.id);
      }
    },
  );

  // Throwaway fixture vendor/product only - never deactivate
  // corner-sourdough/green-valley-produce, every other test in this suite
  // depends on both staying orderable.
  test(
    "checkout rejects an order for a deactivated vendor's product (400) — Story 2.3, AC #2",
    async ({ request }) => {
      const vendor = await createTestVendor({ deletedAt: new Date() });
      const product = await createTestProduct(vendor.id, { stockQuantity: 10 });

      try {
        const response = await request.post("/api/checkout", {
          data: {
            vendorId: vendor.id,
            // Vendor-active check runs before the pickup-slot check, so this
            // never reaches slot validation — any non-empty string satisfies
            // Zod. createTestVendor() creates no pickup slots by default.
            pickupSlotId: "placeholder",
            customerName: "Playwright Deactivated Vendor Check",
            customerPhone: "+15005550096",
            items: [{ productId: product.id, quantity: 1 }],
          },
        });

        expect(response.status()).toBe(400);
        // Pins the new, more specific message Task 5 adds - distinct from
        // the existing "One or more items are unavailable" message used
        // for a missing vendor/product.
        const body = await response.json();
        expect(body.error).toMatch(/no longer accepting orders/i);

        const order = await prisma.order.findFirst({
          where: { vendorId: vendor.id, customerPhone: "+15005550096" },
        });
        expect(order).toBeNull();
      } finally {
        await deleteProduct(product.id);
        await deleteVendorBySlug(vendor.slug);
      }
    },
  );

  test(
    "rejects a pickupSlotId belonging to a different vendor (400) — Story 5.1, AC #2",
    async ({ request }) => {
      const vendor = await getVendorBySlug("corner-sourdough");
      const otherVendor = await getVendorBySlug("green-valley-produce");
      const product = vendor.products.find((p) => p.stockQuantity >= 1);
      if (!product) throw new Error("Seed data missing a product with stock");
      const otherVendorSlot = otherVendor.pickupSlots[0];
      if (!otherVendorSlot) {
        throw new Error("Seed data missing green-valley-produce's pickup slot");
      }

      const response = await request.post("/api/checkout", {
        data: {
          vendorId: vendor.id,
          pickupSlotId: otherVendorSlot.id,
          customerName: "Playwright Wrong-Vendor Slot Check",
          customerPhone: "+15005550095",
          items: [{ productId: product.id, quantity: 1 }],
        },
      });

      expect(response.status()).toBe(400);
      // Distinct message from the existing "One or more items are
      // unavailable" (missing product) / "don't have enough stock"
      // messages - proves the slot check ran, not just any 400.
      const body = await response.json();
      expect(body.error).toMatch(/no longer available/i);

      const order = await prisma.order.findFirst({
        where: { vendorId: vendor.id, customerPhone: "+15005550095" },
      });
      expect(order).toBeNull();
    },
  );

  test(
    "rejects a non-existent pickupSlotId (400) — Story 5.1, AC #2",
    async ({ request }) => {
      const vendor = await getVendorBySlug("corner-sourdough");
      const product = vendor.products.find((p) => p.stockQuantity >= 1);
      if (!product) throw new Error("Seed data missing a product with stock");

      const response = await request.post("/api/checkout", {
        data: {
          vendorId: vendor.id,
          pickupSlotId: "nonexistent-slot-id",
          customerName: "Playwright Missing Slot Check",
          customerPhone: "+15005550094",
          items: [{ productId: product.id, quantity: 1 }],
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toMatch(/no longer available/i);

      const order = await prisma.order.findFirst({
        where: { vendorId: vendor.id, customerPhone: "+15005550094" },
      });
      expect(order).toBeNull();
    },
  );

  test(
    "a valid pickupSlotId for the cart's own vendor succeeds and sets Order.pickupSlotId — Story 5.1, AC #3",
    async ({ request }) => {
      const vendor = await getVendorBySlug("corner-sourdough");
      const product = vendor.products.find((p) => p.stockQuantity >= 1);
      if (!product) throw new Error("Seed data missing a product with stock");
      const slot = vendor.pickupSlots[0];
      if (!slot) throw new Error("Seed data missing corner-sourdough's pickup slot");
      const customerPhone = `+1500555${Date.now() % 10000}`.padEnd(12, "0");

      const response = await request.post("/api/checkout", {
        data: {
          vendorId: vendor.id,
          pickupSlotId: slot.id,
          customerName: "Playwright Valid Slot Check",
          customerPhone,
          items: [{ productId: product.id, quantity: 1 }],
        },
      });

      // Same Stripe-config skip reasoning as the other tests in this file -
      // only skip on a genuine 500, a 400 must fail the test.
      test.skip(response.status() === 500, "Stripe test keys not configured; skipping");
      expect(response.status()).toBe(200);

      const order = await prisma.order.findFirst({
        where: { vendorId: vendor.id, customerPhone },
        orderBy: { createdAt: "desc" },
      });
      try {
        expect(order).not.toBeNull();
        expect(order!.pickupSlotId).toBe(slot.id);
      } finally {
        if (order) await deleteOrder(order.id);
      }
    },
  );
});
