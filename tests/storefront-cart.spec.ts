import { test, expect } from "@playwright/test";
import { getVendorBySlug, createTestProduct, deleteProduct } from "./helpers/db";

// Requires seeded data (npm run db:seed). Visits a vendor storefront, adds an
// item, and confirms it appears in the cart.
test.describe("storefront and cart", () => {
  test("can add a product to the cart", async ({ page }) => {
    await page.goto("/vendors/corner-sourdough");
    await expect(
      page.getByRole("heading", { name: /corner sourdough/i }),
    ).toBeVisible();

    // Add the first product.
    await page.getByRole("button", { name: "Add" }).first().click();

    // The cart badge in the navbar should now show at least 1.
    await page.getByRole("link", { name: /cart/i }).click();
    await expect(page).toHaveURL(/cart/);
    await expect(page.getByText(/total/i)).toBeVisible();
  });

  test("unavailable products are excluded from the storefront listing", async ({
    page,
  }) => {
    const vendor = await getVendorBySlug("corner-sourdough");
    const hidden = await createTestProduct(vendor.id, {
      name: "Playwright Hidden Product",
      isAvailable: false,
    });

    try {
      await page.goto("/vendors/corner-sourdough");
      await expect(
        page.getByRole("heading", { name: /corner sourdough/i }),
      ).toBeVisible();
      await expect(page.getByText("Playwright Hidden Product")).not.toBeVisible();
    } finally {
      await deleteProduct(hidden.id);
    }
  });
});
