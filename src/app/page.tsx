import { prisma } from "@/lib/prisma";
import { VendorCard } from "@/components/VendorCard";
import { SquiggleDivider } from "@/components/Icons";

// The homepage: a directory of vendors. This is a server component, so the
// database query runs on the server and only HTML is sent to the browser.
export default async function HomePage() {
  // Deactivated vendors (Story 2.3) must not appear in the public directory
  // - their storefront still resolves (shows a "no longer available"
  // message) but shouldn't be discoverable from here.
  const vendors = await prisma.vendor.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { products: true } } },
  });

  return (
    <div>
      <p className="mb-2.5 text-label-caps font-sans text-olive">
        Local Marketplace
      </p>
      <h1 className="mb-3.5 font-serif text-display-md text-terracotta-deep">
        Find local food near you
      </h1>
      <p className="max-w-[560px] font-serif text-body-lede italic text-ink-soft">
        Order from independent bakers, farmers, and makers for pickup.
      </p>

      <SquiggleDivider className="mt-divider-gap" />

      {vendors.length === 0 ? (
        <p className="mt-8 text-stone-500">
          No vendors yet. Run <code>npm run db:seed</code> to add samples.
        </p>
      ) : (
        <>
          <h2 className="mb-1.5 mt-8 font-serif text-headline-sm text-terracotta-deep">
            Vendors near you ({vendors.length})
          </h2>
          <div className="grid gap-grid-gap sm:grid-cols-2">
            {vendors.map((v) => (
              <VendorCard
                key={v.id}
                slug={v.slug}
                name={v.name}
                description={v.description}
                productCount={v._count.products}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
