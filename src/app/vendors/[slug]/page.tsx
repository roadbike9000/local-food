import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProductCard } from "@/components/ProductCard";
import { formatPickupWindow } from "@/lib/utils";
import { assertVendorActive, VendorDeactivatedError } from "@/lib/vendor";
import { CLOUDINARY_URL_PREFIX } from "@/app/api/products/schema";

// A vendor's storefront. The [slug] folder name makes this a dynamic route:
// /vendors/corner-sourdough -> params.slug === "corner-sourdough"
//
// Forces this route out of Next 14.2's route cache. Availability is
// computed at read time from stockQuantity (AD-2) rather than filtered in
// the query, so a cached render would fail unsafe - showing an enabled Add
// button for a product that's since sold out - unlike the old isAvailable
// filter, which failed safe by hiding it (deferred-work.md, Story 1.3).
export const dynamic = "force-dynamic";

export default async function StorefrontPage({
  params,
}: {
  params: { slug: string };
}) {
  const vendor = await prisma.vendor.findUnique({
    where: { slug: params.slug },
    include: {
      products: { orderBy: { name: "asc" } },
      pickupSlots: { orderBy: { startsAt: "asc" } },
    },
  });

  if (!vendor) notFound();

  // Story 2.3, AC #2: a deactivated vendor's storefront stays reachable
  // (real 200, name still shown) - not notFound(). Only the listing/banner
  // is replaced with a message; the route itself must not 404.
  try {
    assertVendorActive(vendor);
  } catch (err) {
    if (err instanceof VendorDeactivatedError) {
      return (
        <div>
          <h1 className="text-3xl font-bold">{vendor.name}</h1>
          <p className="mt-1 text-stone-600">
            This vendor is no longer available.
          </p>
        </div>
      );
    }
    throw err;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold">{vendor.name}</h1>
      {vendor.description && (
        <p className="mt-1 text-stone-600">{vendor.description}</p>
      )}

      {vendor.pickupSlots.length > 0 && (
        // eslint-disable-next-line local-rules/storefront-radius-tokens -- not yet restyled by Epic 8, Tailwind default intentional until then
        <div className="mt-4 rounded-md bg-orange-50 p-3 text-sm">
          <span className="font-medium">Next pickup: </span>
          {formatPickupWindow(
            vendor.pickupSlots[0].startsAt,
            vendor.pickupSlots[0].endsAt,
            vendor.timezone,
          )}
          {vendor.pickupSlots[0].location
            ? ` · ${vendor.pickupSlots[0].location}`
            : ""}
        </div>
      )}

      <h2 className="mb-3 mt-8 text-xl font-semibold">Menu</h2>
      <div className="space-y-3">
        {vendor.products.map((p) => (
          <ProductCard
            key={p.id}
            vendorId={vendor.id}
            vendorSlug={vendor.slug}
            product={{
              id: p.id,
              name: p.name,
              description: p.description,
              priceCents: p.priceCents,
              stockQuantity: p.stockQuantity,
              // Re-validated here, not trusted from the DB as-is — imageUrl
              // has no DB-level constraint (Zod-only, at CreateProductSchema),
              // and next/image throws a hard render error for a host outside
              // next.config.mjs's remotePatterns, which would crash this
              // whole page rather than degrade one card (Story 4.2 review
              // finding). Anything that doesn't match this app's own
              // Cloudinary cloud is treated the same as no image.
              imageUrl: p.imageUrl?.startsWith(CLOUDINARY_URL_PREFIX)
                ? p.imageUrl
                : null,
            }}
          />
        ))}
      </div>
    </div>
  );
}
