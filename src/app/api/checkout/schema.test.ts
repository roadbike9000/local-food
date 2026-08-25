import { describe, expect, it } from "vitest";
import { CheckoutSchema } from "./schema";

const validBody = {
  vendorId: "vendor_1",
  pickupSlotId: "slot_1",
  customerName: "Jane Doe",
  customerPhone: "+15005550006",
  items: [{ productId: "prod_1", quantity: 2 }],
};

describe("CheckoutSchema", () => {
  it("accepts a valid body", () => {
    expect(CheckoutSchema.safeParse(validBody).success).toBe(true);
  });

  it("rejects an empty items array", () => {
    const result = CheckoutSchema.safeParse({ ...validBody, items: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a non-positive quantity", () => {
    const result = CheckoutSchema.safeParse({
      ...validBody,
      items: [{ productId: "prod_1", quantity: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a phone number shorter than 5 characters", () => {
    const result = CheckoutSchema.safeParse({ ...validBody, customerPhone: "123" });
    expect(result.success).toBe(false);
  });

  it("strips a client-sent totalCents rather than accepting it as trusted input", () => {
    const result = CheckoutSchema.safeParse({ ...validBody, totalCents: 1 });
    expect(result.success).toBe(true);
    expect(result.success && "totalCents" in result.data).toBe(false);
  });

  it("rejects a missing vendorId", () => {
    const { vendorId: _vendorId, ...withoutVendorId } = validBody;
    expect(CheckoutSchema.safeParse(withoutVendorId).success).toBe(false);
  });

  // Story 5.1, AC #1: no order can be created without a pickupSlotId. Mirrors
  // the "rejects a missing vendorId" pattern above.
  it("rejects a missing pickupSlotId", () => {
    const { pickupSlotId: _pickupSlotId, ...withoutSlot } = validBody;
    expect(CheckoutSchema.safeParse(withoutSlot).success).toBe(false);
  });
});
