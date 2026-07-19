import { prisma } from "@/lib/prisma";
import { getCurrentVendor } from "@/lib/vendor";
import { formatPrice } from "@/lib/utils";

// Dashboard overview: a few quick stats for the signed-in vendor.
export default async function DashboardOverviewPage() {
  const vendor = await getCurrentVendor();

  if (!vendor) {
    return (
      <div className="rounded-md border border-dashed border-stone-300 p-6 text-stone-600">
        <p className="font-medium">You don&apos;t have a storefront yet.</p>
        <p className="mt-1 text-sm">
          For this scaffold, create a Vendor row whose <code>clerkUserId</code>{" "}
          matches your signed-in user id, or wire up an onboarding form as a next
          step.
        </p>
      </div>
    );
  }

  const [productCount, orderCount, revenue] = await Promise.all([
    prisma.product.count({ where: { vendorId: vendor.id } }),
    prisma.order.count({ where: { vendorId: vendor.id, status: "PAID" } }),
    prisma.order.aggregate({
      where: { vendorId: vendor.id, status: "PAID" },
      _sum: { totalCents: true },
    }),
  ]);

  const stats = [
    { label: "Products", value: String(productCount) },
    { label: "Paid orders", value: String(orderCount) },
    { label: "Revenue", value: formatPrice(revenue._sum.totalCents ?? 0) },
  ];

  return (
    <div>
      <p className="mb-4 text-stone-600">
        Welcome back, <span className="font-medium">{vendor.name}</span>.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-stone-200 bg-white p-4"
          >
            <p className="text-sm text-stone-500">{s.label}</p>
            <p className="mt-1 text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
