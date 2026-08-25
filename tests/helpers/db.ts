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
    // pickupSlots added for Story 5.1 - checkout-api.spec.ts's existing
    // tests and the new pickup-slot tests both need a real seeded slot id
    // without a second query.
    include: { products: true, pickupSlots: true },
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
    imageUrl: string;
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
      imageUrl: overrides.imageUrl,
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

// Story 5.1: throwaway pickup-slot fixtures for the multi-slot/zero-slot
// checkout UI tests - no existing helper creates a standalone slot.
// startsAt/endsAt default to "tomorrow", matching prisma/seed.ts's own
// pattern, so slots are always "upcoming" per the route's
// startsAt: { gte: new Date() } filter regardless of when the suite runs.
export async function createTestPickupSlot(
  vendorId: string,
  overrides: Partial<{
    startsAt: Date;
    endsAt: Date;
    capacity: number;
    location: string | null;
  }> = {},
) {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const defaultStart = new Date(tomorrow.setHours(17, 0, 0, 0));
  const defaultEnd = new Date(tomorrow.setHours(19, 0, 0, 0));
  return prisma.pickupSlot.create({
    data: {
      vendorId,
      startsAt: overrides.startsAt ?? defaultStart,
      endsAt: overrides.endsAt ?? defaultEnd,
      capacity: overrides.capacity ?? 20,
      location: overrides.location ?? "Test Market (Playwright)",
    },
  });
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

// Story 3.2: throwaway admin fixtures for low-stock/shortfall SMS tests -
// never use the seeded E2E_ADMIN_CLERK_ID admin row for this, other tests
// may depend on it staying exactly as seeded. Timestamped-unique
// clerkUserId by default, same convention as createTestVendor. phone
// also defaults to a unique-per-fixture number, not a fixed magic
// string - GET /api/debug/sms's mock message log is process-global and
// shared across every concurrently-running test under
// fullyParallel:true (including createTestOrder's own customerPhone
// messages), so a fixed default here would make any test asserting an
// exact message count flaky. The mock provider doesn't validate real
// Twilio phone formats, only special-cases the exact string
// "+15005550001" (MAGIC_FAILURE_NUMBER) as a simulated failure - pass
// that explicitly to test the failure path.
export async function createTestAdmin(
  overrides: Partial<{ clerkUserId: string; phone: string | null }> = {},
) {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return prisma.admin.create({
    data: {
      clerkUserId: overrides.clerkUserId ?? `test-admin-playwright-${unique}`,
      phone:
        overrides.phone === undefined
          ? `+1555${Math.floor(1000000 + Math.random() * 9000000)}`
          : overrides.phone,
    },
  });
}

export async function deleteTestAdmin(id: string) {
  await prisma.admin.deleteMany({ where: { id } });
}
