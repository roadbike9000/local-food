import { prisma } from "@/lib/prisma";
import { getCurrentVendor } from "@/lib/vendor";
import { formatPrice } from "@/lib/utils";

// Orders tab: incoming orders with status. Marking an order READY (and texting
// the customer) is a natural next feature — the Twilio helper is ready in lib.
export default async function DashboardOrdersPage() {
  const vendor = await getCurrentVendor();
  if (!vendor) return <p className="text-stone-600">No storefront found.</p>;

  const orders = await prisma.order.findMany({
    where: { vendorId: vendor.id },
    orderBy: { createdAt: "desc" },
    include: { items: true },
    take: 50,
  });

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Orders</h2>
      {orders.length === 0 ? (
        <p className="text-stone-500">No orders yet.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-stone-500">
              <th className="py-2">Customer</th>
              <th className="py-2">Items</th>
              <th className="py-2">Total</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-stone-100">
                <td className="py-2">{o.customerName}</td>
                <td className="py-2">{o.items.length}</td>
                <td className="py-2">{formatPrice(o.totalCents)}</td>
                <td className="py-2">
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs">
                    {o.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
