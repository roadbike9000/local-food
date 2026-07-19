import { test, expect } from "@playwright/test";

// Verifies the cart collects the customer's mobile number, which is the field
// used to send the Twilio pickup SMS after payment.
test.describe("sms / contact fields", () => {
  test("cart requires a mobile number before checkout", async ({ page }) => {
    await page.goto("/vendors/corner-sourdough");
    await page.getByRole("button", { name: "Add" }).first().click();
    await page.goto("/cart");

    const checkout = page.getByRole("button", { name: /checkout/i });

    // With no phone entered, checkout is disabled.
    await page.getByPlaceholder(/your name/i).fill("Test Customer");
    await expect(checkout).toBeDisabled();

    // Once a mobile number is entered, checkout enables.
    await page.getByPlaceholder(/mobile number/i).fill("+15005550006");
    await expect(checkout).toBeEnabled();
  });
});
