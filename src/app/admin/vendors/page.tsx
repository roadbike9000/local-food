import { notFound } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { SELECTABLE_TIME_ZONES } from "@/lib/timezone";
import { AddVendorForm } from "@/components/admin/AddVendorForm";
import { DeactivateVendorButton } from "@/components/admin/DeactivateVendorButton";
import { EditVendorTimezoneControl } from "@/components/admin/EditVendorTimezoneControl";

// Admin vendor onboarding + deactivation (Stories 2.2/2.3, AD-6). Same
// per-page gate as src/app/admin/page.tsx - no shared layout guard exists
// yet.
export default async function AdminVendorsPage() {
  const admin = await getCurrentAdmin();
  if (!admin) notFound();

  // No deletedAt filter - the admin needs to see deactivated vendors too,
  // not just active ones (Story 2.3, Task 6). take: 50 matches the
  // pagination precedent in src/app/dashboard/orders/page.tsx - this list
  // has no pagination UI yet, just a sane upper bound.
  const vendors = await prisma.vendor.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    // _count.pickupSlots feeds EditVendorTimezoneControl's confirm-before-edit
    // decision (code review, Story 7.1) - changing a vendor's timezone
    // doesn't move a slot's stored instant, but does change its displayed
    // wall-clock time, which may no longer match a customer's existing
    // confirmation.
    include: { _count: { select: { pickupSlots: true } } },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">Add a vendor</h1>
      <AddVendorForm timeZones={SELECTABLE_TIME_ZONES} />

      <h2 className="mb-3 mt-8 text-lg font-semibold">Vendors</h2>
      {vendors.length === 0 ? (
        <p className="text-stone-500">No vendors yet.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-stone-500">
              <th className="py-2">Name</th>
              <th className="py-2">Slug</th>
              <th className="py-2">Timezone</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((v) => (
              <tr key={v.id} className="border-b border-stone-100">
                <td className="py-2">{v.name}</td>
                <td className="py-2">{v.slug}</td>
                <td className="py-2">
                  <EditVendorTimezoneControl
                    vendorId={v.id}
                    vendorName={v.name}
                    currentTimezone={v.timezone}
                    hasPickupSlots={v._count.pickupSlots > 0}
                    timeZones={SELECTABLE_TIME_ZONES}
                  />
                </td>
                <td className="py-2">
                  {v.deletedAt ? (
                    <span className="text-stone-500">Deactivated</span>
                  ) : (
                    <DeactivateVendorButton vendorId={v.id} vendorName={v.name} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
