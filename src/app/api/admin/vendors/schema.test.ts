import { describe, expect, it } from "vitest";
import { CreateVendorSchema } from "./schema";

// Story 2.2, Task 3: CreateVendorSchema doesn't exist yet - this is the
// red-phase scaffold for it. Every case below is `.skip`ped on purpose
// (ATDD red phase - these must not run, and can't: the import above fails
// until Task 3 lands). name/slug are required; phone/description stay
// optional, matching Vendor.phone/description's existing optionality in
// prisma/schema.prisma - this schema doesn't make either required, same as
// today.
const validBody = {
  name: "Test Vendor",
  slug: "test-vendor",
};

describe("CreateVendorSchema", () => {
  it.skip("accepts a valid body with only the required fields", () => {
    expect(CreateVendorSchema.safeParse(validBody).success).toBe(true);
  });

  it.skip("accepts optional phone and description", () => {
    const result = CreateVendorSchema.safeParse({
      ...validBody,
      phone: "+15555550199",
      description: "A vendor onboarded by an admin.",
    });
    expect(result.success).toBe(true);
  });

  it.skip("rejects a missing name", () => {
    const result = CreateVendorSchema.safeParse({ ...validBody, name: undefined });
    expect(result.success).toBe(false);
  });

  it.skip("rejects an empty name", () => {
    expect(CreateVendorSchema.safeParse({ ...validBody, name: "" }).success).toBe(
      false,
    );
  });

  it.skip("rejects a missing slug", () => {
    const result = CreateVendorSchema.safeParse({ ...validBody, slug: undefined });
    expect(result.success).toBe(false);
  });

  it.skip("rejects an empty slug", () => {
    expect(CreateVendorSchema.safeParse({ ...validBody, slug: "" }).success).toBe(
      false,
    );
  });
});
