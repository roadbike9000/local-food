import { describe, expect, it } from "vitest";
import { CreateSlotSchema } from "./schema";

// Relative to Date.now(), not a hardcoded literal (Story 5.2 review finding
// - see project-context.md's durable rule) - a frozen ISO string is only
// "upcoming" until real time catches up to it, then silently starts
// failing every "accepts a valid body" test below for a reason none of
// them are actually testing.
const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
const validBody = {
  startsAt: tomorrow.toISOString(),
  endsAt: new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000).toISOString(),
};

describe("CreateSlotSchema", () => {
  it("accepts a valid body and defaults capacity to 20", () => {
    const result = CreateSlotSchema.safeParse(validBody);
    expect(result.success).toBe(true);
    expect(result.success && result.data.capacity).toBe(20);
  });

  it("accepts an explicit capacity and location", () => {
    const result = CreateSlotSchema.safeParse({
      ...validBody,
      capacity: 5,
      location: "12 Market St",
    });
    expect(result.success).toBe(true);
  });

  it("rejects endsAt before startsAt", () => {
    // Reuses validBody's own two (relative-future, ordered) timestamps
    // swapped - isolates exactly the endsAt-before-startsAt condition,
    // rather than a second independently-hardcoded literal pair.
    const result = CreateSlotSchema.safeParse({
      startsAt: validBody.endsAt,
      endsAt: validBody.startsAt,
    });
    expect(result.success).toBe(false);
  });

  it("rejects endsAt equal to startsAt", () => {
    const result = CreateSlotSchema.safeParse({
      startsAt: validBody.startsAt,
      endsAt: validBody.startsAt,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-ISO-datetime startsAt", () => {
    const result = CreateSlotSchema.safeParse({
      ...validBody,
      startsAt: "not-a-date",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-positive capacity", () => {
    const result = CreateSlotSchema.safeParse({ ...validBody, capacity: 0 });
    expect(result.success).toBe(false);
  });

  // Story 5.2, AC #1: startsAt already in the past is rejected, independent
  // of the endsAt > startsAt check (AC #2's "unaffected" - endsAt is a
  // genuinely valid future time here, only startsAt is wrong).
  it("rejects a startsAt already in the past", () => {
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const result = CreateSlotSchema.safeParse({ startsAt: past, endsAt: validBody.endsAt });
    expect(result.success).toBe(false);
  });
});
