import { existsSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";
import {
  getVendorBySlug,
  deleteProductByName,
  deletePickupSlotByLocation,
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

      await page.getByLabel("Name").fill(productName);
      await page.getByLabel("Price (USD)").fill("4.50");

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
});
