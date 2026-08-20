import { describe, expect, it } from "vitest";
import { clampQuantity } from "./cart";

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
