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
    // Deliberately omitted by every existing fixture (stays null) - the
    // webhook's session.id cross-check (deferred-work.md) only activates
    // when this is set, matching real checkout-created orders. Only the
    // dedicated test proving that cross-check needs to set this.
    stripeSessionId: string;
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
      stripeSessionId: overrides.stripeSessionId,
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

// Story 2.2: test cleanup for admin-created Vendor rows. Scoped by slug
// (not id) since the admin-creation flow's callers only know the slug they
// chose - never the seeded corner-sourdough/green-valley-produce vendors.
// Story 2.3: Product/Order now onDelete:Restrict on their vendor FK (was
// Cascade) - a caller that created Products/Orders for this vendor must
// delete them first (deleteProduct/deleteOrder), or this throws P2003
// instead of cascading them away silently.
export async function deleteVendorBySlug(slug: string) {
  await prisma.vendor.deleteMany({ where: { slug } });
}

// Story 2.3: throwaway vendor fixtures for deactivation tests - never use
// the seeded corner-sourdough/green-valley-produce vendors for this, every
// other test in the suite assumes both stay orderable. Timestamped unique
// name/slug by default, same convention as createTestProduct. deletedAt/
// deletedByAdminId let a test start pre-deactivated directly (bypassing
// the real deactivate route) when it only cares about the downstream
// effects (storefront message, checkout rejection), not the deactivation
// mechanism itself.
export async function createTestVendor(
  overrides: Partial<{
    name: string;
    slug: string;
    deletedAt: Date | null;
    deletedByAdminId: string | null;
  }> = {},
) {
  // Date.now() alone can collide between two workers under
  // fullyParallel:true if they happen to create a vendor in the same
  // millisecond (review finding) - add a random suffix so two concurrent
  // callers can never land on the same default slug.
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return prisma.vendor.create({
    data: {
      name: overrides.name ?? `Test Vendor (Playwright) ${unique}`,
      slug: overrides.slug ?? `test-vendor-playwright-${unique}`,
      deletedAt: overrides.deletedAt ?? null,
      deletedByAdminId: overrides.deletedByAdminId ?? null,
    },
  });
}
