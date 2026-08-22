import type { Product } from "@prisma/client";
import { notFound } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { isLowStock } from "@/lib/inventory";

// Same shared-badge convention as dashboard/products/page.tsx's
// placeholderReason() (Story 1.6): one badge, not two, naming which
// field(s) still hold a migration-backfilled value rather than a value
// the vendor actually reviewed. Without this, a product whose vendor
// never set a real Low-Stock Threshold (placeholder default 0, AD-9)
// would never show as low-stock here until it hit 0 units - silently
// defeating the page's own "spot problems" purpose for every
// not-yet-reviewed product (review finding).
function placeholderReason(
  product: Pick<Product, "stockIsPlaceholder" | "thresholdIsPlaceholder">,
): string {
  if (product.stockIsPlaceholder && product.thresholdIsPlaceholder) {
    return "Stock Quantity and Low-Stock Threshold are still migration placeholders, not vendor-reviewed.";
  }
  if (product.stockIsPlaceholder) {
    return "Stock Quantity is still a migration placeholder, not vendor-reviewed.";
  }
  if (product.thresholdIsPlaceholder) {
    return "Low-Stock Threshold is still a migration placeholder, not vendor-reviewed.";
  }
  return "";
}

// AC #1 explicitly requires "no caching staleness" - a dynamic route
// segment with no explicit dynamic export is cache-eligible under Next
// 14.2's default route cache even when it reads fresh data from Prisma
// (Story 1.3's round-1 review finding on src/app/vendors/[slug]/page.tsx).
// Applied proactively here instead of waiting for the same finding to
// recur.
export const dynamic = "force-dynamic";

// Admin cross-vendor inventory dashboard (Story 3.1, FR-9). Read-only -
// no mutation, no client component. This is the first cross-vendor query
// in the codebase: every existing dashboard/storefront query scopes to
// one vendor (getCurrentVendor()) or one admin action; this page
// intentionally has no vendorId filter at all.
export default async function AdminInventoryPage() {
  const admin = await getCurrentAdmin();
  if (!admin) notFound();

  // Deliberately includes products from deactivated vendors too (Story
  // 2.3) - AC #1 says "across all vendors" with no exclusion, and an
  // admin auditing stock levels plausibly still cares about a
  // deactivated vendor's leftover inventory. take: 100 is a pagination
  // safety cap (no paging UI yet), matching the take: 50 precedent on
  // dashboard/orders and admin/vendors - this page spans every vendor's
  // catalog rather than one vendor's, so a higher cap is reasonable.
  // { id: "asc" } as a final orderBy tiebreaker - vendor.name/product.name
  // are not unique, so without it the row order (and which rows survive
  // the take:100 cut) is nondeterministic across identical reloads
  // (review finding).
  const [products, totalCount] = await Promise.all([
    prisma.product.findMany({
      include: { vendor: { select: { name: true, deletedAt: true } } },
      orderBy: [{ vendor: { name: "asc" } }, { name: "asc" }, { id: "asc" }],
      take: 100,
    }),
    prisma.product.count(),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Inventory</h1>
      {totalCount > products.length && (
        <p className="mt-1 text-sm text-stone-500">
          Showing {products.length} of {totalCount} products.
        </p>
      )}

      {products.length === 0 ? (
        <p className="mt-4 text-stone-500">No products yet.</p>
      ) : (
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-stone-500">
              <th className="py-2">Vendor</th>
              <th className="py-2">Product</th>
              <th className="py-2">Stock Quantity</th>
              <th className="py-2">Low-Stock Threshold</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b border-stone-100">
                <td className="py-2">
                  {p.vendor.name}
                  {p.vendor.deletedAt && (
                    <span className="ml-1 text-stone-500">(deactivated)</span>
                  )}
                </td>
                <td className="py-2">{p.name}</td>
                <td className="py-2">
                  {p.stockQuantity}
                  {isLowStock(p) && (
                    <>
                      <span
                        aria-describedby={`low-stock-reason-${p.id}`}
                        title="Low stock"
                        className="ml-2 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
                      >
                        Low stock
                      </span>
                      {/* title alone is unreachable by touch/keyboard/
                          screen-reader (Epic 1's recurring a11y gap,
                          Stories 1.5/1.6) - this sr-only span carries the
                          same detail, same pattern as
                          dashboard/products/page.tsx's "Needs review"
                          badge. The stockQuantity === 0 branch of
                          isLowStock() only fires at a negative threshold
                          (nothing in the schema prevents one) - phrase it
                          separately so the announced text is never wrong
                          about which side of "below" the value is on. */}
                      <span
                        id={`low-stock-reason-${p.id}`}
                        className="sr-only"
                      >
                        {p.stockQuantity === 0
                          ? "Out of stock."
                          : `${p.stockQuantity} in stock, at or below the low-stock threshold of ${p.lowStockThreshold}.`}
                      </span>
                    </>
                  )}
                  {placeholderReason(p) && (
                    <>
                      <span
                        aria-describedby={`placeholder-reason-${p.id}`}
                        title={placeholderReason(p)}
                        className="ml-2 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
                      >
                        Not reviewed
                      </span>
                      <span
                        id={`placeholder-reason-${p.id}`}
                        className="sr-only"
                      >
                        {placeholderReason(p)}
                      </span>
                    </>
                  )}
                </td>
                <td className="py-2">{p.lowStockThreshold}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
