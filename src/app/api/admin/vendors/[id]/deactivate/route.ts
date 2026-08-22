/**
 * Admin vendor-deactivation API.
 *
 *   POST /api/admin/vendors/[id]/deactivate -> soft-delete a Vendor
 *   (deletedAt + deletedByAdminId, AD-4/AD-5). No un-deactivate endpoint -
 *   explicitly out of scope (Story 2.3).
 *
 * Auth is enforced by loading the admin tied to the current Clerk user.
 * NOT covered by middleware.ts's isProtectedRoute matcher (/admin(.*)
 * matches page routes, not this route's /api/admin/vendors/... path) -
 * same reasoning as POST /api/admin/vendors (Story 2.2).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Atomic claim, not check-then-act (review finding): the WHERE clause's
  // `deletedAt: null` only matches a genuinely still-active row, so two
  // concurrent requests can't both "win" - the second's updateMany matches
  // 0 rows and correctly no-ops, leaving deletedByAdminId attributed to
  // whoever deactivated it first. A plain findFirst-then-update (the
  // original shape here) is a real race: two simultaneous double-clicks
  // could both observe deletedAt: null and both write, the second
  // silently reassigning attribution - exactly what AD-5 exists to
  // prevent. Same pattern already established in
  // src/app/api/webhooks/stripe/route.ts's stockDecremented claim.
  await prisma.vendor.updateMany({
    where: { id: params.id, deletedAt: null },
    data: { deletedAt: new Date(), deletedByAdminId: admin.id },
  });

  const vendor = await prisma.vendor.findUnique({ where: { id: params.id } });
  if (!vendor) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ vendor }, { status: 200 });
}
