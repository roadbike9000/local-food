/**
 * Admin vendor-creation API.
 *
 *   POST /api/admin/vendors -> create a Vendor, unbound (clerkUserId: null,
 *   AD-8), attributed to the acting admin (createdByAdminId, AD-5)
 *
 * Auth is enforced by loading the admin tied to the current Clerk user.
 * NOT covered by middleware.ts's isProtectedRoute matcher (/admin(.*)
 * matches page routes, not this route's /api/admin/vendors path) - this
 * self-check is the only thing standing between a signed-in vendor and
 * admin-only vendor creation, same as every other API route in this repo.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin";
import { resolveVendorSlug } from "@/lib/vendor";
import { CreateVendorSchema } from "./schema";

export async function POST(req: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = CreateVendorSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const result = await resolveVendorSlug(parsed.data.slug);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  const vendor = await prisma.vendor.create({
    data: {
      name: parsed.data.name,
      slug: result.slug,
      phone: parsed.data.phone,
      description: parsed.data.description,
      clerkUserId: null,
      createdByAdminId: admin.id,
    },
  });
  return NextResponse.json({ vendor }, { status: 201 });
}
