import { describe, expect, it } from "vitest";
import { formatPickupWindow, formatPrice, slugify } from "./utils";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Corner Sourdough")).toBe("corner-sourdough");
  });

  it("strips characters that aren't letters, digits, or spaces", () => {
    expect(slugify("Jo's Café & Bakery!")).toBe("jo-s-caf-bakery");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  --Green Valley--  ")).toBe("green-valley");
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
    const startsAt = new Date(2026, 0, 15, 17, 0, 0);
    const endsAt = new Date(2026, 0, 15, 19, 30, 0);
    expect(formatPickupWindow(startsAt, endsAt)).toBe(
      "Thu, Jan 15, 5:00 PM–7:30 PM",
    );
  });
});
