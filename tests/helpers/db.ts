/**
 * Direct Prisma access for API-level tests that need to seed/verify data the
 * app's own HTTP surface doesn't expose (e.g. server-computed totals, webhook
 * side effects). Browser-driven specs should keep using `page.request`/UI
 * instead — reach for this only when there's no other way to observe the
 * result.
 */
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export async function getVendorBySlug(slug: string) {
  const vendor = await prisma.vendor.findUnique({
    where: { slug },
    include: { products: true },
  });
  if (!vendor) {
    throw new Error(`Seed data missing: vendor "${slug}" not found. Run npm run db:seed.`);
  }
  return vendor;
}

export async function createTestProduct(
  vendorId: string,
  overrides: Partial<{
    name: string;
    priceCents: number;
    stockQuantity: number;
    lowStockThreshold: number;
    stockIsPlaceholder: boolean;
    thresholdIsPlaceholder: boolean;
  }> = {},
) {
  return prisma.product.create({
    data: {
      vendorId,
      name: overrides.name ?? "Test Product (Playwright)",
      priceCents: overrides.priceCents ?? 500,
      stockQuantity: overrides.stockQuantity ?? 50,
      lowStockThreshold: overrides.lowStockThreshold ?? 5,
      stockIsPlaceholder: overrides.stockIsPlaceholder ?? false,
      thresholdIsPlaceholder: overrides.thresholdIsPlaceholder ?? false,
    },
  });
}

export async function deleteProduct(id: string) {
  await prisma.product.deleteMany({ where: { id } });
}

export async function createTestOrder(
  vendorId: string,
  overrides: Partial<{
    customerName: string;
    customerPhone: string;
    totalCents: number;
    status: "PENDING" | "PAID" | "READY" | "COMPLETED" | "CANCELLED";
    smsNotified: boolean;
    // Story 1.4: lets webhook/concurrency tests build a realistic
    // order-with-line-items fixture (needed to exercise per-line
    // decrementStock() calls) without hand-rolling raw Prisma calls in
    // every spec file. Mirrors the nested-create pattern
    // src/app/api/checkout/route.ts and prisma/seed.ts already use.
    items: { productId: string; quantity: number; unitPriceCents: number }[];
  }> = {},
) {
  return prisma.order.create({
    data: {
      vendorId,
      customerName: overrides.customerName ?? "Playwright Test Customer",
      customerPhone: overrides.customerPhone ?? "+15005550006",
      totalCents: overrides.totalCents ?? 1000,
      status: overrides.status ?? "PENDING",
      smsNotified: overrides.smsNotified ?? false,
      ...(overrides.items ? { items: { create: overrides.items } } : {}),
    },
  });
}

export async function getOrder(id: string) {
  return prisma.order.findUnique({ where: { id } });
}

export async function deleteOrder(id: string) {
  await prisma.orderItem.deleteMany({ where: { orderId: id } });
  await prisma.order.deleteMany({ where: { id } });
}

export async function deleteProductByName(vendorId: string, name: string) {
  await prisma.product.deleteMany({ where: { vendorId, name } });
}

export async function deletePickupSlotByLocation(
  vendorId: string,
  location: string,
) {
  await prisma.pickupSlot.deleteMany({ where: { vendorId, location } });
}
