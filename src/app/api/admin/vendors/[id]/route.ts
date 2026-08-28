/**
 * Admin vendor-edit API.
 *
 *   PATCH /api/admin/vendors/[id] -> update an existing Vendor's timezone
 *   (Story 7.1). Narrowly scoped to `timezone` only — no route existed to
 *   edit any vendor field after creation before this story (only
 *   POST .../deactivate). No optimistic-concurrency/version field needed:
 *   unlike Product.stockQuantity (PATCH /api/products/[id]), Vendor.timezone
 *   has exactly one writer (this route) and no concurrent-decrement-style
 *   race to guard against.
 *
 * Auth is enforced by loading the admin tied to the current Clerk user.
 * NOT covered by middleware.ts's isProtectedRoute matcher (/admin(.*)
 * matches page routes, not this route's /api/admin/vendors/... path) -
 * same reasoning as POST /api/admin/vendors (Story 2.2) and
 * POST /api/admin/vendors/[id]/deactivate (Story 2.3). No ownership
 * scoping needed - admin operates across all vendors, same as deactivate.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin";
import { UpdateVendorSchema } from "./schema";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = UpdateVendorSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const existing = await prisma.vendor.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const vendor = await prisma.vendor.update({
    where: { id: params.id },
    data: { timezone: parsed.data.timezone },
  });

  return NextResponse.json({ vendor }, { status: 200 });
}
