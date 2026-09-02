import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProductCard } from "@/components/ProductCard";
import { SquiggleDivider, ClockIcon } from "@/components/Icons";
import { formatPickupWindow } from "@/lib/utils";
import { assertVendorActive, VendorDeactivatedError } from "@/lib/vendor";
import { CLOUDINARY_URL_PREFIX } from "@/app/api/products/schema";

// Story 8.3: no per-vendor tagline/photo field exists in the data model
// (Vendor has no imageUrl or category, matching Story 8.2's same-shaped
// decision for the homepage accent panel) - this caption is deliberately
// generic and identical across every vendor, not sourced from real content.
const HERO_CAPTION = "Fresh from this vendor, ready for pickup";

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
          <h1 className="font-serif text-display-lg text-terracotta-deep">
            {vendor.name}
          </h1>
          <p className="mt-2 font-sans text-body-ui text-ink-soft">
            This vendor is no longer available.
          </p>
        </div>
      );
    }
    throw err;
  }

  // A product's already-Cloudinary-validated image stands in for a real
  // hero photo - no Vendor.imageUrl field exists (schema change, out of
  // this visual-only epic's scope, per this story's Dev Notes). Falls back
  // to a gradient placeholder (same treatment VendorCard.tsx uses for its
  // accent panel) when no product has one, e.g. a freshly-onboarded vendor.
  const heroImageUrl = vendor.products.find((p) =>
    p.imageUrl?.startsWith(CLOUDINARY_URL_PREFIX),
  )?.imageUrl;

  return (
    <div>
      <h1 className="font-serif text-display-lg text-terracotta-deep">
        {vendor.name}
      </h1>
      {vendor.description && (
        <p className="mt-3.5 max-w-[560px] font-serif text-body-lede italic text-ink-soft">
          {vendor.description}
        </p>
      )}

      <div
        className={`relative mt-6 h-[260px] overflow-hidden rounded-storefront-lg shadow-hero ${
          heroImageUrl
            ? "bg-cover bg-center"
            : "bg-gradient-to-br from-terracotta-light via-terracotta to-terracotta-deep"
        }`}
        style={heroImageUrl ? { backgroundImage: `url(${heroImageUrl})` } : undefined}
      >
        <span className="absolute bottom-4 left-[22px] rounded-storefront-sm bg-terracotta-deep px-2.5 py-1 text-label-caps-tight font-sans uppercase text-paper">
          {HERO_CAPTION}
        </span>
      </div>

      <SquiggleDivider className="mt-divider-gap" />

      {vendor.pickupSlots.length > 0 && (
        <div className="mt-6 flex items-center gap-[18px] rounded-storefront bg-gradient-to-r from-terracotta to-terracotta-deep px-[26px] py-5 text-paper shadow-banner">
          <span className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-full bg-white/[0.18]">
            <ClockIcon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="mb-[3px] text-label-caps-tight font-sans uppercase opacity-85">
              Next Pickup
            </p>
            <p className="font-sans text-[17px] font-semibold">
              {formatPickupWindow(
                vendor.pickupSlots[0].startsAt,
                vendor.pickupSlots[0].endsAt,
                vendor.timezone,
              )}
              {vendor.pickupSlots[0].location
                ? ` · ${vendor.pickupSlots[0].location}`
                : ""}
            </p>
          </div>
        </div>
      )}

      <h2 className="mb-1.5 mt-section-gap font-serif text-headline-md text-terracotta-deep">
        Menu
      </h2>
      <div className="flex flex-col gap-list-gap pt-2.5">
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
