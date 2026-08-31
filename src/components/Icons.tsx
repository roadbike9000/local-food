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
