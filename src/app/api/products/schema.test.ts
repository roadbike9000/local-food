import { describe, expect, it } from "vitest";
import { CreateProductSchema } from "./schema";

const validBody = {
  name: "Sourdough Loaf",
  priceCents: 900,
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
