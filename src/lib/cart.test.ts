import { describe, expect, it } from "vitest";
import { clampQuantity, formatCartBadgeText, formatCartCountLabel } from "./cart";

// clampQuantity is the single shared floor/ceiling enforcement used by both
// CartProvider's addItem repeat-click increment and the cart stepper's
// updateQuantity (Story 1.5, AC #3/#6). Pure and cheap to pin directly,
// rather than relying only on the four Playwright E2E tests that exercise
// it indirectly through UI clicks (review round 1 finding).
describe("clampQuantity", () => {
  it("returns the quantity unchanged when within [1, stockQuantity]", () => {
    expect(clampQuantity(3, 10)).toBe(3);
  });

  it("floors at 1 when quantity is below the floor", () => {
    expect(clampQuantity(0, 10)).toBe(1);
    expect(clampQuantity(-5, 10)).toBe(1);
  });

  it("ceilings at stockQuantity when quantity exceeds it", () => {
    expect(clampQuantity(11, 10)).toBe(10);
    expect(clampQuantity(1000, 10)).toBe(10);
  });

  it("lands exactly on stockQuantity at the boundary", () => {
    expect(clampQuantity(10, 10)).toBe(10);
  });

  // Documents current, deliberate behavior (review round 1 Decision item):
  // a stockQuantity of 0 or negative still floors to 1, not 0 - flooring to
  // 0 would send a quantity:0 line into the checkout payload, a bigger
  // change than this story's scope. The cart page instead shows a "no
  // longer available" note on any line whose stockQuantity <= 0, rather
  // than changing this function's floor.
  it("floors at 1 even when stockQuantity is 0 or negative", () => {
    expect(clampQuantity(1, 0)).toBe(1);
    expect(clampQuantity(5, 0)).toBe(1);
    expect(clampQuantity(1, -3)).toBe(1);
  });
});

// Story 8.1's cart-pill aria-label (review round 1 finding: no singular
// branch shipped once already - "Cart, 1 items" - so the count === 1 case
// is pinned directly here, not just through the Playwright test that
// exercises it via a real cart).
describe("formatCartCountLabel", () => {
  it("uses singular wording for exactly 1", () => {
    expect(formatCartCountLabel(1)).toBe("1 item");
  });

  it("uses plural wording for 0", () => {
    expect(formatCartCountLabel(0)).toBe("0 items");
  });

  it("uses plural wording for counts above 1", () => {
    expect(formatCartCountLabel(2)).toBe("2 items");
    expect(formatCartCountLabel(12)).toBe("12 items");
  });
});

// The cart-pill badge's visible digits (review round 2 finding: the "99+"
// overflow cap and 2+-digit resize were untested). aria-label always keeps
// the exact count via formatCartCountLabel above - this only caps what the
// small circular badge displays.
describe("formatCartBadgeText", () => {
  it("shows the exact count for single and double digits", () => {
    expect(formatCartBadgeText(0)).toBe("0");
    expect(formatCartBadgeText(9)).toBe("9");
    expect(formatCartBadgeText(42)).toBe("42");
  });

  it("shows the exact count at the 99 boundary", () => {
    expect(formatCartBadgeText(99)).toBe("99");
  });

  it("caps at '99+' once the count exceeds 99", () => {
    expect(formatCartBadgeText(100)).toBe("99+");
    expect(formatCartBadgeText(1000)).toBe("99+");
  });
});
