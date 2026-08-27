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
    // capacity is needed to compute `available` below; createdAt still
    // isn't - stays out of the select, matching the original review finding
    // that only the client's actual PickupSlotOption fields belong here.
    select: { id: true, startsAt: true, endsAt: true, location: true, capacity: true },
  });

  // A slot is full once PENDING + PAID orders against it reach capacity.
  // PENDING counts too, not just PAID - a customer mid-checkout (Stripe
  // Checkout session open, not yet paid) has already claimed a spot, same
  // as how stock is checked against outstanding demand, not just confirmed
  // sales. Point-in-time check, not an atomic reservation - matches this
  // route's own sibling, POST /api/checkout's stock-sufficiency check,
  // which carries the identical, already-documented caveat (see that
  // route's contract below).
  const counts =
    slots.length > 0
      ? await prisma.order.groupBy({
          by: ["pickupSlotId"],
          where: {
            pickupSlotId: { in: slots.map((s) => s.id) },
            status: { in: ["PENDING", "PAID"] },
          },
          _count: { _all: true },
        })
      : [];
  const bookedCountBySlotId = new Map(
    counts.map((c) => [c.pickupSlotId, c._count._all]),
  );

  return NextResponse.json({
    slots: slots.map((s) => ({
      id: s.id,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      location: s.location,
      available: (bookedCountBySlotId.get(s.id) ?? 0) < s.capacity,
    })),
  });
}
