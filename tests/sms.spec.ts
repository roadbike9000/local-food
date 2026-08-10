import { test, expect } from "@playwright/test";

// Verifies the cart collects the customer's mobile number, which is the field
// used to send the Twilio pickup SMS after payment.
test.describe("sms / contact fields", () => {
  test("cart requires a mobile number before checkout", async ({ page }) => {
    await page.goto("/vendors/corner-sourdough");
    await page.getByRole("button", { name: "Add" }).first().click();
    // Client-side nav — page.goto would hard-reload and wipe the in-memory
    // cart state before this test ever sees the added item.
    await page.getByRole("link", { name: "Cart" }).click();

    const checkout = page.getByRole("button", { name: /checkout/i });

    // With no phone entered, checkout is disabled.
    await page.getByPlaceholder(/your name/i).fill("Test Customer");
    await expect(checkout).toBeDisabled();

    // Once a mobile number is entered, checkout enables.
    await page.getByPlaceholder(/mobile number/i).fill("+15005550006");
    await expect(checkout).toBeEnabled();
  });

  // NOTE: this only checks the debug endpoint's wiring/shape. Asserting an
  // actual order-confirmation message was recorded (phone + content) needs a
  // signed Stripe webhook to drive checkout.session.completed end to end, and
  // this branch has no such test helper yet — see payment.spec.ts, which
  // stops at the redirect to Stripe for the same reason.
  test("debug SMS endpoint exposes mock-sent messages outside production", async ({
    request,
  }) => {
    const response = await request.get("/api/debug/sms");
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(Array.isArray(body.messages)).toBe(true);
  });
});
