import { describe, expect, it } from "vitest";
import { isInStock, isLowStock } from "./availability";

// Pure function, no Prisma/Clerk involved, so this belongs in Vitest per
// project-context.md's Testing Rules (unlike Story 1.2's DB-touching tests,
// which had to move out to Playwright).
describe("isInStock", () => {
  it("returns false when stockQuantity is 0", () => {
    expect(isInStock({ stockQuantity: 0 })).toBe(false);
  });

  it("returns true when stockQuantity is 1", () => {
    expect(isInStock({ stockQuantity: 1 })).toBe(true);
  });

  it("returns true for a larger stockQuantity", () => {
    expect(isInStock({ stockQuantity: 42 })).toBe(true);
  });
});

// Story 3.1: the single canonical low-stock check (AC #2). Same
// pure-function, dual-import shape as isInStock above.
describe("isLowStock", () => {
  it("returns true when stockQuantity is below lowStockThreshold", () => {
    expect(isLowStock({ stockQuantity: 2, lowStockThreshold: 5 })).toBe(true);
  });

  it("returns true when stockQuantity equals lowStockThreshold (boundary)", () => {
    expect(isLowStock({ stockQuantity: 5, lowStockThreshold: 5 })).toBe(true);
  });

  it("returns false when stockQuantity is comfortably above lowStockThreshold", () => {
    expect(isLowStock({ stockQuantity: 50, lowStockThreshold: 5 })).toBe(
      false,
    );
  });

  it("returns true when stockQuantity is 0, even with a threshold of 0 (placeholder default, AD-9)", () => {
    expect(isLowStock({ stockQuantity: 0, lowStockThreshold: 0 })).toBe(true);
  });

  it("returns true when stockQuantity is 0 with a positive threshold", () => {
    expect(isLowStock({ stockQuantity: 0, lowStockThreshold: 5 })).toBe(true);
  });

  // The `|| stockQuantity === 0` branch is unreachable via the `<=`
  // comparison alone unless lowStockThreshold is negative - nothing in
  // the schema enforces >= 0. This is the one input class that actually
  // distinguishes the two clauses; without it, deleting the `=== 0`
  // clause entirely would leave every other case above still passing
  // (review finding).
  it("returns true when stockQuantity is 0 even with a negative threshold", () => {
    expect(isLowStock({ stockQuantity: 0, lowStockThreshold: -1 })).toBe(
      true,
    );
  });
});
