import { existsSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";

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
});
