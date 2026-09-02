// Story 8.1 (Epic 8): DESIGN.md's icon-line component - hand-drawn-style
// inline SVG line art, no icon library. Every icon shares the same stroke
// treatment (currentColor, no fill, round caps/joins) so they read as one
// consistent set, matching ProductCard.tsx's existing placeholder icon.
// `aria-hidden` defaults to true since every current use is decorative next
// to visible text (e.g. the cart-pill's "Cart" label) - callers can still
// override it via props if a future use needs otherwise.
import { mergeIconProps, type IconProps } from "@/lib/icon-props";

export function BasketIcon(props: IconProps) {
  return (
    <svg {...mergeIconProps(props)}>
      <path d="M4 10h16l-1.5 9a1.5 1.5 0 0 1-1.5 1.3H7A1.5 1.5 0 0 1 5.5 19z" />
      <path d="M8 10 10 4M16 10 14 4M9.5 7h5" />
      <path d="M9 14v3M12 14v3M15 14v3" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <svg {...mergeIconProps(props)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3.2 2" />
    </svg>
  );
}

export function WheatIcon(props: IconProps) {
  return (
    <svg {...mergeIconProps(props)}>
      <path d="M12 21V6" />
      <path d="M12 8 9 6M12 8l3-2M12 11 9 9M12 11l3-2M12 14 9 12M12 14l3-2M12 17 9 15M12 17l3-2" />
    </svg>
  );
}

export function LeafIcon(props: IconProps) {
  return (
    <svg {...mergeIconProps(props)}>
      <path d="M5 19c0-8 5-14 14-14 0 9-6 14-14 14z" />
      <path d="M6 18c3-4 7-7 12-11" />
    </svg>
  );
}

export function CheckmarkIcon(props: IconProps) {
  return (
    <svg {...mergeIconProps(props)}>
      <path d="M5 12.5 10 17 19 7" />
    </svg>
  );
}

// The no-image/failed-image placeholder glyph used by ProductCard.tsx's
// ProductImagePlaceholder - predates the rest of this file (Story 4.2) and
// already matched icon-line's stroke treatment; folded in here so it's not
// a second, separately-maintained copy of the same icon-line conventions.
export function ImagePlaceholderIcon(props: IconProps) {
  return (
    <svg {...mergeIconProps(props)}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}

// DESIGN.md's squiggle-divider component (Story 8.2's own prerequisite,
// not built in 8.1): a single repeating inline-SVG wave, tiled 34x18px,
// olive stroke, 0.8 opacity. Unlike the icon-line set above this isn't a
// discrete icon - it's a horizontal tiled pattern - so it's a background-
// image data URI on a fixed-height strip rather than one <svg> element.
// Purely decorative (aria-hidden) on every current use (a section divider
// on the homepage; later stories may reuse it as a scattered flourish).
const SQUIGGLE_TILE_SVG =
  'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'34\' height=\'18\' viewBox=\'0 0 34 18\'%3E%3Cpath d=\'M0 9 Q 8.5 0 17 9 T 34 9\' stroke=\'%2355622f\' stroke-width=\'2\' fill=\'none\' stroke-linecap=\'round\'/%3E%3C/svg%3E")';

export function SquiggleDivider(props: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`h-[18px] w-full bg-repeat-x opacity-80 ${props.className ?? ""}`}
      style={{ backgroundImage: SQUIGGLE_TILE_SVG, backgroundSize: "34px 18px" }}
    />
  );
}

// Story 8.5: a single scattered squiggle mark (checkout-success's low-
// opacity celebratory flourish, DESIGN.md#Components) - the same tile
// asset as SquiggleDivider above, reused rather than duplicated, just
// rendered as one fixed-size mark instead of a repeating strip. Caller
// positions/rotates/scales/dims it via className (absolute positioning,
// rotate/scale transforms, opacity).
export function SquiggleFlourish(props: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`h-[18px] w-[34px] bg-no-repeat ${props.className ?? ""}`}
      style={{ backgroundImage: SQUIGGLE_TILE_SVG, backgroundSize: "34px 18px" }}
    />
  );
}
