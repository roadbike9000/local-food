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

  // ATDD red phase (Story 8.1, header-cart-pill): the cart link's accessible
  // name must be an explicit "Cart, N items" aria-label, not just whatever
  // text happens to be inside it — currently red, the link has no aria-label
  // at all yet.
  test("cart link has an explicit item-count aria-label (Story 8.1)", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: /^cart, \d+ items?$/i }),
    ).toBeVisible();
  });

  test("cart-pill icon is decorative and the link is keyboard-reachable (Story 8.1)", async ({
    page,
  }) => {
    await page.goto("/");
    const cartLink = page.getByRole("link", { name: /^cart, \d+ items?$/i });

    // The basket icon must not be exposed to the accessibility tree - the
    // link's own aria-label already carries the accessible name.
    await expect(cartLink.locator("svg[aria-hidden='true']")).toHaveCount(1);

    // Real keyboard activation, not just a visual snapshot: Tab from the
    // page's first focusable element (the "Local Food" logo link, which
    // renders immediately before the cart link in Navbar.tsx) reaches the
    // cart link, and Enter navigates.
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(cartLink).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/cart/, { timeout: 15_000 });
  });
});
