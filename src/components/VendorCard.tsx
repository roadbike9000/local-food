import Link from "next/link";

type VendorCardProps = {
  slug: string;
  name: string;
  description: string | null;
  productCount: number;
};

// A server component (no "use client") — it only renders data, no interactivity.
export function VendorCard({
  slug,
  name,
  description,
  productCount,
}: VendorCardProps) {
  return (
    <Link
      href={`/vendors/${slug}`}
      // eslint-disable-next-line local-rules/storefront-radius-tokens -- not yet restyled by Epic 8, Tailwind default intentional until then
      className="block rounded-lg border border-stone-200 bg-white p-5 transition hover:border-brand hover:shadow-sm"
    >
      <h2 className="text-lg font-semibold">{name}</h2>
      {description && (
        <p className="mt-1 text-sm text-stone-600">{description}</p>
      )}
      <p className="mt-3 text-xs text-stone-500">
        {productCount} {productCount === 1 ? "item" : "items"} available
      </p>
    </Link>
  );
}
