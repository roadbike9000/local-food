import { describe, expect, it } from "vitest";
import { UpdateProductStockSchema } from "./schema";

// Mirrors src/app/api/products/schema.test.ts's existing pattern: one
// shared valid body, "accepts valid" + one "rejects" case per invalid
// value per field.
const validBody = {
  stockQuantity: 15,
  lowStockThreshold: 3,
  expectedStockVersion: 20,
};

describe("UpdateProductStockSchema", () => {
  it("accepts a valid body with all three required fields", () => {
    expect(UpdateProductStockSchema.safeParse(validBody).success).toBe(true);
  });

  it("rejects a missing stockQuantity", () => {
    const result = UpdateProductStockSchema.safeParse({
      ...validBody,
      stockQuantity: undefined,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative stockQuantity", () => {
    expect(
      UpdateProductStockSchema.safeParse({ ...validBody, stockQuantity: -1 }).success,
    ).toBe(false);
  });

  it("rejects a non-integer stockQuantity", () => {
    expect(
      UpdateProductStockSchema.safeParse({ ...validBody, stockQuantity: 1.5 }).success,
    ).toBe(false);
  });

  it("rejects a stockQuantity above the Postgres INTEGER max", () => {
    expect(
      UpdateProductStockSchema.safeParse({
        ...validBody,
        stockQuantity: 2_147_483_648,
      }).success,
    ).toBe(false);
  });

  it("rejects a missing lowStockThreshold", () => {
    const result = UpdateProductStockSchema.safeParse({
      ...validBody,
      lowStockThreshold: undefined,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative lowStockThreshold", () => {
    expect(
      UpdateProductStockSchema.safeParse({ ...validBody, lowStockThreshold: -1 }).success,
    ).toBe(false);
  });

  it("rejects a non-integer lowStockThreshold", () => {
    expect(
      UpdateProductStockSchema.safeParse({ ...validBody, lowStockThreshold: 0.5 }).success,
    ).toBe(false);
  });

  it("rejects a lowStockThreshold above the Postgres INTEGER max", () => {
    expect(
      UpdateProductStockSchema.safeParse({
        ...validBody,
        lowStockThreshold: 2_147_483_648,
      }).success,
    ).toBe(false);
  });

  it("rejects a missing expectedStockVersion", () => {
    const result = UpdateProductStockSchema.safeParse({
      ...validBody,
      expectedStockVersion: undefined,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative expectedStockVersion", () => {
    expect(
      UpdateProductStockSchema.safeParse({ ...validBody, expectedStockVersion: -1 })
        .success,
    ).toBe(false);
  });

  it("rejects a non-integer expectedStockVersion", () => {
    expect(
      UpdateProductStockSchema.safeParse({ ...validBody, expectedStockVersion: 3.14 })
        .success,
    ).toBe(false);
  });

  it("rejects an expectedStockVersion above the Postgres INTEGER max", () => {
    expect(
      UpdateProductStockSchema.safeParse({
        ...validBody,
        expectedStockVersion: 2_147_483_648,
      }).success,
    ).toBe(false);
  });
});
