/**
 * Stock-quantity mutation for a Product. All writes to
 * Product.stockQuantity/lowStockThreshold go through this module — never a
 * bare prisma.product.update from a route handler (architecture AD-3).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Re-exported so server-side callers can keep importing everything from
// inventory.ts (AD-3's single module for Product stock concerns), while the
// actual implementations live in a Prisma-free module client components can
// safely import too (see availability.ts's header comment).
export {
  PLACEHOLDER_STOCK_QUANTITY,
  PLACEHOLDER_LOW_STOCK_THRESHOLD,
  isInStock,
} from "@/lib/availability";

/**
 * Conditional update: only writes if the row's current stockQuantity still
 * matches expectedCurrentValue. Returns false (not an error) when it
 * doesn't — someone/something else changed it first, e.g. a concurrent
 * sale's decrement, or the product was deleted. Caller must not silently
 * retry; the vendor's edit was built against stale data and needs to
 * reload.
 *
 * Clears stockIsPlaceholder only when newValue actually differs from the
 * value the vendor's form loaded (== the row's current value, guaranteed
 * by the where-clause matching). A same-value resubmission - e.g. the
 * vendor only touched Low-Stock Threshold, but the form always posts both
 * fields together - must not clear a flag Story 1.6 depends on for a
 * field the vendor never actually edited (review round 2, finding D3).
 */
export async function setStock(
  productId: string,
  newValue: number,
  expectedCurrentValue: number,
): Promise<boolean> {
  const result = await prisma.product.updateMany({
    where: { id: productId, stockQuantity: expectedCurrentValue },
    data: {
      stockQuantity: newValue,
      ...(newValue !== expectedCurrentValue
        ? { stockIsPlaceholder: false }
        : {}),
    },
  });
  return result.count === 1;
}

/**
 * Conditional decrement for a completed sale (Story 1.4, AD-3): only writes
 * if the row's current stockQuantity is still >= quantity. Returns false
 * (not an error) when it isn't — a post-payment shortfall, e.g. a
 * concurrent sale already took the remaining units. Never takes
 * stockQuantity negative.
 *
 * Same conditional-update-then-count-check shape as setStock() above, but
 * keyed on a sufficiency floor (`gte: quantity`) rather than an exact
 * expected-value match — this function doesn't need to know the
 * "expected" pre-decrement value, only that enough stock currently exists.
 *
 * Must always be called from inside the caller's own prisma.$transaction()
 * — it takes an explicit transaction client as its first parameter (never
 * the bare prisma singleton) so that a multi-line order's decrements can be
 * rolled back together on any single line's shortfall (AC #2). This is a
 * convention, not fully type-enforced: Prisma.TransactionClient is
 * structurally a subset of PrismaClient, so nothing at the type level stops
 * a future caller from passing the bare prisma singleton here. Discipline
 * only — flag for code review if that ever slips.
 */
export async function decrementStock(
  tx: Prisma.TransactionClient,
  productId: string,
  quantity: number,
): Promise<boolean> {
  const result = await tx.product.updateMany({
    where: { id: productId, stockQuantity: { gte: quantity } },
    data: { stockQuantity: { decrement: quantity } },
  });
  return result.count === 1;
}

/**
 * Nothing else ever writes lowStockThreshold, so there's no concurrent-write
 * race to protect against - but the product itself can still be deleted
 * between the caller's ownership check and this write, so this uses
 * updateMany (returns a count) rather than a plain update (which would
 * throw P2025 on a missing row).
 *
 * Clears thresholdIsPlaceholder only when newValue actually differs from
 * currentValue (the value already stored) - see setStock's doc for why a
 * same-value resubmission must not clear the flag.
 */
export async function setLowStockThreshold(
  productId: string,
  newValue: number,
  currentValue: number,
): Promise<boolean> {
  const result = await prisma.product.updateMany({
    where: { id: productId },
    data: {
      lowStockThreshold: newValue,
      ...(newValue !== currentValue ? { thresholdIsPlaceholder: false } : {}),
    },
  });
  return result.count === 1;
}
