import { prisma } from "@/lib/prisma";
import { VendorCard } from "@/components/VendorCard";

// The homepage: a directory of vendors. This is a server component, so the
// database query runs on the server and only HTML is sent to the browser.
export default async function HomePage() {
  const vendors = await prisma.vendor.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { products: true } } },
  });

  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold">Find local food near you</h1>
      <p className="mb-8 text-stone-600">
        Order from independent bakers, farmers, and makers for pickup.
      </p>

      {vendors.length === 0 ? (
        <p className="text-stone-500">
          No vendors yet. Run <code>npm run db:seed</code> to add samples.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
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
      )}
    </div>
  );
}
