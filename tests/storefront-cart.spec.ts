import { test, expect } from "@playwright/test";
import {
  getVendorBySlug,
  createTestProduct,
  deleteProduct,
  prisma,
} from "./helpers/db";

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
    // /cart's first hit can lose the race against Next.js's on-demand route
    // compile under parallel test load (see playwright.config.ts's timeout
    // comment) — same reasoning as the extended timeouts in dashboard.spec.ts.
    await page.getByRole("link", { name: /cart/i }).click();
    await expect(page).toHaveURL(/cart/, { timeout: 15_000 });
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

  test("checkout shows an error when a cart item goes unavailable before submitting", async ({
    page,
  }) => {
    const vendor = await getVendorBySlug("corner-sourdough");
    // Storefront lists products alphabetically (vendors/[slug]/page.tsx), so
    // "Cinnamon Morning Bun" is the same product the "Add" .first() click
    // above targets.
    const product = vendor.products.find(
      (p) => p.name === "Cinnamon Morning Bun",
    );
    if (!product) throw new Error("Seed data missing 'Cinnamon Morning Bun'");

    try {
      await page.goto("/vendors/corner-sourdough");
      await page.getByRole("button", { name: "Add" }).first().click();
      await page.getByRole("link", { name: /cart/i }).click();
      await expect(page).toHaveURL(/cart/, { timeout: 15_000 });

      await page.getByPlaceholder(/your name/i).fill("Availability Check Customer");
      await page.getByPlaceholder(/mobile number/i).fill("+15005550006");

      // Simulate the vendor marking it unavailable (or the last one selling
      // out) after it was added to the cart but before checkout submits.
      await prisma.product.update({
        where: { id: product.id },
        data: { isAvailable: false },
      });

      await page.getByRole("button", { name: /checkout/i }).click();
      await expect(
        page.getByText("One or more items are unavailable"),
      ).toBeVisible();
    } finally {
      await prisma.product.update({
        where: { id: product.id },
        data: { isAvailable: true },
      });
    }
  });
});
