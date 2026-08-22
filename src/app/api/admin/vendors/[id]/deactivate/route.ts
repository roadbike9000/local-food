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

  const vendor = await prisma.vendor.findFirst({ where: { id: params.id } });
  if (!vendor) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Idempotent: an already-deactivated vendor is returned as-is, not
  // re-updated - a retry/double-click must not reassign deletedByAdminId
  // away from whoever actually deactivated it first (AD-5's attribution
  // would otherwise silently lie about who did it).
  if (vendor.deletedAt) {
    return NextResponse.json({ vendor }, { status: 200 });
  }

  const updated = await prisma.vendor.update({
    where: { id: vendor.id },
    data: { deletedAt: new Date(), deletedByAdminId: admin.id },
  });
  return NextResponse.json({ vendor: updated }, { status: 200 });
}
