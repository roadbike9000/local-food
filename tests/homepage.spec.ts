import { test, expect } from "@playwright/test";

// Smoke test: the homepage loads and shows the marketplace heading + nav.
test.describe("homepage", () => {
  test("loads and shows the heading", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /find local food/i }),
    ).toBeVisible();
  });

  test("has a link to the cart", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /cart/i })).toBeVisible();
  });
});
