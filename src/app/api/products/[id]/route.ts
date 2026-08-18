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

  const updated = await setStock(
    params.id,
    stockQuantity,
    expectedStockQuantity,
  );
  if (!updated) {
    return NextResponse.json(
      { error: "Stock changed since you loaded this page — refresh and try again" },
      { status: 409 },
    );
  }

  await setLowStockThreshold(params.id, lowStockThreshold);

  const result = await prisma.product.findUnique({ where: { id: params.id } });
  return NextResponse.json({ product: result }, { status: 200 });
}
