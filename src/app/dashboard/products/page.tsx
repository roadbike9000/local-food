import type { Product } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentVendor } from "@/lib/vendor";
import { formatPrice } from "@/lib/utils";
import { isInStock } from "@/lib/inventory";
import { AddProductForm } from "@/components/dashboard/AddProductForm";
import { EditStockControl } from "@/components/dashboard/EditStockControl";

// Story 1.6: one shared badge for either placeholder flag - never two
// separate badges - naming which field(s) still hold a migration-backfilled
// value (Story 1.2's stockIsPlaceholder/thresholdIsPlaceholder), not real
// vendor-entered data yet. Correct on its own terms (not just for its one
// gated call site below, review round 1 finding): returns "" if somehow
// called with neither flag set, rather than fabricating a wrong claim.
function placeholderReason(
  product: Pick<Product, "stockIsPlaceholder" | "thresholdIsPlaceholder">,
): string {
  if (product.stockIsPlaceholder && product.thresholdIsPlaceholder) {
    return "Stock Quantity and Low-Stock Threshold are still migration placeholders — update both.";
  }
  if (product.stockIsPlaceholder) {
    return "Stock Quantity is still a migration placeholder — update it.";
  }
  if (product.thresholdIsPlaceholder) {
    return "Low-Stock Threshold is still a migration placeholder — update it.";
  }
  return "";
}

// Products tab: lists the vendor's products and lets them add new ones.
export default async function DashboardProductsPage() {
  const vendor = await getCurrentVendor();
  if (!vendor) return <p className="text-stone-600">No storefront found.</p>;

  const products = await prisma.product.findMany({
    where: { vendorId: vendor.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Products</h2>
      </div>

      <AddProductForm />

      {products.length === 0 ? (
        <p className="text-stone-500">No products yet.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-stone-500">
              <th className="py-2">Name</th>
              <th className="py-2">Price</th>
              <th className="py-2">Available</th>
              <th className="py-2">Stock</th>
              <th className="py-2">Low-Stock Threshold</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b border-stone-100">
                <td className="py-2">
                  {p.name}
                  {(p.stockIsPlaceholder || p.thresholdIsPlaceholder) && (
                    <>
                      <span
                        aria-describedby={`placeholder-reason-${p.id}`}
                        title={placeholderReason(p)}
                        className="ml-2 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
                      >
                        Needs review
                      </span>
                      {/* title is mouse-hover-only - unreachable on touch
                          devices and by most screen readers (review round
                          1 finding). This sr-only span carries the same
                          field-level detail via aria-describedby instead. */}
                      <span id={`placeholder-reason-${p.id}`} className="sr-only">
                        {placeholderReason(p)}
                      </span>
                    </>
                  )}
                </td>
                <td className="py-2">{formatPrice(p.priceCents)}</td>
                <td className="py-2">{isInStock(p) ? "Yes" : "No"}</td>
                <EditStockControl
                  productId={p.id}
                  productName={p.name}
                  initialStockQuantity={p.stockQuantity}
                  initialLowStockThreshold={p.lowStockThreshold}
                  initialStockVersion={p.stockVersion}
                />
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
