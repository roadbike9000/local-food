import { test, expect } from "@playwright/test";
import {
  getVendorBySlug,
  createTestProduct,
  deleteProduct,
} from "./helpers/db";

// Requires seeded data (npm run db:seed) - the homepage's vendor grid is
// empty otherwise, and these tests need at least one real card to inspect.

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

    // AC #4's focus-ring: a visible *terracotta* outline on keyboard focus,
    // not just any outline - color included, so a theme() lookup regression
    // (wrong token, typo) doesn't slip past this assertion.
    const outline = await cartLink.evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        style: style.outlineStyle,
        width: style.outlineWidth,
        color: style.outlineColor,
      };
    });
    expect(outline.style).toBe("solid");
    expect(outline.width).toBe("2px");
    // #a83f22 (colors.terracotta in tailwind.config.ts)
    expect(outline.color).toBe("rgb(168, 63, 34)");

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

  // Story 8.2 (vendor-card restyle): the whole card must stay one real
  // link with the vendor's name in its accessible name, and clicking
  // anywhere on it navigates - not just a "View menu" sub-element.
  test("vendor card is a real link to the vendor's storefront (Story 8.2)", async ({
    page,
  }) => {
    const vendor = await getVendorBySlug("corner-sourdough");
    await page.goto("/");

    const cardLink = page.getByRole("link", { name: new RegExp(vendor.name, "i") });
    await expect(cardLink).toBeVisible();
    await expect(cardLink).toHaveAttribute("href", `/vendors/${vendor.slug}`);

    await cardLink.click();
    await expect(page).toHaveURL(new RegExp(`/vendors/${vendor.slug}`));
  });

  // AC #1's "no dead decorative buttons" rule: the card's "View menu" text
  // is presentational only - the whole-card <Link> must be the *only*
  // focusable element inside the card, not a second nested interactive one.
  test("a vendor card has exactly one focusable element inside it (Story 8.2)", async ({
    page,
  }) => {
    const vendor = await getVendorBySlug("corner-sourdough");
    await page.goto("/");

    const cardLink = page.getByRole("link", { name: new RegExp(vendor.name, "i") });
    await expect(cardLink.getByRole("link")).toHaveCount(0);
    await expect(cardLink.getByRole("button")).toHaveCount(0);
  });

  // AC #3: every vendor card is keyboard-reachable and shows the Story
  // 8.1 focus-ring (terracotta outline), matching the cart-pill's own
  // focus-ring test in this file.
  test("a vendor card is keyboard-reachable with a visible focus-ring (Story 8.2)", async ({
    page,
  }) => {
    const vendor = await getVendorBySlug("corner-sourdough");
    await page.goto("/");

    const cardLink = page.getByRole("link", { name: new RegExp(vendor.name, "i") });
    await cardLink.focus();
    await expect(cardLink).toBeFocused();

    const outline = await cardLink.evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        style: style.outlineStyle,
        width: style.outlineWidth,
        color: style.outlineColor,
      };
    });
    expect(outline.style).toBe("solid");
    expect(outline.width).toBe("2px");
    expect(outline.color).toBe("rgb(168, 63, 34)");

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/vendors/${vendor.slug}`), {
      timeout: 15_000,
    });
  });
});
