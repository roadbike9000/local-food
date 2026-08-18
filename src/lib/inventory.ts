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
 * sale's decrement. Caller must not silently retry; the vendor's edit was
 * built against stale data and needs to reload.
 */
export async function setStock(
  productId: string,
  newValue: number,
  expectedCurrentValue: number,
): Promise<boolean> {
  const result = await prisma.product.updateMany({
    where: { id: productId, stockQuantity: expectedCurrentValue },
    data: { stockQuantity: newValue },
  });
  return result.count === 1;
}

/**
 * Plain update, no conditional guard. Nothing else ever writes
 * lowStockThreshold, so there's no concurrent-write race to protect
 * against.
 */
export async function setLowStockThreshold(
  productId: string,
  newValue: number,
): Promise<void> {
  await prisma.product.update({
    where: { id: productId },
    data: { lowStockThreshold: newValue },
  });
}
