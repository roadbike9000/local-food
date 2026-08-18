import { existsSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";
import {
  getVendorBySlug,
  deleteProductByName,
  deletePickupSlotByLocation,
  createTestOrder,
  deleteOrder,
  createTestProduct,
  deleteProduct,
} from "./helpers/db";

// The dashboard is auth-protected. Without a session, all tabs redirect to
// sign-in.
test.describe("vendor dashboard (unauthenticated)", () => {
  test("overview redirects unauthenticated users", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/sign-in/);
  });

  test("products tab redirects unauthenticated users", async ({ page }) => {
    await page.goto("/dashboard/products");
    await expect(page).toHaveURL(/sign-in/);
  });

  test("orders tab redirects unauthenticated users", async ({ page }) => {
    await page.goto("/dashboard/orders");
    await expect(page).toHaveURL(/sign-in/);
  });

  test("pickups tab redirects unauthenticated users", async ({ page }) => {
    await page.goto("/dashboard/pickups");
    await expect(page).toHaveURL(/sign-in/);
  });
});

const authFile = join(process.cwd(), "playwright/.auth/vendor.json");

// Requires playwright/support/generate-vendor-auth.ts to have been run once
// (see that file — it needs a human to read an emailed Clerk verification
// code, so it can't run unattended in CI). Skips gracefully when missing,
// same pattern as payment.spec.ts's Stripe-keys check.
test.describe("vendor dashboard (authenticated)", () => {
  test.use({ storageState: authFile });

  test.beforeEach(async ({ page }) => {
    test.skip(
      !existsSync(authFile),
      "No saved vendor session — run `npm run test:e2e:auth` first",
    );
    // Clerk's saved session needs one full page load to become valid against
    // the middleware; without this warm-up, the very first navigation after
    // loading storageState can bounce to /sign-in even with a valid session.
    await page.goto("/");
  });

  test("vendor sees their own dashboard overview", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText(/welcome back/i)).toBeVisible();
  });

  test("vendor sees their own products, never another vendor's", async ({
    page,
  }) => {
    await page.goto("/dashboard/products");
    await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();

    // Isolation (Critical Don't-Miss Rule): dashboard routes must filter by
    // the signed-in vendor. Green Valley Produce's catalog (seed.ts) must
    // never appear here.
    await expect(page.getByText("Heirloom Tomato Box")).not.toBeVisible();
    await expect(page.getByText("Salad Greens Bag")).not.toBeVisible();
  });

  test("vendor's product API never returns another vendor's products", async ({
    page,
  }) => {
    await page.goto("/dashboard"); // warm-up, and page.request shares this context's cookies
    const response = await page.request.get("/api/products");
    expect(response.status()).toBe(200);

    const { products } = await response.json();
    const names = products.map((p: { name: string }) => p.name);
    expect(names).not.toContain("Heirloom Tomato Box");
    expect(names).not.toContain("Salad Greens Bag");
  });

  test("vendor's pickup-slots API never returns another vendor's slots", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    const response = await page.request.get("/api/pickup-slots");
    expect(response.status()).toBe(200);

    const { slots } = await response.json();
    const locations = slots.map((s: { location: string | null }) => s.location);
    // Green Valley Produce's seeded slot (prisma/seed.ts) must never leak here.
    expect(locations).not.toContain("Farmers Market, Stall 7");
  });

  test("vendor sees their own orders tab", async ({ page }) => {
    await page.goto("/dashboard/orders");
    await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
  });

  test("vendor sees their own orders, never another vendor's", async ({
    page,
  }) => {
    const otherVendor = await getVendorBySlug("green-valley-produce");
    const otherCustomerName = `Isolation Check Customer ${Date.now()}`;
    const order = await createTestOrder(otherVendor.id, {
      customerName: otherCustomerName,
    });

    try {
      await page.goto("/dashboard/orders");
      await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
      await expect(page.getByText(otherCustomerName)).not.toBeVisible();
    } finally {
      await deleteOrder(order.id);
    }
  });

  test("vendor sees their own pickups tab", async ({ page }) => {
    await page.goto("/dashboard/pickups");
    await expect(
      page.getByRole("heading", { name: "Pickup slots" }),
    ).toBeVisible();
    // Seeded slot for Corner Sourdough (prisma/seed.ts).
    await expect(page.getByText("12 Market St")).toBeVisible();
  });

  test("vendor can add a new product", async ({ page }) => {
    const vendor = await getVendorBySlug("corner-sourdough");
    const productName = `Playwright Product ${Date.now()}`;

    try {
      await page.goto("/dashboard/products");
      await page.getByRole("button", { name: "Add product" }).click();

      // Scoped to the add-product <form> — EditStockControl's per-row
      // inputs (also labeled "Stock Quantity"/"Low-Stock Threshold") live
      // in table cells, not inside this form, but an unscoped getByLabel
      // would match every row plus the form and hit Playwright's
      // strict-mode ambiguity.
      const form = page.locator("form");
      await form.getByLabel("Name").fill(productName);
      await form.getByLabel("Price (USD)").fill("4.50");
      await form.getByLabel("Stock Quantity", { exact: true }).fill("25");
      await form.getByLabel("Low-Stock Threshold").fill("5");

      // Network-first: register the response listener before the click that
      // triggers it, then wait on the create request itself. A second,
      // unawaited round trip follows (the form's router.refresh() re-fetching
      // the server component), so the final assertion still needs a longer
      // timeout than the default under parallel test-run load.
      await Promise.all([
        page.waitForResponse("**/api/products"),
        page.getByRole("button", { name: "Save product" }).click(),
      ]);

      await expect(page.getByText(productName)).toBeVisible({ timeout: 15_000 });
    } finally {
      await deleteProductByName(vendor.id, productName);
    }
  });

  test("vendor can add a new pickup slot", async ({ page }) => {
    const vendor = await getVendorBySlug("corner-sourdough");
    const location = `Playwright Dock ${Date.now()}`;

    try {
      await page.goto("/dashboard/pickups");
      await page.getByRole("button", { name: "Add slot" }).click();

      const starts = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const ends = new Date(starts.getTime() + 60 * 60 * 1000);
      const toLocal = (d: Date) => d.toISOString().slice(0, 16);

      await page.locator("#startsAt").fill(toLocal(starts));
      await page.locator("#endsAt").fill(toLocal(ends));
      await page.getByLabel("Location").fill(location);

      // Network-first (see the analogous product-creation test above, same
      // reasoning for the longer timeout on the final assertion).
      await Promise.all([
        page.waitForResponse("**/api/pickup-slots"),
        page.getByRole("button", { name: "Save slot" }).click(),
      ]);

      await expect(page.getByText(location)).toBeVisible({ timeout: 15_000 });
    } finally {
      await deletePickupSlotByLocation(vendor.id, location);
    }
  });

  test("add-slot form shows a validation error when the end time is before the start time", async ({
    page,
  }) => {
    await page.goto("/dashboard/pickups");
    await page.getByRole("button", { name: "Add slot" }).click();

    // endsAt <= startsAt has no native HTML constraint on datetime-local
    // inputs, so this is a real client-side validation branch (unlike
    // AddProductForm's price check, which native `min`/`required` already
    // blocks before the JS handler ever runs).
    const starts = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const ends = new Date(starts.getTime() - 60 * 60 * 1000); // 1h before starts
    const toLocal = (d: Date) => d.toISOString().slice(0, 16);

    await page.locator("#startsAt").fill(toLocal(starts));
    await page.locator("#endsAt").fill(toLocal(ends));
    await page.getByRole("button", { name: "Save slot" }).click();

    await expect(
      page.getByText("End time must be after start time."),
    ).toBeVisible();
    // The form never submitted, so it's still showing "Save slot", not
    // "Saving…" — confirms the client-side guard short-circuited before the
    // network call.
    await expect(
      page.getByRole("button", { name: "Save slot" }),
    ).toBeVisible();
  });

  test("add-product form shows an error when the session has expired", async ({
    page,
  }) => {
    // AddProductForm's own client-side price guard is unreachable through
    // real UI interaction (the input's native `required`/`min="0.01"`
    // constraints already block submission for any value that would trip
    // it), so the 401 branch is the meaningful, reachable error-state path
    // for this form — and a realistic one (session expiring mid-form-fill).
    await page.route("**/api/products", (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ error: "Unauthorized" }),
        });
      }
      return route.continue();
    });

    await page.goto("/dashboard/products");
    await page.getByRole("button", { name: "Add product" }).click();
    // Scoped to the add-product <form> - see the identical comment on the
    // "vendor can add a new product" test above.
    const form = page.locator("form");
    await form.getByLabel("Name").fill("Session Expiry Check");
    await form.getByLabel("Price (USD)").fill("4.50");
    await form.getByLabel("Stock Quantity", { exact: true }).fill("25");
    await form.getByLabel("Low-Stock Threshold").fill("5");
    await page.getByRole("button", { name: "Save product" }).click();

    await expect(
      page.getByText("Your session expired. Sign in again."),
    ).toBeVisible();
  });

  test("[P1] vendor can edit an existing product's Stock Quantity via the inline control", async ({
    page,
  }) => {
    const vendor = await getVendorBySlug("corner-sourdough");
    const productName = `Playwright Stock Edit ${Date.now()}`;

    // A dedicated fixture product, not a shared seeded one — seeded products
    // (prisma/seed.ts) are shared across parallel tests, and mutating a
    // shared product's stock here would pollute other tests running
    // concurrently.
    const product = await createTestProduct(vendor.id, {
      name: productName,
      stockQuantity: 20,
      lowStockThreshold: 5,
    });

    try {
      await page.goto("/dashboard/products");
      await expect(
        page.getByRole("heading", { name: "Products" }),
      ).toBeVisible();

      // Scope to the fixture product's row so this doesn't collide with
      // other rows/parallel test data on the same page.
      const row = page.getByRole("row", { name: new RegExp(productName) });
      await expect(row).toBeVisible();

      const stockInput = row.getByRole("spinbutton", {
        name: /stock quantity/i,
      });
      await expect(stockInput).toHaveValue("20");

      await stockInput.fill("35");

      // Network-first: register the response listener before the click that
      // triggers the PATCH, same pattern as "vendor can add a new product".
      await Promise.all([
        page.waitForResponse(`**/api/products/${product.id}`),
        row.getByRole("button", { name: "Save" }).click(),
      ]);

      // EditStockControl calls router.refresh() on success (per Dev Notes,
      // mirrors AddProductForm's shape) — re-fetches the server component,
      // so the same extended timeout as the analogous add-product assertion
      // applies here.
      await expect(stockInput).toHaveValue("35", { timeout: 15_000 });
    } finally {
      await deleteProduct(product.id);
    }
  });
});
