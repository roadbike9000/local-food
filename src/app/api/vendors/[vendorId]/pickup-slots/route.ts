/**
 * GET /api/vendors/[vendorId]/pickup-slots
 *
 * Lists a vendor's upcoming pickup slots, soonest first. Public, no auth -
 * the first unauthenticated GET route in this codebase. cart/page.tsx (a
 * client component) needs this to build the pickup-slot picker at checkout;
 * the data itself (slot times/locations) is already shown publicly on the
 * storefront's "Next pickup" banner, so no new trust boundary is opened.
 *
 * An unknown vendorId returns the same { slots: [] } shape as a real vendor
 * with zero upcoming slots - no vendor-existence check needed, since the
 * only trust decision that matters (does this slot really belong to this
 * vendor) is re-validated server-side in POST /api/checkout regardless of
 * what this route returns.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Without this, a route with no dynamic-API usage is cache-eligible under
// Next 14 (review finding) - same class of bug already hit and fixed twice
// in this codebase (vendors/[slug]/page.tsx, admin/inventory/page.tsx). A
// cached response here would silently serve stale/expired slots.
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { vendorId: string } },
) {
  const slots = await prisma.pickupSlot.findMany({
    where: { vendorId: params.vendorId, startsAt: { gte: new Date() } },
    orderBy: { startsAt: "asc" },
    // Only what the client picker uses (review finding) - capacity/
    // createdAt aren't needed by cart/page.tsx's PickupSlotOption type.
    select: { id: true, startsAt: true, endsAt: true, location: true },
  });

  return NextResponse.json({ slots });
}
