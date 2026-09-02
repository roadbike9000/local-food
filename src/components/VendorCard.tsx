import Link from "next/link";
import { WheatIcon } from "./Icons";

type VendorCardProps = {
  slug: string;
  name: string;
  description: string | null;
  productCount: number;
};

// DESIGN.md's vendor-card component: card-panel base, one universal
// accent-panel treatment, "View menu" as a presentational visual label
// (never a real interactive element - see the whole-card <Link> comment
// below). Story 8.1 built the accent-panel's icon (WheatIcon) for this
// exact use; the gradient/pattern below is CSS-only, no new asset.
//
// AC #2 (Jeff, 2026-08-30, deferred-work.md): `Vendor` has no category
// field, so this is deliberately ONE universal treatment for every card,
// not a bakery-vs-farm branch keyed off vendor name/slug/description text.
// The approved mock shows two category-coded variants, but that predates
// this decision - do not resurrect the per-vendor branching from it.
//
// A server component (no "use client") - it only renders data, no interactivity.
export function VendorCard({
  slug,
  name,
  description,
  productCount,
}: VendorCardProps) {
  return (
    // The whole card is the single interactive element - a real <a> via
    // next/link, matching EXPERIENCE.md#Component Patterns' "no dead
    // decorative buttons" rule. Never add a nested <button>, <a>, or
    // role="button" inside this - "View menu" below is a <span>, not a
    // second interactive element.
    <Link
      href={`/vendors/${slug}`}
      className="focus-ring group flex flex-col overflow-hidden rounded-storefront-lg border border-card-border bg-paper shadow-card"
    >
      <div className="relative h-[150px] shrink-0 bg-gradient-to-br from-terracotta-light via-terracotta to-terracotta-deep">
        <div className="absolute -bottom-[22px] left-5 flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-paper bg-paper text-terracotta-deep shadow-[0_8px_16px_-8px_rgba(43,32,21,0.45)]">
          <WheatIcon className="h-6 w-6" aria-hidden="true" />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1 px-6 pb-6 pt-9">
        <h2 className="text-card-title font-serif text-ink">{name}</h2>
        {description && (
          <p className="mb-3.5 font-serif text-body-card-desc italic text-ink-soft">
            {description}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between gap-3">
          <span className="whitespace-nowrap rounded-full bg-sage-light px-[9px] py-[3px] text-badge-label text-olive-deep">
            {productCount} {productCount === 1 ? "item" : "items"} available
          </span>
          <span className="rounded-full bg-terracotta px-5 py-2.5 text-button-label text-paper shadow-button group-hover:bg-terracotta-deep">
            View menu
          </span>
        </div>
      </div>
    </Link>
  );
}
