/**
 * Pickup-slots API for the signed-in vendor.
 *
 *   GET  /api/pickup-slots     -> list this vendor's slots
 *   POST /api/pickup-slots     -> create a slot
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentVendor, assertVendorActive, VendorDeactivatedError } from "@/lib/vendor";
import { CreateSlotSchema } from "./schema";

export async function GET() {
  const vendor = await getCurrentVendor();
  if (!vendor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slots = await prisma.pickupSlot.findMany({
    where: { vendorId: vendor.id },
    orderBy: { startsAt: "asc" },
  });
  return NextResponse.json({ slots });
}

export async function POST(req: Request) {
  const vendor = await getCurrentVendor();
  if (!vendor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Same gap and same fix as POST /api/products (Epic 2 retro tech debt) -
  // getCurrentVendor() doesn't filter by deletedAt, so this must be explicit.
  try {
    assertVendorActive(vendor);
  } catch (err) {
    if (err instanceof VendorDeactivatedError) {
      return NextResponse.json(
        { error: "Your storefront is deactivated — you can no longer add pickup slots." },
        { status: 403 },
      );
    }
    throw err;
  }

  const parsed = CreateSlotSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const slot = await prisma.pickupSlot.create({
    data: {
      vendorId: vendor.id,
      startsAt: new Date(parsed.data.startsAt),
      endsAt: new Date(parsed.data.endsAt),
      capacity: parsed.data.capacity,
      location: parsed.data.location,
    },
  });
  return NextResponse.json({ slot }, { status: 201 });
}
