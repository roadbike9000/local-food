import type { SVGProps } from "react";

/**
 * Shared prop-merge behind every icon in Icons.tsx (Story 8.1) - kept out
 * of that file (which has JSX, and this codebase's Vitest config has no
 * React/JSX transform) so this logic has a plain .ts home Vitest can
 * import directly, matching the pattern src/lib/cart.ts already
 * established for the same reason.
 */
export type IconProps = SVGProps<SVGSVGElement>;

export const iconBaseProps = {
  viewBox: "0 0 24 24",
  width: "1em",
  height: "1em",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": "true" as const,
};

// Merges caller props over the shared icon defaults, dropping any caller
// prop that's explicitly `undefined` (e.g. `stroke={maybeUndefined}`) so it
// can't silently delete a default via object-spread's override-with-undefined
// behavior.
export function mergeIconProps(props: IconProps) {
  const overrides = Object.fromEntries(
    Object.entries(props).filter(([, value]) => value !== undefined),
  );
  return { ...iconBaseProps, ...overrides };
}
