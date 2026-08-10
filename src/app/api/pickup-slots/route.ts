/**
 * Pickup-slots API for the signed-in vendor.
 *
 *   GET  /api/pickup-slots     -> list this vendor's slots
 *   POST /api/pickup-slots     -> create a slot
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentVendor } from "@/lib/vendor";
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
