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
  try {
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

    // Never trust the product ID alone - scope by ownership, same as every
    // other vendor-scoped route in this codebase.
    const product = await prisma.product.findFirst({
      where: { id: params.id, vendorId: vendor.id },
    });
    if (!product) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const {
      stockQuantity,
      lowStockThreshold,
      expectedStockVersion,
      confirmPlaceholder,
    } = parsed.data;

    // Threshold has no concurrent writer of its own (see setLowStockThreshold's
    // doc), so it's written unconditionally - a stock conflict below must
    // not silently discard this half of the vendor's edit. Passing the
    // product's current value lets setLowStockThreshold tell a genuine edit
    // apart from a same-value resubmission (every PATCH posts both fields).
    // confirmPlaceholder forces the flag clear even on a same-value
    // resubmission - the vendor's explicit "this value is correct" action.
    const thresholdChanged = lowStockThreshold !== product.lowStockThreshold;
    const thresholdUpdated = await setLowStockThreshold(
      params.id,
      lowStockThreshold,
      product.lowStockThreshold,
      confirmPlaceholder,
    );
    if (!thresholdUpdated) {
      // The product was deleted between the lookup above and this write.
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const stockUpdated = await setStock(
      params.id,
      stockQuantity,
      product.stockQuantity,
      product.lowStockThreshold,
      expectedStockVersion,
      confirmPlaceholder,
    );
    if (!stockUpdated) {
      // setStock returning false means either a lock conflict or the
      // product was deleted in the moment since the threshold write above
      // - disambiguate rather than reporting 409 for both (review round 3,
      // finding L1; the threshold-write branch above already does this).
      const stillExists = await prisma.product.findFirst({
        where: { id: params.id, vendorId: vendor.id },
      });
      if (!stillExists) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      // EditStockControl calls router.refresh() on a 409, so by the time
      // the vendor reads this the current values are already showing -
      // the message describes what happened, not an instruction to retry.
      const error = thresholdChanged
        ? "Stock Quantity changed since you loaded this page — your Low-Stock Threshold change was saved, and the values shown have been updated."
        : "Stock Quantity changed since you loaded this page — the values shown have been updated.";
      return NextResponse.json({ error }, { status: 409 });
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
