import { describe, expect, it } from "vitest";
import { isInStock } from "./inventory";

// RED PHASE (Story 1.3, Task 2): isInStock doesn't exist in
// src/lib/inventory.ts yet - this file correctly fails to import today.
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
