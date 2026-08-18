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

    // Target a specific, known-in-stock product by name rather than
    // .first() — a same-named/earlier-sorting out-of-stock fixture from a
    // parallel test can render disabled and hang a .first() click (review
    // round 1 finding).
    const card = page
      .getByRole("heading", { name: "Cinnamon Morning Bun", exact: true })
      .locator("../..");
    await card.getByRole("button", { name: "Add" }).click();

    // The cart badge in the navbar should now show at least 1.
    // /cart's first hit can lose the race against Next.js's on-demand route
    // compile under parallel test load (see playwright.config.ts's timeout
    // comment) — same reasoning as the extended timeouts in dashboard.spec.ts.
    await page.getByRole("link", { name: /cart/i }).click();
    await expect(page).toHaveURL(/cart/, { timeout: 15_000 });
    await expect(page.getByText(/total/i)).toBeVisible();
  });

  test(
    "out-of-stock products show a badge and a disabled Add button",
    async ({ page }) => {
      const vendor = await getVendorBySlug("corner-sourdough");
      const soldOut = await createTestProduct(vendor.id, {
        name: "Playwright Sold Out Product",
        stockQuantity: 0,
      });

      try {
        await page.goto("/vendors/corner-sourdough");
        await expect(
          page.getByRole("heading", { name: /corner sourdough/i }),
        ).toBeVisible();

        // Out-of-stock products must be visible (not hidden) per AC #1 —
        // the opposite of this test's pre-Story-1.3 premise.
        const productHeading = page.getByRole("heading", {
          name: "Playwright Sold Out Product",
        });
        await expect(productHeading).toBeVisible();

        // Scope to the product's own card so the badge/button assertions
        // can't accidentally match a different row. Two levels up: the
        // heading's immediate parent only wraps the name/description/price/
        // badge column; the Add button is a sibling of that column, both
        // children of the outer card div (ProductCard.tsx's outer
        // flex container).
        const card = productHeading.locator("../..");
        await expect(card.getByText(/out of stock/i)).toBeVisible();
        await expect(card.getByRole("button", { name: "Add" })).toBeDisabled();
      } finally {
        await deleteProduct(soldOut.id);
      }
    },
  );

  test(
    "checkout shows an error when a cart item's stock drops below the cart quantity before submitting",
    async ({ page }) => {
      const vendor = await getVendorBySlug("corner-sourdough");
      // Storefront lists products alphabetically (vendors/[slug]/page.tsx), so
      // "Cinnamon Morning Bun" is the same product the "Add" .first() click
      // above targets.
      const product = vendor.products.find(
        (p) => p.name === "Cinnamon Morning Bun",
      );
      if (!product) throw new Error("Seed data missing 'Cinnamon Morning Bun'");
      const originalStockQuantity = product.stockQuantity;

      try {
        await page.goto("/vendors/corner-sourdough");
        await page.getByRole("button", { name: "Add" }).first().click();
        await page.getByRole("link", { name: /cart/i }).click();
        await expect(page).toHaveURL(/cart/, { timeout: 15_000 });

        await page.getByPlaceholder(/your name/i).fill("Availability Check Customer");
        await page.getByPlaceholder(/mobile number/i).fill("+15005550006");

        // Simulate the last unit selling out (a concurrent order) after it
        // was added to this cart but before this checkout submits.
        await prisma.product.update({
          where: { id: product.id },
          data: { stockQuantity: 0 },
        });

        await page.getByRole("button", { name: /checkout/i }).click();
        // Pinned contract string - Task 5 must produce this exact message.
        await expect(
          page.getByText("One or more items don't have enough stock"),
        ).toBeVisible();
      } finally {
        await prisma.product.update({
          where: { id: product.id },
          data: { stockQuantity: originalStockQuantity },
        });
      }
    },
  );

  test("[P0] removing cart lines recalculates the total and empties the cart", async ({
    page,
  }) => {
    // Red phase: this test doesn't exist yet, so per the ATDD workflow it
    // ships skipped. Unlike a typical red phase, the underlying feature
    // (Story 1.1) is already fully implemented (CartProvider.removeItem /
    // cart/page.tsx) — once this skip is removed during dev-story, the test
    // is expected to go green immediately against the current
    // implementation. A red result after that point means a real
    // regression, not a missing feature (see story Dev Notes: stop and
    // report, don't patch around it).
    const vendor = await getVendorBySlug("corner-sourdough");
    const productA = vendor.products.find(
      (p) => p.name === "Classic Sourdough Loaf",
    );
    const productB = vendor.products.find((p) => p.name === "Seeded Rye");
    if (!productA || !productB) {
      throw new Error(
        "Seed data missing 'Classic Sourdough Loaf' and/or 'Seeded Rye'",
      );
    }

    // Matches src/lib/utils.ts's formatPrice() exactly (Intl.NumberFormat
    // inserts thousands separators formatPrice relies on) rather than a
    // toFixed()-based reimplementation that would silently diverge at
    // totals >= $1,000.
    const dollars = (cents: number) =>
      new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
        cents / 100,
      );

    // Every product card's "Add" button shares the accessible name "Add",
    // so scope each click to the specific card: the div containing both
    // this product's heading and an "Add" button, narrowed to the
    // innermost match via .last() — ancestor wrapper divs also contain the
    // same heading text and *some* "Add" button (just not necessarily this
    // product's), so they'd otherwise stay in the candidate set too.
    const productCard = (name: string) =>
      page
        .locator("div")
        .filter({ has: page.getByRole("heading", { name, exact: true }) })
        .filter({ has: page.getByRole("button", { name: "Add" }) })
        .last();

    // Cart lines render as <li> elements (implicit "listitem" role), so
    // they can be scoped directly by role + text without the same
    // disambiguation dance the storefront cards need.
    const cartLine = (name: string) =>
      page.getByRole("listitem").filter({ hasText: name });

    // "Total" only appears in the cart summary row; .last() narrows to that
    // specific div rather than the page-level wrapper div that also
    // contains it transitively.
    const totalRow = () =>
      page.locator("div").filter({ hasText: "Total" }).last();

    await page.goto("/vendors/corner-sourdough");
    await expect(
      page.getByRole("heading", { name: /corner sourdough/i }),
    ).toBeVisible();

    // productA is added twice (quantity 2) so the total assertion actually
    // exercises priceCents * quantity, not just a sum of unit prices — with
    // every line at quantity 1, a dropped `* quantity` in totalCents would
    // pass unnoticed.
    await productCard(productA.name)
      .getByRole("button", { name: "Add" })
      .click();
    await productCard(productA.name)
      .getByRole("button", { name: "Add" })
      .click();
    await productCard(productB.name)
      .getByRole("button", { name: "Add" })
      .click();

    // /cart's first hit can lose the race against Next.js's on-demand route
    // compile under parallel test load — same reasoning as the extended
    // timeout on the other tests in this file.
    await page.getByRole("link", { name: /cart/i }).click();
    await expect(page).toHaveURL(/cart/, { timeout: 15_000 });

    // AC #1 (setup): both lines present, total is 2x productA's price plus
    // productB's — never hardcoded, so this can't drift from seed data.
    await expect(page.getByText(productA.name)).toBeVisible();
    await expect(page.getByText(productB.name)).toBeVisible();
    await expect(
      totalRow().getByText(
        dollars(2 * productA.priceCents + productB.priceCents),
        { exact: true },
      ),
    ).toBeVisible();

    // AC #1: remove one line via its "remove" button (a <button>, not a
    // link) — it disappears immediately and the total recalculates to the
    // sum of the remaining line only.
    await cartLine(productA.name)
      .getByRole("button", { name: "remove" })
      .click();

    await expect(page.getByText(productA.name)).not.toBeVisible();
    await expect(page.getByText(productB.name)).toBeVisible();
    await expect(
      totalRow().getByText(dollars(productB.priceCents), { exact: true }),
    ).toBeVisible();

    // AC #2: remove the last remaining line — the cart returns to its
    // empty state.
    await cartLine(productB.name)
      .getByRole("button", { name: "remove" })
      .click();

    await expect(page.getByText("Your cart is empty.")).toBeVisible();
  });
});
