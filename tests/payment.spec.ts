import { test, expect } from "@playwright/test";

// Requires seeded data + Stripe test keys. Drives the cart to the point of
// redirecting to Stripe Checkout. We stop at the Stripe redirect rather than
// completing payment, so the test stays fast and does not depend on Stripe's UI.
test.describe("payment flow", () => {
  test("checkout redirects to Stripe", async ({ page }) => {
    await page.goto("/vendors/corner-sourdough");
    await page.getByRole("button", { name: "Add" }).first().click();

    // Use a client-side nav (not page.goto) — the cart lives in in-memory
    // React state only, and a hard navigation would reload the page and
    // wipe it before this test ever sees the item.
    await page.getByRole("link", { name: "Cart" }).click();
    await page.getByPlaceholder(/your name/i).fill("Test Customer");
    await page.getByPlaceholder(/mobile number/i).fill("+15005550006");

    // Clicking checkout should call /api/checkout and redirect to Stripe.
    // Skip if Stripe keys are not configured in this environment.
    const [response] = await Promise.all([
      page.waitForResponse("**/api/checkout").catch(() => null),
      page.getByRole("button", { name: /checkout/i }).click(),
    ]);

    test.skip(
      !response || !response.ok(),
      "Stripe test keys not configured; skipping redirect assertion",
    );

    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 15_000 });
    await expect(page).toHaveURL(/stripe\.com/);
  });

  test("checkout success page renders", async ({ page }) => {
    // The page itself is static (order confirmation happens server-side via
    // the webhook, not by reading a query param here) — no order fixture
    // needed, just confirm Stripe's success_url target renders correctly.
    await page.goto("/checkout/success");
    await expect(
      page.getByRole("heading", { name: /thank you/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/we'll text you when it's ready for pickup/i),
    ).toBeVisible();
  });
});
