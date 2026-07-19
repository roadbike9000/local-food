import { test, expect } from "@playwright/test";

// The dashboard is auth-protected. Without a session, all tabs redirect to
// sign-in. Testing the authenticated view requires a Clerk test user/token,
// which is a good next step (see Clerk's testing docs).
test.describe("vendor dashboard", () => {
  test("overview redirects unauthenticated users", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/sign-in/);
  });

  test("products tab redirects unauthenticated users", async ({ page }) => {
    await page.goto("/dashboard/products");
    await expect(page).toHaveURL(/sign-in/);
  });
});
