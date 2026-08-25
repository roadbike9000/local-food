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

export async function GET(
  _req: Request,
  { params }: { params: { vendorId: string } },
) {
  const slots = await prisma.pickupSlot.findMany({
    where: { vendorId: params.vendorId, startsAt: { gte: new Date() } },
    orderBy: { startsAt: "asc" },
  });

  return NextResponse.json({ slots });
}
