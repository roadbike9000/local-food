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
import { Prisma } from "@prisma/client";
import * as Sentry from "@sentry/nextjs";
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

  try {
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
  } catch (err) {
    // resolveVendorSlug()'s findUnique above is a check, not a lock - two
    // concurrent requests for the same new slug can both pass it, and the
    // second create() then hits Vendor.slug's unique constraint here.
    // Catch that specific race and map it to the same friendly 409
    // resolveVendorSlug() already returns for the common case, rather
    // than letting a raw Prisma error surface as an unhandled 500.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        {
          error: `The slug "${result.slug}" is already in use — try a different one.`,
        },
        { status: 409 },
      );
    }
    Sentry.captureException(err);
    return NextResponse.json(
      { error: "Could not create vendor. Try again." },
      { status: 500 },
    );
  }
}
