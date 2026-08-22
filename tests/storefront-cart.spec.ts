import { test, expect } from "@playwright/test";
import {
  getVendorBySlug,
  createTestProduct,
  deleteProduct,
  createTestVendor,
  deleteVendorBySlug,
  prisma,
} from "./helpers/db";

// Matches src/lib/utils.ts's formatPrice() exactly, same reasoning as the
// P0 test below: avoids a toFixed()-based reimplementation that would
// silently diverge at totals >= $1,000.
const dollars = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );

// Requires seeded data (npm run db:seed). Visits a vendor storefront, adds an
// item, and confirms it appears in the cart.
test.describe("storefront and cart", () => {
  test("can add a product to the cart", async ({ page }) => {
    // Own dedicated fixture rather than a shared seed product — a seed
    // product's stock can be mutated to 0 by another test running
    // concurrently under fullyParallel:true, disabling its Add button out
    // from under this test (review round 2 finding: round 1's fix to
    // target "Cinnamon Morning Bun" by name instead of .first() didn't
    // remove the race, it just made it deterministic against the sibling
    // "checkout shows an error..." test below, which sets that exact
    // product's stock to 0).
    const vendor = await getVendorBySlug("corner-sourdough");
    const product = await createTestProduct(vendor.id, {
      name: "Playwright Add To Cart Product",
    });

    try {
      await page.goto("/vendors/corner-sourdough");
      await expect(
        page.getByRole("heading", { name: /corner sourdough/i }),
      ).toBeVisible();

      const card = page
        .getByRole("heading", { name: product.name, exact: true })
        .locator("../..");
      await card.getByRole("button", { name: "Add" }).click();

      // The cart badge in the navbar should now show at least 1.
      // /cart's first hit can lose the race against Next.js's on-demand route
      // compile under parallel test load (see playwright.config.ts's timeout
      // comment) — same reasoning as the extended timeouts in dashboard.spec.ts.
      await page.getByRole("link", { name: /cart/i }).click();
      await expect(page).toHaveURL(/cart/, { timeout: 15_000 });
      await expect(page.getByText(/total/i)).toBeVisible();
    } finally {
      await deleteProduct(product.id);
    }
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
      // Own dedicated fixture, not the shared seed product — see the
      // comment on "can add a product to the cart" above. Also drops the
      // .first() click round 2 review flagged as an unfixed instance of
      // round 1's finding, and the durability hole of relying on `finally`
      // to restore a shared row's original stock value.
      const vendor = await getVendorBySlug("corner-sourdough");
      const product = await createTestProduct(vendor.id, {
        name: "Playwright Stock Drop Product",
        stockQuantity: 3,
      });

      try {
        await page.goto("/vendors/corner-sourdough");
        const card = page
          .getByRole("heading", { name: product.name, exact: true })
          .locator("../..");
        // Add twice (cart quantity 2), so the sufficiency check below is
        // exercised at a non-zero, non-boundary stock value (0 < stock <
        // quantity) rather than only the stock-is-exactly-0 case — AD-2's
        // sufficiency check is `stockQuantity >= quantity`, not `> 0`, and
        // review round 2 flagged that nothing tested the difference.
        await card.getByRole("button", { name: "Add" }).click();
        await card.getByRole("button", { name: "Add" }).click();
        await page.getByRole("link", { name: /cart/i }).click();
        await expect(page).toHaveURL(/cart/, { timeout: 15_000 });

        await page.getByPlaceholder(/your name/i).fill("Availability Check Customer");
        await page.getByPlaceholder(/mobile number/i).fill("+15005550006");

        // Simulate a concurrent order taking 2 of the 3 units, leaving 1 —
        // enough to still be "in stock" but short of this cart's quantity
        // of 2.
        await prisma.product.update({
          where: { id: product.id },
          data: { stockQuantity: 1 },
        });

        await page.getByRole("button", { name: /checkout/i }).click();
        // Pinned contract string - Task 5 must produce this exact message.
        await expect(
          page.getByText("One or more items don't have enough stock"),
        ).toBeVisible();
      } finally {
        await deleteProduct(product.id);
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

    // data-testid="cart-total" on the total row (src/app/cart/page.tsx) -
    // was a `.last()`-on-substring-match heuristic (deferred-work.md,
    // Story 1.1) that would silently retarget this P0 assertion if a
    // later-in-DOM-order div ever contained the word "Total" too.
    const totalRow = () => page.getByTestId("cart-total");

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

  test("cart stepper increments and decrements quantity, total recalculates (Story 1.5)", async ({
    page,
  }) => {
    // Own dedicated fixture, not shared seed data - same discipline as the
    // other tests in this file (fullyParallel:true, Story 1.3 round-2).
    const vendor = await getVendorBySlug("corner-sourdough");
    const product = await createTestProduct(vendor.id, {
      name: "Playwright Stepper Product",
      stockQuantity: 10,
    });

    try {
      await page.goto("/vendors/corner-sourdough");
      const card = page
        .getByRole("heading", { name: product.name, exact: true })
        .locator("../..");
      await card.getByRole("button", { name: "Add" }).click();

      await page.getByRole("link", { name: /cart/i }).click();
      await expect(page).toHaveURL(/cart/, { timeout: 15_000 });

      const increment = page.getByRole("button", {
        name: `Increase quantity of ${product.name}`,
      });
      const decrement = page.getByRole("button", {
        name: `Decrease quantity of ${product.name}`,
      });
      const quantity = page.locator(
        `[aria-label="Quantity of ${product.name}"]`,
      );
      const lineTotal = page
        .locator("li")
        .filter({ hasText: product.name });
      const totalRow = () => page.getByTestId("cart-total");

      await expect(quantity).toHaveText("1");
      await expect(lineTotal).toContainText(dollars(product.priceCents));

      await increment.click();
      await increment.click();
      await expect(quantity).toHaveText("3");
      await expect(lineTotal).toContainText(dollars(3 * product.priceCents));
      await expect(
        totalRow().getByText(dollars(3 * product.priceCents), { exact: true }),
      ).toBeVisible();

      await decrement.click();
      await expect(quantity).toHaveText("2");
      await expect(lineTotal).toContainText(dollars(2 * product.priceCents));
      await expect(
        totalRow().getByText(dollars(2 * product.priceCents), { exact: true }),
      ).toBeVisible();
    } finally {
      await deleteProduct(product.id);
    }
  });

  test("cart stepper floor: decrement is disabled at quantity 1, never reaches 0 (Story 1.5, AC #2)", async ({
    page,
  }) => {
    const vendor = await getVendorBySlug("corner-sourdough");
    const product = await createTestProduct(vendor.id, {
      name: "Playwright Stepper Floor Product",
      stockQuantity: 10,
    });

    try {
      await page.goto("/vendors/corner-sourdough");
      const card = page
        .getByRole("heading", { name: product.name, exact: true })
        .locator("../..");
      await card.getByRole("button", { name: "Add" }).click();

      await page.getByRole("link", { name: /cart/i }).click();
      await expect(page).toHaveURL(/cart/, { timeout: 15_000 });

      const decrement = page.getByRole("button", {
        name: `Decrease quantity of ${product.name}`,
      });
      const quantity = page.locator(
        `[aria-label="Quantity of ${product.name}"]`,
      );

      await expect(quantity).toHaveText("1");
      await expect(decrement).toBeDisabled();

      // The line must still be present at quantity 1, not removed - the
      // stepper's floor is not a removal path (Story 1.1's "remove" button
      // is the only way to zero out a line).
      await expect(page.getByText(product.name)).toBeVisible();
    } finally {
      await deleteProduct(product.id);
    }
  });

  test("cart stepper ceiling: increment is disabled once quantity reaches the product's stock (Story 1.5, AC #3)", async ({
    page,
  }) => {
    // Low-stock dedicated product so the ceiling is reachable quickly - a
    // high-stock fixture would make this test meaningless, not just slow.
    const vendor = await getVendorBySlug("corner-sourdough");
    const product = await createTestProduct(vendor.id, {
      name: "Playwright Stepper Ceiling Product",
      stockQuantity: 2,
    });

    try {
      await page.goto("/vendors/corner-sourdough");
      const card = page
        .getByRole("heading", { name: product.name, exact: true })
        .locator("../..");
      await card.getByRole("button", { name: "Add" }).click();

      await page.getByRole("link", { name: /cart/i }).click();
      await expect(page).toHaveURL(/cart/, { timeout: 15_000 });

      const increment = page.getByRole("button", {
        name: `Increase quantity of ${product.name}`,
      });
      const quantity = page.locator(
        `[aria-label="Quantity of ${product.name}"]`,
      );

      await expect(quantity).toHaveText("1");
      await increment.click();
      await expect(quantity).toHaveText("2");
      await expect(increment).toBeDisabled();

      // Clicking a disabled button is a no-op - confirms the ceiling isn't
      // just a UI hint that a determined click can bypass.
      await increment.click({ force: true });
      await expect(quantity).toHaveText("2");
    } finally {
      await deleteProduct(product.id);
    }
  });

  test("repeat-clicking Add is capped at the product's stock ceiling, same limit the stepper enforces (Story 1.5, AC #6)", async ({
    page,
  }) => {
    const vendor = await getVendorBySlug("corner-sourdough");
    const product = await createTestProduct(vendor.id, {
      name: "Playwright Add Cap Product",
      stockQuantity: 2,
    });

    try {
      await page.goto("/vendors/corner-sourdough");
      const card = page
        .getByRole("heading", { name: product.name, exact: true })
        .locator("../..");

      await card.getByRole("button", { name: "Add" }).click();
      await card.getByRole("button", { name: "Add" }).click();
      await card.getByRole("button", { name: "Add" }).click();

      await page.getByRole("link", { name: /cart/i }).click();
      await expect(page).toHaveURL(/cart/, { timeout: 15_000 });

      const quantity = page.locator(
        `[aria-label="Quantity of ${product.name}"]`,
      );
      await expect(quantity).toHaveText("2");
    } finally {
      await deleteProduct(product.id);
    }
  });

  test(
    "[P0] a deactivated vendor's storefront shows a \"no longer available\" message instead of listings (Story 2.3, AC #2)",
    async ({ page }) => {
      // Throwaway fixture vendor only - never deactivate corner-sourdough or
      // green-valley-produce; every other test in this suite depends on
      // both staying orderable. This fixture also has zero products/pickup
      // slots by default, which is what makes the "no listing/banner"
      // assertions below meaningful without extra setup.
      const vendor = await createTestVendor({ deletedAt: new Date() });

      try {
        await page.goto(`/vendors/${vendor.slug}`);

        // AC #2 is explicit this is a real 200 with a message, not a 404 -
        // the vendor's name still renders.
        await expect(
          page.getByRole("heading", { name: vendor.name, exact: true }),
        ).toBeVisible();

        // The "no longer available" message replaces the pickup-slot
        // banner and product listing (exact copy per the story's Task 4).
        await expect(
          page.getByText(/this vendor is no longer available/i),
        ).toBeVisible();

        // No product listing (no "Add" buttons) and no pickup-slot banner.
        await expect(page.getByRole("button", { name: "Add" })).toHaveCount(
          0,
        );
        await expect(page.getByText(/next pickup/i)).not.toBeVisible();
      } finally {
        await deleteVendorBySlug(vendor.slug);
      }
    },
  );
});
