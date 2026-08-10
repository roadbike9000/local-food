import { describe, expect, it } from "vitest";
import { orderConfirmedMessage } from "./twilio";

describe("orderConfirmedMessage", () => {
  it("includes the vendor name and the last 6 characters of the order id", () => {
    expect(orderConfirmedMessage("Corner Sourdough", "clx1234567890abcdef")).toBe(
      "Your Corner Sourdough order (#abcdef) is confirmed! We'll text you when it's ready for pickup.",
    );
  });

  it("falls back to the whole id when it's shorter than 6 characters", () => {
    expect(orderConfirmedMessage("Corner Sourdough", "ab12")).toBe(
      "Your Corner Sourdough order (#ab12) is confirmed! We'll text you when it's ready for pickup.",
    );
  });
});
