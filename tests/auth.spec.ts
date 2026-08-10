import { test, expect } from "@playwright/test";

// Auth flows are handled by Clerk's hosted UI. We verify our routing:
// unauthenticated visitors to /dashboard get redirected to sign-in.
test.describe("auth", () => {
  test("sign-in page renders", async ({ page }) => {
    await page.goto("/sign-in");
    // Clerk renders its own form; assert the URL held rather than the widget
    // internals (which can change between Clerk versions).
    await expect(page).toHaveURL(/sign-in/);
  });

  test("dashboard requires authentication", async ({ page }) => {
    await page.goto("/dashboard");
    // Clerk middleware should bounce us to the sign-in flow.
    await expect(page).toHaveURL(/sign-in/);
  });

  test("sign-up page renders", async ({ page }) => {
    await page.goto("/sign-up");
    // Same shallow "URL held" pattern as the sign-in test — Clerk owns the
    // widget internals.
    await expect(page).toHaveURL(/sign-up/);
  });
});
