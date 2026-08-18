/**
 * PATCH /api/products/[id] -> update a product's Stock Quantity and
 * Low-Stock Threshold. The only mutation path for either field after
 * creation (Story 1.2).
 *
 * Auth is enforced by loading the vendor tied to the current Clerk user;
 * ownership is enforced by scoping the product lookup to that vendor - a
 * product ID alone is never trusted.
 */
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { getCurrentVendor } from "@/lib/vendor";
import { setStock, setLowStockThreshold } from "@/lib/inventory";
import { UpdateProductStockSchema } from "./schema";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const vendor = await getCurrentVendor();
  if (!vendor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = UpdateProductStockSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    // Never trust the product ID alone - scope by ownership, same as every
    // other vendor-scoped route in this codebase.
    const product = await prisma.product.findFirst({
      where: { id: params.id, vendorId: vendor.id },
    });
    if (!product) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { stockQuantity, lowStockThreshold, expectedStockQuantity } =
      parsed.data;

    // Threshold has no concurrent writer (see setLowStockThreshold's own
    // doc), so it's written unconditionally - a stock conflict below must
    // not silently discard this half of the vendor's edit.
    await setLowStockThreshold(params.id, lowStockThreshold);

    const updated = await setStock(
      params.id,
      stockQuantity,
      expectedStockQuantity,
    );
    if (!updated) {
      return NextResponse.json(
        {
          error:
            "Your Low-Stock Threshold was saved, but Stock Quantity changed since you loaded this page — refresh and try again",
        },
        { status: 409 },
      );
    }

    // Re-scope by vendor, same as the lookup above - an unscoped read here
    // would report success even if the product were deleted mid-request.
    const result = await prisma.product.findFirst({
      where: { id: params.id, vendorId: vendor.id },
    });
    if (!result) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ product: result }, { status: 200 });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json(
      { error: "Could not update stock. Try again." },
      { status: 500 },
    );
  }
}
