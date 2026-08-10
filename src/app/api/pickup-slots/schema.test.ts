import { describe, expect, it } from "vitest";
import { CreateSlotSchema } from "./schema";

const validBody = {
  startsAt: "2026-08-10T17:00:00.000Z",
  endsAt: "2026-08-10T19:00:00.000Z",
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
    const result = CreateSlotSchema.safeParse({
      startsAt: "2026-08-10T19:00:00.000Z",
      endsAt: "2026-08-10T17:00:00.000Z",
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
});
