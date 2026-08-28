import { describe, expect, it } from "vitest";
import { UpdateVendorSchema } from "./schema";

// Story 7.1, AC #2/#5. Validated via isSelectableTimeZone() - only
// Intl.supportedValuesOf("timeZone")'s own canonical list is accepted,
// matching EditVendorTimezoneControl.tsx's <select> exactly (code review
// finding: the broader isValidTimeZone() accepts values, e.g.
// "UTC"/"US/Eastern", that aren't in that <select>'s options).
describe("UpdateVendorSchema", () => {
  it("accepts a valid IANA timezone and preserves it", () => {
    const result = UpdateVendorSchema.safeParse({ timezone: "America/Los_Angeles" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.timezone).toBe("America/Los_Angeles");
    }
  });

  it("rejects a malformed timezone string", () => {
    const result = UpdateVendorSchema.safeParse({ timezone: "Not/AZone" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["timezone"]);
      expect(result.error.issues[0]?.message).toBe("Invalid timezone");
    }
  });

  it("rejects a missing timezone field", () => {
    const result = UpdateVendorSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["timezone"]);
      expect(result.error.issues[0]?.message).toBe("Required");
    }
  });

  it("rejects a value not in Intl.supportedValuesOf(\"timeZone\") even though it's a real, constructible zone", () => {
    // "UTC" is accepted by isValidTimeZone() (Story 6.1's broader check,
    // used for read-side display fallback) but deliberately rejected here
    // - this schema must stay in sync with EditVendorTimezoneControl.tsx's
    // <select>, which doesn't offer "UTC" as an option (code review
    // finding).
    expect(UpdateVendorSchema.safeParse({ timezone: "UTC" }).success).toBe(false);
  });
});
