// DESIGN.md's badge-negative component: sold-out-bg background, ink-soft
// text, uppercase badge-label typography - the "unavailable" status pill
// used for both "Sold Out" (ProductCard.tsx) and "Full" (cart/page.tsx).
// Extracted (Story 8.4 review) since 3 independent copies of this exact
// className string had accumulated across 2 files.
type NegativeBadgeProps = {
  children: React.ReactNode;
  id?: string;
  className?: string;
};

export function NegativeBadge({ children, id, className = "" }: NegativeBadgeProps) {
  return (
    <span
      id={id}
      className={`rounded-full bg-sold-out-bg px-2.5 py-[3px] font-sans text-badge-label uppercase text-ink-soft ${className}`}
    >
      {children}
    </span>
  );
}
