import { describe, expect, it } from "vitest";
import { CreateProductSchema } from "./schema";

// Story 1.2, Task 8: stockQuantity/lowStockThreshold are added to this
// schema as required fields (see the new describe blocks below). This
// shared fixture must carry real values *now* so the existing "accepts"/
// "rejects" tests below keep testing what they say they test once those
// fields become required — otherwise every "rejects" case here would start
// failing for the wrong reason (missing required field, not the thing
// actually under test).
const validBody = {
  name: "Sourdough Loaf",
  priceCents: 900,
  stockQuantity: 50,
  lowStockThreshold: 5,
};

describe("CreateProductSchema", () => {
  it("accepts a valid body with only the required fields", () => {
    expect(CreateProductSchema.safeParse(validBody).success).toBe(true);
  });

  it("accepts optional description and imageUrl", () => {
    const result = CreateProductSchema.safeParse({
      ...validBody,
      description: "Crusty, tangy, 800g.",
      imageUrl: "https://res.cloudinary.com/demo/image/upload/loaf.jpg",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(CreateProductSchema.safeParse({ ...validBody, name: "" }).success).toBe(
      false,
    );
  });

  it("rejects a non-positive priceCents", () => {
    expect(
      CreateProductSchema.safeParse({ ...validBody, priceCents: 0 }).success,
    ).toBe(false);
  });

  it("rejects a non-integer priceCents", () => {
    expect(
      CreateProductSchema.safeParse({ ...validBody, priceCents: 9.99 }).success,
    ).toBe(false);
  });

  it("rejects an imageUrl that isn't a valid URL", () => {
    expect(
      CreateProductSchema.safeParse({ ...validBody, imageUrl: "not-a-url" }).success,
    ).toBe(false);
  });
});

describe("stockQuantity (Story 1.2, AC #1)", () => {
  it("accepts a valid non-negative integer stockQuantity", () => {
    const result = CreateProductSchema.safeParse({ ...validBody, stockQuantity: 42 });
    expect(result.success).toBe(true);
  });

  it("rejects a missing stockQuantity", () => {
    const result = CreateProductSchema.safeParse({ ...validBody, stockQuantity: undefined });
    expect(result.success).toBe(false);
  });

  it("rejects a negative stockQuantity", () => {
    expect(
      CreateProductSchema.safeParse({ ...validBody, stockQuantity: -1 }).success,
    ).toBe(false);
  });

  it("rejects a non-integer stockQuantity", () => {
    expect(
      CreateProductSchema.safeParse({ ...validBody, stockQuantity: 4.5 }).success,
    ).toBe(false);
  });
});

describe("lowStockThreshold (Story 1.2, AC #1)", () => {
  it("accepts a valid non-negative integer lowStockThreshold", () => {
    const result = CreateProductSchema.safeParse({ ...validBody, lowStockThreshold: 7 });
    expect(result.success).toBe(true);
  });

  it("rejects a missing lowStockThreshold", () => {
    const result = CreateProductSchema.safeParse({
      ...validBody,
      lowStockThreshold: undefined,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative lowStockThreshold", () => {
    expect(
      CreateProductSchema.safeParse({ ...validBody, lowStockThreshold: -1 }).success,
    ).toBe(false);
  });

  it("rejects a non-integer lowStockThreshold", () => {
    expect(
      CreateProductSchema.safeParse({ ...validBody, lowStockThreshold: 2.2 }).success,
    ).toBe(false);
  });
});
