import { test, expect } from "@playwright/test";
import { decrementStock, setLowStockThreshold, setStock } from "@/lib/inventory";
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
 * an HTTP route, so this suite doesn't depend on the
 * playwright/.auth/vendor.json fixture the way tests/dashboard.spec.ts and
 * tests/products-api.spec.ts do.
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

/**
 * Story 1.4, Task 1/5: decrementStock() in src/lib/inventory.ts is a
 * conditional-update-then-count-check (same shape as setStock() above),
 * keyed on a sufficiency floor `gte: quantity` instead of an exact
 * expected-value match.
 *
 * Every call site wraps decrementStock() in its own real
 * `prisma.$transaction()`, matching how the webhook route will call it
 * (Task 2) - decrementStock() takes an explicit `tx` as its first param and
 * is never called against the bare `prisma` singleton (Dev Notes).
 *
 * The concurrency test is the first committed concurrency test in this
 * codebase (Story 1.2's review verified setStock()'s race by hand, never
 * automated - see this story's Dev Notes). Built from the general
 * Playwright `Promise.all` pattern already used elsewhere (e.g.
 * payment.spec.ts's `Promise.all` around a click + waitForResponse) -
 * firing two genuinely concurrent transactions, not sequential awaits, or
 * it doesn't actually prove anything about the race.
 */
test.describe("decrementStock (Story 1.4)", () => {
  test(
    "decrements stockQuantity by exactly quantity when enough stock exists",
    async () => {
      const vendor = await getVendorBySlug("corner-sourdough");
      const product = await createTestProduct(vendor.id, { stockQuantity: 20 });

      try {
        const succeeded = await prisma.$transaction((tx) =>
          decrementStock(tx, product.id, 5),
        );
        expect(succeeded).toBe(true);

        const result = await prisma.product.findUnique({ where: { id: product.id } });
        expect(result?.stockQuantity).toBe(15);
      } finally {
        await deleteProduct(product.id);
      }
    },
  );

  test(
    "returns false and leaves stockQuantity unchanged when insufficient",
    async () => {
      const vendor = await getVendorBySlug("corner-sourdough");
      const product = await createTestProduct(vendor.id, { stockQuantity: 2 });

      try {
        const succeeded = await prisma.$transaction((tx) =>
          decrementStock(tx, product.id, 5),
        );
        expect(succeeded).toBe(false);

        const result = await prisma.product.findUnique({ where: { id: product.id } });
        expect(result?.stockQuantity).toBe(2);
      } finally {
        await deleteProduct(product.id);
      }
    },
  );

  test(
    "boundary: quantity exactly equal to stockQuantity succeeds and lands at 0",
    async () => {
      const vendor = await getVendorBySlug("corner-sourdough");
      const product = await createTestProduct(vendor.id, { stockQuantity: 3 });

      try {
        const succeeded = await prisma.$transaction((tx) =>
          decrementStock(tx, product.id, 3),
        );
        expect(succeeded).toBe(true);

        const result = await prisma.product.findUnique({ where: { id: product.id } });
        expect(result?.stockQuantity).toBe(0);
      } finally {
        await deleteProduct(product.id);
      }
    },
  );

  test(
    "boundary: quantity one more than stockQuantity fails and never goes negative",
    async () => {
      const vendor = await getVendorBySlug("corner-sourdough");
      const product = await createTestProduct(vendor.id, { stockQuantity: 3 });

      try {
        const succeeded = await prisma.$transaction((tx) =>
          decrementStock(tx, product.id, 4),
        );
        expect(succeeded).toBe(false);

        const result = await prisma.product.findUnique({ where: { id: product.id } });
        expect(result?.stockQuantity).toBe(3);
      } finally {
        await deleteProduct(product.id);
      }
    },
  );

  test(
    "two concurrent decrementStock calls against the last unit resolve to exactly one success and one rejection (AC #3)",
    async () => {
      const vendor = await getVendorBySlug("corner-sourdough");
      const product = await createTestProduct(vendor.id, { stockQuantity: 1 });

      try {
        // Genuinely concurrent - each call gets its own transaction, fired
        // together via Promise.all, not sequential awaits. Only one of the
        // two conditional updates (`WHERE stockQuantity >= 1`) can see a
        // still-sufficient row; the other must lose the race.
        const [first, second] = await Promise.all([
          prisma.$transaction((tx) => decrementStock(tx, product.id, 1)),
          prisma.$transaction((tx) => decrementStock(tx, product.id, 1)),
        ]);

        const results = [first, second];
        expect(results.filter((r) => r === true)).toHaveLength(1);
        expect(results.filter((r) => r === false)).toHaveLength(1);

        const result = await prisma.product.findUnique({ where: { id: product.id } });
        expect(result?.stockQuantity).toBe(0);
      } finally {
        await deleteProduct(product.id);
      }
    },
  );

  test(
    "rejects a quantity of 0 or negative rather than writing nothing or incrementing (deferred-work.md, round 1)",
    async () => {
      // Unreachable via any real caller today (CheckoutSchema enforces a
      // positive int), but decrementStock() is a shared primitive and
      // should be safe on its own terms. Before the fix: quantity 0
      // matched `gte: 0` and returned true having written nothing;
      // quantity -5 also matched `gte` and *incremented* stock via
      // `decrement: -5`, against the function's own "never negative"
      // promise.
      const vendor = await getVendorBySlug("corner-sourdough");
      const product = await createTestProduct(vendor.id, { stockQuantity: 10 });

      try {
        const zero = await prisma.$transaction((tx) =>
          decrementStock(tx, product.id, 0),
        );
        expect(zero).toBe(false);

        const negative = await prisma.$transaction((tx) =>
          decrementStock(tx, product.id, -5),
        );
        expect(negative).toBe(false);

        const result = await prisma.product.findUnique({ where: { id: product.id } });
        expect(result?.stockQuantity).toBe(10);
      } finally {
        await deleteProduct(product.id);
      }
    },
  );
});
