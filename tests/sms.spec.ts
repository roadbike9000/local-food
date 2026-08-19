import { test, expect } from "@playwright/test";
import { getVendorBySlug, createTestProduct, deleteProduct } from "./helpers/db";

// Verifies the cart collects the customer's mobile number, which is the field
// used to send the Twilio pickup SMS after payment.
test.describe("sms / contact fields", () => {
  test("cart requires a mobile number before checkout", async ({ page }) => {
    // Own dedicated fixture rather than .first() on the storefront listing
    // — since Story 1.3, out-of-stock products are shown (not filtered
    // out) with a disabled Add button, so .first() can land on a product
    // another test concurrently zeroed under fullyParallel:true (review
    // round 2 finding).
    const vendor = await getVendorBySlug("corner-sourdough");
    const product = await createTestProduct(vendor.id, {
      name: "Playwright SMS Contact Product",
    });

    try {
      await page.goto("/vendors/corner-sourdough");
      const card = page
        .getByRole("heading", { name: product.name, exact: true })
        .locator("../..");
      await card.getByRole("button", { name: "Add" }).click();
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
    } finally {
      await deleteProduct(product.id);
    }
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
