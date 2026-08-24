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
  prisma,
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

// playwright/support/global-setup.ts authenticates the E2E vendor via
// Clerk's Backend API and writes this file fresh before every test run — no
// human, no email code, can't go stale between runs. Still skips gracefully
// if E2E_VENDOR_EMAIL/CLERK_SECRET_KEY aren't configured (global setup warns
// and skips writing the file rather than failing the whole suite), same
// pattern as payment.spec.ts's Stripe-keys check.
test.describe("vendor dashboard (authenticated)", () => {
  // `storageState` is resolved at browser-context creation, before the
  // beforeEach test.skip(!existsSync(authFile), ...) guard below ever runs -
  // a missing file throws ENOENT and fails the suite instead of skipping
  // (confirmed via repro, Story 2.1 review). Passing undefined when the
  // file doesn't exist yet gives an empty/unauthenticated context instead,
  // so the beforeEach guard is what actually decides skip-vs-run.
  test.use({ storageState: existsSync(authFile) ? authFile : undefined });
  // Serial, not parallel - @clerk/testing's dev-browser JWT mechanism
  // (used by playwright/support/global-setup.ts's Backend-API sign-in)
  // has a known issue with multiple simultaneous browser contexts sharing
  // one signed-in session (clerk/javascript#7891) - manifests here as
  // intermittent 401s under full-suite parallel load. Serializing this
  // file's own tests (and products-api.spec.ts's) caps how many
  // authenticated contexts can be open against Clerk at once.
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    test.skip(
      !existsSync(authFile),
      "No vendor session — E2E_VENDOR_EMAIL/CLERK_SECRET_KEY not configured",
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

      // Scoped to the add-product form by its accessible name —
      // EditStockControl's per-row inputs (also labeled "Stock
      // Quantity"/"Low-Stock Threshold") live in table cells, not inside
      // this form, but an unscoped getByLabel would match every row plus
      // the form and hit Playwright's strict-mode ambiguity. Anchoring by
      // role/name (rather than the bare "form" tag) survives a second
      // <form> being added to the page later.
      const form = page.getByRole("form", { name: "Add product" });
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

      // getByRole("cell", ...), not getByText - EditStockControl's
      // accessibility fix (Story 1.2 round 2) added a sr-only "for
      // {productName}" span in the same row, which getByText's substring
      // match also matches once this test actually runs (previously masked
      // since it never ran at all - blocked by the stale auth fixture).
      await expect(
        page.getByRole("cell", { name: productName, exact: true }),
      ).toBeVisible({ timeout: 15_000 });
    } finally {
      await deleteProductByName(vendor.id, productName);
    }
  });

  // ATDD scaffolds, Story 4.1 — AddProductForm has no image input yet
  // (Task 3), so `form.getByLabel("Image")` doesn't resolve to anything
  // until then.
  test.skip(
    "[P1] vendor uploads a product image and it's saved to the new product (Story 4.1)",
    async ({ page }) => {
      const vendor = await getVendorBySlug("corner-sourdough");
      const productName = `Playwright Image Product ${Date.now()}`;

      try {
        await page.goto("/dashboard/products");
        await page.getByRole("button", { name: "Add product" }).click();

        const form = page.getByRole("form", { name: "Add product" });
        await form.getByLabel("Name").fill(productName);
        await form.getByLabel("Price (USD)").fill("4.50");
        await form.getByLabel("Stock Quantity", { exact: true }).fill("25");
        await form.getByLabel("Low-Stock Threshold").fill("5");
        await form
          .getByLabel("Image")
          .setInputFiles("tests/fixtures/test-product-image.png");

        await Promise.all([
          page.waitForResponse("**/api/products"),
          page.getByRole("button", { name: "Save product" }).click(),
        ]);

        await expect(
          page.getByRole("cell", { name: productName, exact: true }),
        ).toBeVisible({ timeout: 15_000 });

        // Story 4.1 owns the data getting saved correctly, not visual
        // rendering (Story 4.2's scope) - verify via the DB, not the DOM.
        const created = await prisma.product.findFirst({
          where: { vendorId: vendor.id, name: productName },
        });
        expect(created?.imageUrl).toMatch(/^https:\/\/res\.cloudinary\.com\//);
      } finally {
        await deleteProductByName(vendor.id, productName);
      }
    },
  );

  test.skip(
    "[P1] selecting an oversized image shows an inline error and creates no product (Story 4.1)",
    async ({ page }) => {
      await page.goto("/dashboard/products");
      await page.getByRole("button", { name: "Add product" }).click();

      const form = page.getByRole("form", { name: "Add product" });
      await form.getByLabel("Name").fill("Oversized Image Reject Test");
      await form.getByLabel("Price (USD)").fill("4.50");
      await form.getByLabel("Stock Quantity", { exact: true }).fill("25");
      await form.getByLabel("Low-Stock Threshold").fill("5");

      // A buffer over the 3MB client-side cap (Dev Notes, Story 4.1) -
      // built in-memory, no fixture file needed for this size-only case.
      await form.getByLabel("Image").setInputFiles({
        name: "oversized.png",
        mimeType: "image/png",
        buffer: Buffer.alloc(3 * 1024 * 1024 + 1),
      });

      await expect(page.getByText(/too large/i)).toBeVisible();
    },
  );

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
    // Scoped to the add-product form by its accessible name - see the
    // identical comment on the "vendor can add a new product" test above.
    const form = page.getByRole("form", { name: "Add product" });
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
      const [response] = await Promise.all([
        page.waitForResponse(`**/api/products/${product.id}`),
        row.getByRole("button", { name: "Save" }).click(),
      ]);
      // This is the assertion the old version of this test lacked: without
      // it, the test goes green even if the PATCH failed (409/500), because
      // the input's value is React state that a router.refresh() alone
      // doesn't roll back.
      expect(response.status()).toBe(200);

      // A hard reload, not another router.refresh() - proves the value was
      // actually persisted server-side, not just held in client state.
      await page.reload();
      await expect(
        row.getByRole("spinbutton", { name: /stock quantity/i }),
      ).toHaveValue("35", { timeout: 15_000 });

      // Direct DB read-back - the strongest form of "this actually
      // persisted", independent of anything the UI renders.
      const persisted = await prisma.product.findUnique({
        where: { id: product.id },
      });
      expect(persisted?.stockQuantity).toBe(35);
    } finally {
      await deleteProduct(product.id);
    }
  });

  test("[P1] a placeholder Stock Quantity or Low-Stock Threshold shows a 'Needs review' badge on its row, with field-specific detail (Story 1.6)", async ({
    page,
  }) => {
    const vendor = await getVendorBySlug("corner-sourdough");
    const stockFlaggedName = `Playwright Stock Placeholder ${Date.now()}`;
    const thresholdFlaggedName = `Playwright Threshold Placeholder ${Date.now()}`;
    const bothFlaggedName = `Playwright Both Placeholder ${Date.now()}`;
    const cleanName = `Playwright No Placeholder ${Date.now()}`;

    // Four dedicated fixtures covering every branch of placeholderReason()
    // (review round 1 finding: the original test only ever exercised the
    // stock-only branch) - proves the badge is conditional on either flag,
    // and that its title text differentiates which field(s) are flagged.
    const stockFlagged = await createTestProduct(vendor.id, {
      name: stockFlaggedName,
      stockIsPlaceholder: true,
    });
    const thresholdFlagged = await createTestProduct(vendor.id, {
      name: thresholdFlaggedName,
      thresholdIsPlaceholder: true,
    });
    const bothFlagged = await createTestProduct(vendor.id, {
      name: bothFlaggedName,
      stockIsPlaceholder: true,
      thresholdIsPlaceholder: true,
    });
    const clean = await createTestProduct(vendor.id, {
      name: cleanName,
    });

    try {
      await page.goto("/dashboard/products");
      await expect(
        page.getByRole("heading", { name: "Products" }),
      ).toBeVisible();

      const stockRow = page.getByRole("row", { name: new RegExp(stockFlaggedName) });
      const thresholdRow = page.getByRole("row", { name: new RegExp(thresholdFlaggedName) });
      const bothRow = page.getByRole("row", { name: new RegExp(bothFlaggedName) });
      const cleanRow = page.getByRole("row", { name: new RegExp(cleanName) });

      await expect(cleanRow.getByText("Needs review")).not.toBeVisible();

      await expect(stockRow.getByText("Needs review")).toHaveAttribute(
        "title",
        "Stock Quantity is still a migration placeholder — update it.",
      );
      await expect(thresholdRow.getByText("Needs review")).toHaveAttribute(
        "title",
        "Low-Stock Threshold is still a migration placeholder — update it.",
      );
      await expect(bothRow.getByText("Needs review")).toHaveAttribute(
        "title",
        "Stock Quantity and Low-Stock Threshold are still migration placeholders — update both.",
      );
    } finally {
      await deleteProduct(stockFlagged.id);
      await deleteProduct(thresholdFlagged.id);
      await deleteProduct(bothFlagged.id);
      await deleteProduct(clean.id);
    }
  });

  test("[P1] the badge disappears once the flagged field is edited via the existing inline control (Story 1.6, AC #2)", async ({
    page,
  }) => {
    const vendor = await getVendorBySlug("corner-sourdough");
    const productName = `Playwright Placeholder Clear ${Date.now()}`;

    const product = await createTestProduct(vendor.id, {
      name: productName,
      stockQuantity: 20,
      stockIsPlaceholder: true,
    });

    try {
      await page.goto("/dashboard/products");
      const row = page.getByRole("row", { name: new RegExp(productName) });
      await expect(row).toBeVisible();
      await expect(row.getByText("Needs review")).toBeVisible();

      const stockInput = row.getByRole("spinbutton", {
        name: /stock quantity/i,
      });
      await stockInput.fill("35");

      const [response] = await Promise.all([
        page.waitForResponse(`**/api/products/${product.id}`),
        row.getByRole("button", { name: "Save" }).click(),
      ]);
      expect(response.status()).toBe(200);

      // Assert the badge is already gone from a live re-render, before any
      // reload (review round 1 finding: the original version of this test
      // only checked post-reload state, which would still pass even if
      // EditStockControl's existing router.refresh() call - confirmed
      // present at EditStockControl.tsx:96 - were silently broken). Story
      // 1.2's setStock() already clears stockIsPlaceholder server-side on a
      // genuine value change; this assertion proves the badge actually
      // reacts to that live, not just after a hard refresh.
      await expect(row.getByText("Needs review")).not.toBeVisible({
        timeout: 15_000,
      });

      // A hard reload is still worth proving too - confirms the persisted
      // state, not just client-side React state that a refresh alone
      // wouldn't roll back.
      await page.reload();
      await expect(row.getByText("Needs review")).not.toBeVisible({
        timeout: 15_000,
      });

      const persisted = await prisma.product.findUnique({
        where: { id: product.id },
      });
      expect(persisted?.stockIsPlaceholder).toBe(false);
    } finally {
      await deleteProduct(product.id);
    }
  });

  test("[P1] 'Confirm as-is' clears the badge without changing the flagged value (deferred-work.md, Story 1.2)", async ({
    page,
  }) => {
    const vendor = await getVendorBySlug("corner-sourdough");
    const productName = `Playwright Confirm As-Is ${Date.now()}`;

    // A vendor who deliberately wants the placeholder value itself (here,
    // stockQuantity genuinely is 100) previously had no single-save way to
    // clear the badge - Save only clears it on a real value change.
    const product = await createTestProduct(vendor.id, {
      name: productName,
      stockQuantity: 100,
      stockIsPlaceholder: true,
    });

    try {
      await page.goto("/dashboard/products");
      const row = page.getByRole("row", { name: new RegExp(productName) });
      await expect(row).toBeVisible();
      await expect(row.getByText("Needs review")).toBeVisible();

      // Deliberately not touching the stock input - proving the flag clears
      // even though the posted value is unchanged from what's stored.
      // Matched by its aria-label prefix, not the visible "Confirm as-is"
      // text - that text is also a substring of the Save button's own
      // aria-label once it's suffixed with this test's product name
      // ("...for Playwright Confirm As-Is ...", case-insensitive), which
      // would otherwise make this locator ambiguous.
      const [response] = await Promise.all([
        page.waitForResponse(`**/api/products/${product.id}`),
        row.getByRole("button", { name: /^Confirm the values shown/i }).click(),
      ]);
      expect(response.status()).toBe(200);

      await expect(row.getByText("Needs review")).not.toBeVisible({
        timeout: 15_000,
      });

      const persisted = await prisma.product.findUnique({
        where: { id: product.id },
      });
      expect(persisted?.stockQuantity).toBe(100); // value itself untouched
      expect(persisted?.stockIsPlaceholder).toBe(false);
    } finally {
      await deleteProduct(product.id);
    }
  });
});
