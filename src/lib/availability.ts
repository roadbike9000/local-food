/**
 * Pure, Prisma-free helpers for Product availability. Deliberately kept out
 * of inventory.ts (which imports @/lib/prisma) so client components can
 * import this module without pulling PrismaClient into the browser bundle.
 */

// Migration backfill sentinels (Story 1.2). Never used as a schema default
// and never applied to a product created after this story shipped — new
// products always require the vendor to set real values.
export const PLACEHOLDER_STOCK_QUANTITY = 100;
export const PLACEHOLDER_LOW_STOCK_THRESHOLD = 0;

/**
 * The single, canonical in-stock check (architecture AD-2). No boolean or
 * cached field re-derives this under any other name - every boolean read
 * site (storefront, dashboard) computes it here, so it can never drift out
 * of sync with stockQuantity the way the old Product.isAvailable column
 * could. Checkout's sufficiency check is a separate, stricter comparison
 * (stockQuantity >= requestedQuantity, not just > 0) and intentionally does
 * not call this - see src/app/api/checkout/route.ts.
 */
export function isInStock(product: { stockQuantity: number }): boolean {
  return product.stockQuantity > 0;
}

/**
 * The single, canonical low-stock check (Story 3.1, AC #2) — same
 * pure/dual-usable shape as isInStock above. The `=== 0` branch is
 * defensive, not logically necessary given today's data (a threshold
 * >= 0 already makes stockQuantity <= lowStockThreshold true at 0), but
 * nothing in the schema enforces lowStockThreshold >= 0 at the DB level.
 */
export function isLowStock(product: {
  stockQuantity: number;
  lowStockThreshold: number;
}): boolean {
  return (
    product.stockQuantity <= product.lowStockThreshold ||
    product.stockQuantity === 0
  );
}
