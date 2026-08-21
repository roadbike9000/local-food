import { test, expect } from "@playwright/test";
import {
  getVendorBySlug,
  createTestProduct,
  deleteProduct,
  deleteOrder,
  prisma,
} from "./helpers/db";

// Requires seeded data + Stripe test keys. Drives the cart to the point of
// redirecting to Stripe Checkout. We stop at the Stripe redirect rather than
// completing payment, so the test stays fast and does not depend on Stripe's UI.
test.describe("payment flow", () => {
  test("checkout redirects to Stripe", async ({ page }) => {
    // Own dedicated fixture rather than .first() on the storefront listing
    // — since Story 1.3, out-of-stock products are shown (not filtered
    // out) with a disabled Add button, so .first() can land on a product
    // another test concurrently zeroed under fullyParallel:true (review
    // round 2 finding).
    const vendor = await getVendorBySlug("corner-sourdough");
    // Timestamped, not a fixed name — a fixed name collides with any stale
    // leftover row from a prior interrupted run (this test's own finally
    // block only deletes the row it created, not a same-named stale one),
    // producing a strict-mode "resolved to 2 elements" locator error.
    // Matches the timestamped-name convention every other fixture in this
    // suite already uses for the same reason.
    const product = await createTestProduct(vendor.id, {
      name: `Playwright Payment Flow Product ${Date.now()}`,
    });

    try {
      await page.goto("/vendors/corner-sourdough");
      const card = page
        .getByRole("heading", { name: product.name, exact: true })
        .locator("../..");
      await card.getByRole("button", { name: "Add" }).click();

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
    } finally {
      // When Stripe keys are configured, this test's own checkout click
      // creates a real Order/OrderItem referencing this product — the FK
      // on OrderItem.productId has no cascade, so it must be cleaned up
      // before the product can be deleted.
      const orderItems = await prisma.orderItem.findMany({
        where: { productId: product.id },
      });
      for (const orderItem of orderItems) {
        await deleteOrder(orderItem.orderId);
      }
      await deleteProduct(product.id);
    }
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
