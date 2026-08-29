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
 * Also gated by middleware.ts's isProtectedApiRoute matcher
 * (/api/admin(.*)), which rejects a signed-out caller with 401 before this
 * handler ever runs - that layer only proves "signed in", not "is an
 * Admin", so this route's own getCurrentAdmin() check below is still
 * required (same two-layer shape as POST /api/admin/vendors, Story 2.2,
 * and POST /api/admin/vendors/[id]/deactivate, Story 2.3 - see
 * middleware.ts's own comment for why the split exists). No ownership
 * scoping needed - admin operates across all vendors, same as deactivate.
 */
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import * as Sentry from "@sentry/nextjs";
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
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const existing = await prisma.vendor.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const vendor = await prisma.vendor.update({
      where: { id: params.id },
      data: { timezone: parsed.data.timezone },
    });
    return NextResponse.json({ vendor }, { status: 200 });
  } catch (err) {
    // The findUnique above is a check, not a lock - the vendor can still
    // be deleted between it and this update() (code review finding).
    // P2025 is Prisma's "record to update not found" - map it to the same
    // 404 the pre-check above already returns for the more common case,
    // rather than letting a raw Prisma error surface as an unhandled 500.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    Sentry.captureException(err);
    return NextResponse.json(
      { error: "Could not update vendor. Try again." },
      { status: 500 },
    );
  }
}
