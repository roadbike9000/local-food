/**
 * Stock-quantity mutation for a Product. All writes to
 * Product.stockQuantity/lowStockThreshold go through this module — never a
 * bare prisma.product.update from a route handler (architecture AD-3).
 */
import { prisma } from "@/lib/prisma";

// Migration backfill sentinels (Story 1.2). Never used as a schema default
// and never applied to a product created after this story shipped — new
// products always require the vendor to set real values.
export const PLACEHOLDER_STOCK_QUANTITY = 100;
export const PLACEHOLDER_LOW_STOCK_THRESHOLD = 0;

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
