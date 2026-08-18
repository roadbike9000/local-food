import { prisma } from "@/lib/prisma";
import { getCurrentVendor } from "@/lib/vendor";
import { formatPrice } from "@/lib/utils";
import { AddProductForm } from "@/components/dashboard/AddProductForm";
import { EditStockControl } from "@/components/dashboard/EditStockControl";

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
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b border-stone-100">
                <td className="py-2">{p.name}</td>
                <td className="py-2">{formatPrice(p.priceCents)}</td>
                <td className="py-2">{p.isAvailable ? "Yes" : "No"}</td>
                <td className="py-2">
                  <EditStockControl
                    productId={p.id}
                    initialStockQuantity={p.stockQuantity}
                    initialLowStockThreshold={p.lowStockThreshold}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
