import { describe, expect, it } from "vitest";
import { CreateVendorSchema } from "./schema";

// name/slug are required; phone/description stay optional, matching
// Vendor.phone/description's existing optionality in prisma/schema.prisma.
const validBody = {
  name: "Test Vendor",
  slug: "test-vendor",
};

describe("CreateVendorSchema", () => {
  it("accepts a valid body with only the required fields", () => {
    expect(CreateVendorSchema.safeParse(validBody).success).toBe(true);
  });

  it("accepts optional phone and description", () => {
    const result = CreateVendorSchema.safeParse({
      ...validBody,
      phone: "+15555550199",
      description: "A vendor onboarded by an admin.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing name", () => {
    const result = CreateVendorSchema.safeParse({ ...validBody, name: undefined });
    expect(result.success).toBe(false);
  });

  it("rejects an empty name", () => {
    expect(CreateVendorSchema.safeParse({ ...validBody, name: "" }).success).toBe(
      false,
    );
  });

  it("rejects a missing slug", () => {
    const result = CreateVendorSchema.safeParse({ ...validBody, slug: undefined });
    expect(result.success).toBe(false);
  });

  it("rejects an empty slug", () => {
    expect(CreateVendorSchema.safeParse({ ...validBody, slug: "" }).success).toBe(
      false,
    );
  });
});
