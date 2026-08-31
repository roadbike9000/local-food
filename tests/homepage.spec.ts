import { test, expect } from "@playwright/test";
import {
  getVendorBySlug,
  createTestProduct,
  deleteProduct,
} from "./helpers/db";

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
    const logoLink = page.getByRole("link", { name: "Local Food" });
    await page.keyboard.press("Tab");
    await expect(logoLink).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(cartLink).toBeFocused();

    // AC #4's focus-ring: a visible terracotta outline on keyboard focus,
    // not just a focused-but-unstyled element.
    const outline = await cartLink.evaluate((el) => {
      const style = getComputedStyle(el);
      return { style: style.outlineStyle, width: style.outlineWidth };
    });
    expect(outline.style).toBe("solid");
    expect(outline.width).toBe("2px");

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/cart/, { timeout: 15_000 });
  });

  // Regression coverage for a review-round-1 finding: the aria-label had no
  // singular branch ("Cart, 1 items"). A loose `items?` regex would pass
  // either wording, so this asserts the exact singular string against a
  // cart holding exactly one item.
  test("cart link uses singular wording for exactly one item (Story 8.1)", async ({
    page,
  }) => {
    const vendor = await getVendorBySlug("corner-sourdough");
    const product = await createTestProduct(vendor.id, {
      name: "Playwright Singular Count Product",
    });

    try {
      await page.goto(`/vendors/${vendor.slug}`);
      const card = page
        .getByRole("heading", { name: product.name, exact: true })
        .locator("../..");
      await card.getByRole("button", { name: "Add" }).click();

      // exact: true matters here - "Cart, 1 item" is itself a substring of
      // the buggy "Cart, 1 items", so a loose match wouldn't catch the
      // regression this test exists for.
      await expect(
        page.getByRole("link", { name: "Cart, 1 item", exact: true }),
      ).toBeVisible();
    } finally {
      await deleteProduct(product.id);
    }
  });
});
