import { describe, expect, it } from "vitest";
import { formatPickupWindow, formatPrice, slugify } from "./utils";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Corner Sourdough")).toBe("corner-sourdough");
  });

  it("strips characters that aren't letters, digits, or spaces", () => {
    expect(slugify("Jo's Café & Bakery!")).toBe("jo-s-cafe-bakery");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  --Green Valley--  ")).toBe("green-valley");
  });

  it("transliterates accented letters instead of dropping them", () => {
    expect(slugify("Café Rosé")).toBe("cafe-rose");
    expect(slugify("Núñez Farms")).toBe("nunez-farms");
  });
});

describe("formatPrice", () => {
  it("formats cents as a dollar string", () => {
    expect(formatPrice(1250)).toBe("$12.50");
  });

  it("handles zero", () => {
    expect(formatPrice(0)).toBe("$0.00");
  });

  it("rounds a fractional-cent input by the same rule as Intl.NumberFormat", () => {
    // priceCents is always an integer in practice (schema.prisma), but this
    // documents that formatPrice trusts the caller — it doesn't round itself.
    expect(formatPrice(999)).toBe("$9.99");
  });

  it("respects the currency argument", () => {
    expect(formatPrice(1000, "CAD")).toContain("10.00");
  });
});

describe("formatPickupWindow", () => {
  it("formats a same-day window as 'Weekday, Month Day, start–end'", () => {
    // Constructed via the local-timezone Date constructor and formatted in
    // that same runtime-local zone (Intl's own resolvedOptions()) - this
    // test is about the string shape, not about a specific IANA zone, so it
    // stays machine-timezone-agnostic exactly as it was before Story 6.1
    // made timeZone a required parameter.
    const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const startsAt = new Date(2026, 0, 15, 17, 0, 0);
    const endsAt = new Date(2026, 0, 15, 19, 30, 0);
    expect(formatPickupWindow(startsAt, endsAt, localZone)).toBe(
      "Thu, Jan 15, 5:00 PM–7:30 PM",
    );
  });

  // Story 6.1 (FR17): proves the timeZone parameter actually changes the
  // displayed string, not just that it's accepted - the same absolute
  // instant, displayed in two different zones, must show different
  // wall-clock times.
  it("displays the same instant differently in two different timezones", () => {
    const startsAt = new Date("2026-01-15T22:00:00.000Z");
    const endsAt = new Date("2026-01-16T00:00:00.000Z");
    expect(formatPickupWindow(startsAt, endsAt, "America/New_York")).toBe(
      "Thu, Jan 15, 5:00 PM–7:00 PM",
    );
    expect(formatPickupWindow(startsAt, endsAt, "Asia/Tokyo")).toBe(
      "Fri, Jan 16, 7:00 AM–9:00 AM",
    );
  });
});
