import { prisma } from "@/lib/prisma";
import { getCurrentVendor } from "@/lib/vendor";
import { formatPrice } from "@/lib/utils";
import { isInStock } from "@/lib/inventory";
import { AddProductForm } from "@/components/dashboard/AddProductForm";
import { EditStockControl } from "@/components/dashboard/EditStockControl";

// Story 1.6: one shared badge for either placeholder flag - never two
// separate badges - naming which field(s) still hold a migration-backfilled
// value (Story 1.2's stockIsPlaceholder/thresholdIsPlaceholder), not real
// vendor-entered data yet.
function placeholderReason(product: {
  stockIsPlaceholder: boolean;
  thresholdIsPlaceholder: boolean;
}): string {
  if (product.stockIsPlaceholder && product.thresholdIsPlaceholder) {
    return "Stock Quantity and Low-Stock Threshold are still migration placeholders — update both.";
  }
  if (product.stockIsPlaceholder) {
    return "Stock Quantity is still a migration placeholder — update it.";
  }
  return "Low-Stock Threshold is still a migration placeholder — update it.";
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
                    <span
                      id={`placeholder-badge-${p.id}`}
                      title={placeholderReason(p)}
                      className="ml-2 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
                    >
                      Needs review
                    </span>
                  )}
                </td>
                <td className="py-2">{formatPrice(p.priceCents)}</td>
                <td className="py-2">{isInStock(p) ? "Yes" : "No"}</td>
                <EditStockControl
                  productId={p.id}
                  productName={p.name}
                  initialStockQuantity={p.stockQuantity}
                  initialLowStockThreshold={p.lowStockThreshold}
                />
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
