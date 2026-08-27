import { prisma } from "@/lib/prisma";
import { getCurrentVendor } from "@/lib/vendor";
import { formatPickupWindow } from "@/lib/utils";
import { AddSlotForm } from "@/components/dashboard/AddSlotForm";

// Pickup slots tab: the windows customers can choose for pickup, and lets
// the vendor add new ones.
export default async function DashboardPickupsPage() {
  const vendor = await getCurrentVendor();
  if (!vendor) return <p className="text-stone-600">No storefront found.</p>;

  const slots = await prisma.pickupSlot.findMany({
    where: { vendorId: vendor.id },
    orderBy: { startsAt: "asc" },
    include: { _count: { select: { orders: true } } },
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Pickup slots</h2>
      </div>

      <AddSlotForm timezone={vendor.timezone} />

      {slots.length === 0 ? (
        <p className="text-stone-500">No pickup slots scheduled.</p>
      ) : (
        <ul className="space-y-2">
          {slots.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-lg border border-stone-200 bg-white p-3 text-sm"
            >
              <span>
                {formatPickupWindow(s.startsAt, s.endsAt, vendor.timezone)}
                {s.location ? ` · ${s.location}` : ""}
              </span>
              <span className="text-stone-500">
                {s._count.orders}/{s.capacity} booked
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
