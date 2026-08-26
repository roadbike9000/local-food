/** Small shared helpers used across the app. */

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

/** Format a pickup window like "Fri, Jul 17, 5:00–7:00 PM". */
export function formatPickupWindow(startsAt: Date, endsAt: Date): string {
  const day = startsAt.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  return `${day}, ${startsAt.toLocaleTimeString("en-US", opts)}–${endsAt.toLocaleTimeString("en-US", opts)}`;
}
