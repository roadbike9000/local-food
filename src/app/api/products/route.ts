/**
 * Products API for the signed-in vendor.
 *
 *   GET  /api/products         -> list this vendor's products
 *   POST /api/products         -> create a product
 *
 * Auth is enforced by loading the vendor tied to the current Clerk user.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentVendor, assertVendorActive, VendorDeactivatedError } from "@/lib/vendor";
import { CreateProductSchema } from "./schema";

export async function GET() {
  const vendor = await getCurrentVendor();
  if (!vendor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const products = await prisma.product.findMany({
    where: { vendorId: vendor.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ products });
}

export async function POST(req: Request) {
  const vendor = await getCurrentVendor();
  if (!vendor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // getCurrentVendor() resolves by clerkUserId alone, with no deletedAt
  // filter - a deactivated vendor's own session still resolves here, so
  // this check must be explicit (Epic 2 retro tech debt: deactivated
  // vendors could otherwise still create Products via their own untouched
  // dashboard).
  try {
    assertVendorActive(vendor);
  } catch (err) {
    if (err instanceof VendorDeactivatedError) {
      return NextResponse.json(
        { error: "Your storefront is deactivated — you can no longer add products." },
        { status: 403 },
      );
    }
    throw err;
  }

  const parsed = CreateProductSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const product = await prisma.product.create({
    data: { ...parsed.data, vendorId: vendor.id },
  });
  return NextResponse.json({ product }, { status: 201 });
}
