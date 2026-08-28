/** Small shared helpers used across the app. */
import { isValidTimeZone } from "@/lib/timezone";

/** Turn a name into a URL-safe slug: "Corner Sourdough" -> "corner-sourdough". */
export function slugify(input: string): string {
  return input
    // NFD splits each accented letter into its base letter + a combining
    // mark (e.g. "é" -> "e" + U+0301); stripping marks in that range
    // transliterates "Café Rosé" -> "cafe-rose" instead of dropping the
    // accented letters entirely (scenario review, 2026-08-24).
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Format cents as a dollar string, e.g. 1250 -> "$12.50". */
export function formatPrice(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

/**
 * Format a pickup window like "Fri, Jul 17, 5:00–7:00 PM", displayed in
 * `timeZone` (the vendor's own configured timezone, Story 6.1, FR17) —
 * pickup happens at the vendor's physical location regardless of which
 * timezone the viewer is browsing from, so this is a required parameter,
 * not an optional one with a runtime-default fallback: a missing argument
 * should be a type error, not a silent fallback to some incorrect implicit
 * zone.
 *
 * Falls back to "UTC" for an invalid `timeZone` rather than throwing (code
 * review, Story 6.1) — `Vendor.timezone` is an unvalidated free-text
 * column, and two of this function's four call sites are Server Components
 * (`vendors/[slug]/page.tsx`, `dashboard/pickups/page.tsx`); an unguarded
 * `Intl` `RangeError` there would 500 the whole storefront/dashboard route,
 * not just degrade one displayed time.
 */
export function formatPickupWindow(startsAt: Date, endsAt: Date, timeZone: string): string {
  const zone = isValidTimeZone(timeZone) ? timeZone : "UTC";
  const day = startsAt.toLocaleDateString("en-US", {
    timeZone: zone,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const opts: Intl.DateTimeFormatOptions = { timeZone: zone, hour: "numeric", minute: "2-digit" };
  return `${day}, ${startsAt.toLocaleTimeString("en-US", opts)}–${endsAt.toLocaleTimeString("en-US", opts)}`;
}
