import { describe, expect, it } from "vitest";
import { UpdateVendorSchema } from "./schema";

// Story 7.1, AC #2/#5. The production schema's `timezone` field exists but
// isn't validated yet (red-phase stub) — the "rejects a malformed
// timezone string" case is the one genuinely red test here (it fails today
// because nothing rejects a bad value); the other two already pass against
// the stub's correct typing/required-field plumbing, which isn't the
// behavior this story needs to newly implement.
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
});
