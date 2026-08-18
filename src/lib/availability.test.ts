import { describe, expect, it } from "vitest";
import { isInStock } from "./availability";

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
