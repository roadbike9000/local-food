import { describe, expect, it } from "vitest";
import {
  orderConfirmedMessage,
  lowStockAlertMessage,
  stockShortfallMessage,
} from "./index";

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

// Story 3.2: the routine "getting low" alert - distinct from
// stockShortfallMessage below, which covers a different event class.
describe("lowStockAlertMessage", () => {
  it("includes the product name, vendor name, current stock, and threshold", () => {
    const msg = lowStockAlertMessage("Sourdough Loaf", "Corner Sourdough", 3, 5);
    expect(msg).toContain("Sourdough Loaf");
    expect(msg).toContain("Corner Sourdough");
    expect(msg).toContain("3");
    expect(msg).toContain("5");
  });
});

// Story 3.2: the shortfall alert (AC #6) - a distinct message from
// lowStockAlertMessage, since a shortfall means money was already
// captured for units that couldn't be fulfilled.
describe("stockShortfallMessage", () => {
  it("includes the product name, vendor name, order id, requested, and available quantities", () => {
    const msg = stockShortfallMessage(
      "Sourdough Loaf",
      "Corner Sourdough",
      "clx1234567890abcdef",
      3,
      1,
    );
    expect(msg).toContain("Sourdough Loaf");
    expect(msg).toContain("Corner Sourdough");
    expect(msg).toContain("abcdef");
    expect(msg).toContain("3");
    expect(msg).toContain("1");
  });
});
