import { existsSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";
import { createTestVendor, deleteVendorBySlug, prisma } from "./helpers/db";

/**
 * UI-level coverage for /admin/vendors (Story 2.2, Task 5/6/8) — the admin
 * form that creates a new Vendor row and gives it a live storefront
 * immediately (AC #3), plus the friendly slug-collision error (AC #2).
 *
 * playwright/support/global-setup.ts authenticates the E2E admin via
 * Clerk's Backend API and writes playwright/.auth/admin.json fresh before
 * every test run (Story 2.1), same pattern tests/admin.spec.ts already
 * uses. Skips gracefully if E2E_ADMIN_EMAIL/CLERK_SECRET_KEY aren't
 * configured.
 */
const adminAuthFile = join(process.cwd(), "playwright/.auth/admin.json");

test.describe("admin vendor creation (authenticated as admin)", () => {
  // `storageState` is resolved at browser-context creation, before the
  // beforeEach test.skip(!existsSync(adminAuthFile), ...) guard below ever
  // runs — a missing file throws ENOENT and fails the suite instead of
  // skipping (see the matching comment in tests/admin.spec.ts /
  // tests/dashboard.spec.ts). Passing undefined when the file doesn't exist
  // yet gives an empty/unauthenticated context instead, so the beforeEach
  // guard is what actually decides skip-vs-run.
  test.use({
    storageState: existsSync(adminAuthFile) ? adminAuthFile : undefined,
  });
  // Serial, not parallel — @clerk/testing's dev-browser JWT mechanism has a
  // known issue with multiple simultaneous browser contexts sharing one
  // signed-in session (clerk/javascript#7891), same workaround already
  // applied in tests/admin.spec.ts/tests/dashboard.spec.ts for their own
  // shared sessions.
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    test.skip(
      !existsSync(adminAuthFile),
      "No admin session — E2E_ADMIN_EMAIL/CLERK_SECRET_KEY not configured",
    );
    // Clerk's saved session needs one full page load to become valid
    // against the middleware; without this warm-up, the very first
    // navigation after loading storageState can bounce to /sign-in even
    // with a valid session (see the identical warm-up in
    // tests/dashboard.spec.ts/tests/admin.spec.ts).
    await page.goto("/");
  });

  test(
    "[P1] admin creates a vendor via the form and it gets a live storefront immediately (AC #3)",
    async ({ page }) => {
      const uniqueSuffix = Date.now();
      const vendorName = `Test Vendor ${uniqueSuffix}`;
      const vendorSlug = `test-vendor-${uniqueSuffix}`;

      try {
        await page.goto("/admin/vendors");

        // Scoped to the add-vendor form by its accessible name, mirroring
        // AddProductForm's `aria-label="Add product"` <form> — see the
        // identical scoping rationale in tests/dashboard.spec.ts's
        // "vendor can add a new product" test.
        const form = page.getByRole("form", { name: "Add vendor" });
        await form.getByLabel("Name").fill(vendorName);

        // Slug auto-suggests from the name (Task 6: "auto-suggest via
        // slugify(name) ... until the admin manually edits the slug field
        // themselves"), but this test fills it explicitly so the assertion
        // below doesn't depend on that auto-fill behavior matching exactly.
        await form.getByLabel("Slug").fill(vendorSlug);
        await form.getByLabel("Phone").fill("+15555550199");
        await form.getByLabel("Description").fill("A Playwright fixture vendor.");

        // Network-first: register the response listener before the click
        // that triggers it, same pattern as dashboard.spec.ts's
        // "vendor can add a new product" test.
        const [response] = await Promise.all([
          page.waitForResponse("**/api/admin/vendors"),
          form.getByRole("button", { name: "Save vendor" }).click(),
        ]);
        expect(response.status()).toBe(201);

        // Task 6: on success, show a confirmation with a link to the new
        // storefront (/vendors/{slug}), not just a router.refresh()/reset —
        // gives the admin visible proof of AC #3 without navigating away to
        // check.
        const storefrontLink = page.getByRole("link", {
          name: new RegExp(vendorSlug),
        });
        await expect(storefrontLink).toBeVisible();
        await expect(storefrontLink).toHaveAttribute(
          "href",
          `/vendors/${vendorSlug}`,
        );

        // The real proof of AC #3 — a live storefront, not just a DB row —
        // is navigating to the URL directly and confirming the vendor's
        // name actually renders there.
        await page.goto(`/vendors/${vendorSlug}`);
        await expect(
          page.getByRole("heading", { name: vendorName }),
        ).toBeVisible();
      } finally {
        await deleteVendorBySlug(vendorSlug);
      }
    },
  );

  test(
    "[P2] submitting a slug that collides with an existing vendor shows an inline error and stays on the form (AC #2)",
    async ({ page }) => {
      const uniqueSuffix = Date.now();
      const vendorName = `Collision Test Vendor ${uniqueSuffix}`;

      await page.goto("/admin/vendors");

      const form = page.getByRole("form", { name: "Add vendor" });
      await form.getByLabel("Name").fill(vendorName);
      // "corner-sourdough" is the seeded vendor (prisma/seed.ts) —
      // resolveVendorSlug() must reject this with a friendly error, never a
      // raw Prisma unique-constraint failure (AC #2).
      await form.getByLabel("Slug").fill("corner-sourdough");

      const [response] = await Promise.all([
        page.waitForResponse("**/api/admin/vendors"),
        form.getByRole("button", { name: "Save vendor" }).click(),
      ]);
      // resolveVendorSlug()'s collision case returns 409, distinct from a
      // 400 malformed-request (Task 4/Dev Notes: "a duplicate-identifier
      // conflict, distinct from a 400 malformed-request").
      expect(response.status()).toBe(409);

      await expect(form.getByRole("alert")).toHaveText(/already in use/i);

      // No navigation away from the form — the admin stays put to correct
      // the slug and resubmit.
      await expect(page).toHaveURL(/\/admin\/vendors$/);
      await expect(form).toBeVisible();

      // No duplicate vendor row exists — the seeded vendor's own row is the
      // only "corner-sourdough" in the database (Task 8's read-back
      // discipline, mirrored here for the UI path too).
      // Read-back is intentionally omitted from this UI-level test — it
      // belongs to tests/admin-vendors-api.spec.ts's own "no duplicate row
      // created" assertion (Task 8), which has direct Prisma access via the
      // db helpers; this test only proves the UI-visible behavior (error
      // shown, no navigation).
    },
  );

  test(
    "[P1] admin creates a vendor with a non-default timezone and it persists (Story 7.1, AC #1)",
    async ({ page }) => {
      const uniqueSuffix = Date.now();
      const vendorName = `Test Vendor TZ ${uniqueSuffix}`;
      const vendorSlug = `test-vendor-tz-${uniqueSuffix}`;

      try {
        await page.goto("/admin/vendors");

        const form = page.getByRole("form", { name: "Add vendor" });
        await form.getByLabel("Name").fill(vendorName);
        await form.getByLabel("Slug").fill(vendorSlug);
        await form.getByLabel("Timezone").selectOption("Asia/Tokyo");

        const [response] = await Promise.all([
          page.waitForResponse("**/api/admin/vendors"),
          form.getByRole("button", { name: "Save vendor" }).click(),
        ]);
        expect(response.status()).toBe(201);

        const persisted = await prisma.vendor.findUnique({
          where: { slug: vendorSlug },
        });
        expect(persisted?.timezone).toBe("Asia/Tokyo");
      } finally {
        await deleteVendorBySlug(vendorSlug);
      }
    },
  );

  test(
    "[P1] admin edits an existing vendor's timezone from the vendors list (Story 7.1, AC #3)",
    async ({ page }) => {
      const vendor = await createTestVendor({ timezone: "America/New_York" });

      try {
        await page.goto("/admin/vendors");

        // Timezone renders as plain text with an "Edit" affordance until
        // clicked (code review, Story 7.1: an always-rendered <select> per
        // row added ~21,000 <option> elements to this page) - plain text
        // otherwise. Scoped by vendor.slug (DB-unique, @unique in
        // prisma/schema.prisma), not vendor.name - Vendor.name has no
        // unique constraint, so two same-named vendors would trip a
        // Playwright strict-mode violation if this scoped by name instead
        // (code review finding). The <select> itself is then located via
        // its role within this already-uniquely-scoped row, not by its
        // name-based aria-label, for the same reason.
        const row = page.locator("tr", { hasText: vendor.slug });
        await expect(row.getByText("America/New_York")).toBeVisible();
        await row.getByRole("button", { name: "Edit" }).click();

        const timezoneSelect = row.getByRole("combobox");
        await expect(timezoneSelect).toHaveValue("America/New_York");

        const [response] = await Promise.all([
          page.waitForResponse(`**/api/admin/vendors/${vendor.id}`),
          timezoneSelect.selectOption("Asia/Tokyo"),
        ]);
        expect(response.status()).toBe(200);

        const persisted = await prisma.vendor.findUnique({
          where: { id: vendor.id },
        });
        expect(persisted?.timezone).toBe("Asia/Tokyo");
      } finally {
        await deleteVendorBySlug(vendor.slug);
      }
    },
  );
});
