import { notFound } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { isLowStock } from "@/lib/availability";

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
  const products = await prisma.product.findMany({
    include: {
      vendor: { select: { name: true, slug: true, deletedAt: true } },
    },
    orderBy: [{ vendor: { name: "asc" } }, { name: "asc" }],
    take: 100,
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">Inventory</h1>

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
                    <span className="ml-1 text-stone-400">(deactivated)</span>
                  )}
                </td>
                <td className="py-2">{p.name}</td>
                <td className="py-2">
                  {p.stockQuantity}
                  {isLowStock(p) && (
                    <>
                      <span
                        aria-describedby={`low-stock-reason-${p.id}`}
                        className="ml-2 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
                      >
                        Low stock
                      </span>
                      {/* Accessible detail, not a title-only tooltip
                          (Epic 1's recurring a11y gap, Stories 1.5/1.6) -
                          reachable by touch/keyboard/screen-reader, same
                          pattern as dashboard/products/page.tsx's
                          "Needs review" badge. */}
                      <span
                        id={`low-stock-reason-${p.id}`}
                        className="sr-only"
                      >
                        {p.stockQuantity} in stock, at or below the
                        low-stock threshold of {p.lowStockThreshold}.
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
