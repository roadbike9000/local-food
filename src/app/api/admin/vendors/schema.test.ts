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

  // Story 7.1, AC #1/#5. Validated via isSelectableTimeZone() - only
  // Intl.supportedValuesOf("timeZone")'s own canonical list is accepted,
  // matching AddVendorForm.tsx's <select> exactly (code review finding:
  // the broader isValidTimeZone() accepts values, e.g. "UTC"/"US/Eastern",
  // that aren't in that <select>'s options).
  it("defaults timezone to America/New_York when omitted", () => {
    expect(CreateVendorSchema.parse(validBody).timezone).toBe("America/New_York");
  });

  it("accepts a valid non-default IANA timezone and preserves it", () => {
    const result = CreateVendorSchema.safeParse({ ...validBody, timezone: "Asia/Tokyo" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.timezone).toBe("Asia/Tokyo");
    }
  });

  it("rejects a malformed timezone string", () => {
    const result = CreateVendorSchema.safeParse({ ...validBody, timezone: "Not/AZone" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["timezone"]);
      expect(result.error.issues[0]?.message).toBe("Invalid timezone");
    }
  });

  it("rejects a value not in Intl.supportedValuesOf(\"timeZone\") even though it's a real, constructible zone", () => {
    // "UTC" is accepted by isValidTimeZone() (Story 6.1's broader check,
    // used for read-side display fallback) but deliberately rejected here
    // - this schema must stay in sync with AddVendorForm.tsx's <select>,
    // which doesn't offer "UTC" as an option (code review finding).
    expect(
      CreateVendorSchema.safeParse({ ...validBody, timezone: "UTC" }).success,
    ).toBe(false);
  });
});
