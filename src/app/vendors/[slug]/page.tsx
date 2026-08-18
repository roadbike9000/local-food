import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProductCard } from "@/components/ProductCard";
import { formatPickupWindow } from "@/lib/utils";

// A vendor's storefront. The [slug] folder name makes this a dynamic route:
// /vendors/corner-sourdough -> params.slug === "corner-sourdough"
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

  return (
    <div>
      <h1 className="text-3xl font-bold">{vendor.name}</h1>
      {vendor.description && (
        <p className="mt-1 text-stone-600">{vendor.description}</p>
      )}

      {vendor.pickupSlots.length > 0 && (
        <div className="mt-4 rounded-md bg-orange-50 p-3 text-sm">
          <span className="font-medium">Next pickup: </span>
          {formatPickupWindow(
            vendor.pickupSlots[0].startsAt,
            vendor.pickupSlots[0].endsAt,
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
            }}
          />
        ))}
      </div>
    </div>
  );
}
