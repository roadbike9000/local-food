---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-08-25'
storyId: '5.1'
storyKey: '5-1-customer-selects-a-pickup-slot-at-checkout'
storyFile: '_bmad-output/implementation-artifacts/5-1-customer-selects-a-pickup-slot-at-checkout.md'
atddChecklistPath: '_bmad-output/test-artifacts/atdd-checklist-5-1-customer-selects-a-pickup-slot-at-checkout.md'
generatedTestFiles:
  - 'src/app/api/checkout/schema.test.ts'
  - 'tests/checkout-api.spec.ts'
  - 'tests/storefront-cart.spec.ts'
  - 'tests/helpers/db.ts'
inputDocuments:
  - '_bmad-output/implementation-artifacts/5-1-customer-selects-a-pickup-slot-at-checkout.md'
  - 'src/app/cart/page.tsx'
  - 'src/components/CartProvider.tsx'
  - 'src/app/api/checkout/route.ts'
  - 'src/app/api/checkout/schema.ts'
  - 'src/app/api/checkout/schema.test.ts'
  - 'tests/checkout-api.spec.ts'
  - 'tests/storefront-cart.spec.ts'
  - 'tests/helpers/db.ts'
  - 'prisma/schema.prisma'
  - 'src/lib/utils.ts'
  - 'src/app/vendors/[slug]/page.tsx'
  - 'playwright.config.ts'
  - 'vitest.config.mts'
  - 'package.json'
  - 'project-context.md'
---

# ATDD Checklist: Story 5.1 — Customer selects a pickup slot at checkout

## Step 1: Preflight & Context

- **Detected stack:** frontend (Next.js App Router, Playwright configured; no backend-only manifest) — same detection as every prior story in this project.
- **Framework:** Playwright for the new route + UI, Vitest for the `CheckoutSchema` addition — mirrors Story 4.1's split (schema unit test + Playwright integration).
- **Prerequisites met:** story has 5 clear ACs, `ready-for-dev`; `playwright.config.ts` and `vitest.config.mts` both configured; dev environment available.
- **Playwright Utils:** `tea_use_playwright_utils: true` in config, but no `playwright-utils`-family package in `package.json` (confirmed via grep) — same gap as every prior story. Using this repo's own plain-`@playwright/test` patterns.
- **Real prior art found and reused, not rebuilt:**
  - `formatPickupWindow()` (`src/lib/utils.ts`) already exists and is already used by `vendors/[slug]/page.tsx`'s "Next pickup" banner — the picker reuses it, no new date formatting.
  - `tests/helpers/db.ts` confirmed read in full: `getVendorBySlug()` only does `include: { products: true }` today (no `pickupSlots`), and `deletePickupSlotByLocation()` exists but no `createTestPickupSlot()` creation helper — matches the story's own Task 4 findings exactly.
  - `tests/checkout-api.spec.ts` confirmed read in full: exactly 5 existing tests, none send `pickupSlotId` — every one breaks at Zod validation the moment `CheckoutSchema` makes it required. This is the single biggest regression-risk surface in this story.
- **Scope corrections carried from the story file:**
  - No `/checkout` route exists — `/cart` (`src/app/cart/page.tsx`) is the checkout page; confirmed by reading the file in full (single client component, no server data fetching).
  - `selectedSlotId` stays local `useState` in `cart/page.tsx`, not added to `CartProvider.tsx` — confirmed `CartProvider.tsx`'s context shape in full, no slot-related field exists or should be added.
  - Capacity enforcement (`PickupSlot.capacity`) is explicitly out of scope — AC #2 only requires vendor-match + existence.
- **Previous stories' learnings applied:**
  - No mocking of Stripe/Clerk/Twilio — the new public route and picker use real dev-mode Prisma queries, matching every existing spec.
  - Throwaway vendor/product/slot fixtures only for negative-path and multi-slot tests — never mutate `corner-sourdough`/`green-valley-produce`, every other test in the suite depends on both staying orderable with their single seeded slot (the basis for AC #5's auto-select).
  - `tests/payment.spec.ts` and `tests/sms.spec.ts` are explicitly **not** touched — both exercise `corner-sourdough` (one seeded slot), so AC #5's auto-select should keep both green unmodified; a failure there post-implementation is a signal to fix auto-select, not the tests.
- **Execution mode:** sequential, no subagent dispatch — scope matches Story 4.2/prior small-to-medium stories (one new route, one schema field, one page's new local state, one new test helper).

## Step 2: Generation Mode

**Mode: AI Generation.** ACs are clear, scenarios are standard (required-field validation, cross-entity ownership check, conditional UI states, auto-select). No recording — `tea_browser_automation` resolves to `none` in this environment, same as every prior story.

## Step 3: Test Strategy

AC to scenario mapping:

| AC | Scenario | Test Level | Priority |
| --- | --- | --- | --- |
| 1 | `pickupSlotId` is required — checkout is rejected (schema-level) without one | Unit (Vitest) | P0 |
| 1 | 2+ slots: `Checkout` stays disabled until a slot is picked | E2E (UI) | P1 |
| 2 | A `pickupSlotId` belonging to a different vendor than the cart is rejected (400, distinct "no longer available" message) | E2E (API) | P0 |
| 2 | A non-existent `pickupSlotId` is rejected the same way | E2E (API) | P1 |
| 3 | A valid `pickupSlotId` for the cart's own vendor succeeds and `Order.pickupSlotId` is set to it (verified via DB) | E2E (API) | P0 |
| 4 | A vendor with zero upcoming pickup slots shows "no pickup times available" and `Checkout` never enables | E2E (UI) | P1 |
| 5 | A vendor with exactly one upcoming slot auto-selects it, no picker interaction required | E2E (UI) | P1 |

**Not automated at this level:**
- `GET /api/vendors/[vendorId]/pickup-slots`'s own empty-array-for-unknown-vendor shape — covered indirectly by the AC #4 UI test (a vendor with zero slots and the "unknown vendor" case return the identical `{ slots: [] }` shape per the story's own Task 1 note), not a separate isolated route test.
- `PickupSlot.capacity` enforcement — explicitly out of scope per Dev Notes.
- Exact picker markup (radio vs `<select>`) — dev's implementation choice; tests assert behavior (selection required, disabled state) via role/label, not a specific control type.

**Red phase independently executed, not just reasoned about:**
- `npx vitest run` (full suite): 90 passed, 1 failed — exactly the new `"rejects a missing pickupSlotId"` case, failing because `CheckoutSchema.safeParse` currently accepts the body without it. No other test affected.
- `npx playwright test tests/checkout-api.spec.ts -g "Story 5.1"`: all 3 new cases failed — the two rejection tests got `200` instead of `400` (route ignores `pickupSlotId` entirely today), the success test found `order.pickupSlotId === null` instead of the seeded slot's id. Two of these runs create a real PENDING order + Stripe session as a side effect of the route's current (pre-Task-2) behavior — cleaned up manually after verification (`prisma.order`/`orderItem` deleteMany by phone number); `dev-story` will see the same side effect on its own first red run and should clean up the same way before re-running.
- `npx playwright test tests/storefront-cart.spec.ts -g "Story 5.1"`: both new cases failed fast (5s, not the 45s suite timeout) — `Checkout` button resolves `enabled` (no `selectedSlotId` gating exists), and `getByText(/no pickup times available/i)` finds nothing (message doesn't exist yet). Confirmed via `--trace=on` that the page state itself was correct (cart had the item, name/phone filled) before the assertions ran — the failures are the feature gap, not a broken test.
- `npx tsc --noEmit`: clean throughout.
- `npx playwright test ... --list`: all 5 new E2E cases listed correctly (22 total tests across both files, up from 17).

## Step 4: Red-Phase Test Generation

TDD Red Phase Validation: **PASS** — all new tests were actually applied to the real test files (not left as checklist-only drafts) and independently executed against a running dev server + seeded DB. Every one failed for the right reason (feature absent), confirmed below — not a false pass, not a broken-test false failure.

- **Unit test (Vitest):** 1 new case appended to `src/app/api/checkout/schema.test.ts` (`validBody` also gained a `pickupSlotId` field, harmless pre-implementation since Zod strips unrecognized keys by default — same pattern as the file's own existing `totalCents`-stripping test).
- **E2E tests (Playwright):** 5 new cases — 3 appended to `tests/checkout-api.spec.ts` (API-level: cross-vendor rejection, non-existent-slot rejection, valid-slot success writing `Order.pickupSlotId`; the first two reuse each seeded vendor's own `pickupSlots[0]` via `getVendorBySlug`'s new include, no extra fixture needed), 2 new appended to `tests/storefront-cart.spec.ts` (UI-level: multi-slot picker gating, zero-slot blocked message; auto-select is implicitly covered by the existing untouched `payment.spec.ts`/`sms.spec.ts` happy paths, so not duplicated here as a new scaffold).
- **Test helper changes (not themselves tests), applied now since additive/backward-compatible:**
  - `tests/helpers/db.ts`: `getVendorBySlug()` extended to `include: { products: true, pickupSlots: true }`. New `createTestPickupSlot(vendorId, overrides)` helper (`startsAt`/`endsAt`/`capacity`/`location` overrides, `startsAt` defaulting to "tomorrow" matching seed data's own pattern).
  - Verified: `npx tsc --noEmit` stays clean after these two helper changes alone; no existing call site of `getVendorBySlug()` breaks (all destructure `products`/other fields, none assumed the include shape was exhaustive).

**Bug found and fixed during red-phase verification, not just narrated:** the first draft of both new `storefront-cart.spec.ts` tests navigated to the cart with `page.goto("/cart")` (a full page load). `CartProvider`'s cart is in-memory React state only — a full navigation resets it, so both tests failed on "Your cart is empty" instead of exercising the pickup-slot UI at all (a false-red, wrong-reason failure, not a real one). Fixed by switching to the same client-side `page.getByRole("link", { name: /cart/i }).click()` pattern the file's own pre-existing "can add a product to the cart" test already uses. Re-run after the fix produced true, fast (5s) red failures — see below.

Actual applied test bodies:

```ts
// src/app/api/checkout/schema.test.ts — new case (validBody itself gained pickupSlotId: "slot_1")
it("rejects a missing pickupSlotId", () => {
  const { pickupSlotId: _pickupSlotId, ...withoutSlot } = validBody;
  expect(CheckoutSchema.safeParse(withoutSlot).success).toBe(false);
});
```

```ts
// tests/checkout-api.spec.ts — 3 new cases, describe block extended
test(
  "rejects a pickupSlotId belonging to a different vendor (400) — Story 5.1, AC #2",
  async ({ request }) => {
    const vendor = await getVendorBySlug("corner-sourdough");
    const otherVendor = await getVendorBySlug("green-valley-produce");
    const product = vendor.products.find((p) => p.stockQuantity >= 1);
    if (!product) throw new Error("Seed data missing a product with stock");
    const otherSlot = otherVendor.pickupSlots[0];

    const response = await request.post("/api/checkout", {
      data: {
        vendorId: vendor.id,
        pickupSlotId: otherSlot.id,
        customerName: "Playwright Wrong-Vendor Slot Check",
        customerPhone: "+15005550095",
        items: [{ productId: product.id, quantity: 1 }],
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/no longer available/i);
  },
);

test(
  "rejects a non-existent pickupSlotId (400) — Story 5.1, AC #2",
  async ({ request }) => {
    const vendor = await getVendorBySlug("corner-sourdough");
    const product = vendor.products.find((p) => p.stockQuantity >= 1);
    if (!product) throw new Error("Seed data missing a product with stock");

    const response = await request.post("/api/checkout", {
      data: {
        vendorId: vendor.id,
        pickupSlotId: "nonexistent-slot-id",
        customerName: "Playwright Missing Slot Check",
        customerPhone: "+15005550094",
        items: [{ productId: product.id, quantity: 1 }],
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/no longer available/i);
  },
);

test(
  "a valid pickupSlotId for the cart's own vendor succeeds and sets Order.pickupSlotId — Story 5.1, AC #3",
  async ({ request }) => {
    const vendor = await getVendorBySlug("corner-sourdough");
    const product = vendor.products.find((p) => p.stockQuantity >= 1);
    if (!product) throw new Error("Seed data missing a product with stock");
    const slot = vendor.pickupSlots[0];
    const customerPhone = `+1500555${Date.now() % 10000}`.padEnd(12, "0");

    const response = await request.post("/api/checkout", {
      data: {
        vendorId: vendor.id,
        pickupSlotId: slot.id,
        customerName: "Playwright Valid Slot Check",
        customerPhone,
        items: [{ productId: product.id, quantity: 1 }],
      },
    });

    test.skip(response.status() === 500, "Stripe test keys not configured; skipping");
    expect(response.status()).toBe(200);

    const order = await prisma.order.findFirst({
      where: { vendorId: vendor.id, customerPhone },
      orderBy: { createdAt: "desc" },
    });
    try {
      expect(order?.pickupSlotId).toBe(slot.id);
    } finally {
      if (order) await deleteOrder(order.id);
    }
  },
);
```

```ts
// tests/storefront-cart.spec.ts — 2 new cases, new describe block "pickup slot selection at checkout (Story 5.1)"
test(
  "[P1] 2+ upcoming slots: Checkout stays disabled until one is picked, then enables",
  async ({ page }) => {
    const vendor = await createTestVendor();
    const product = await createTestProduct(vendor.id);
    const slotA = await createTestPickupSlot(vendor.id, { location: "Market A" });
    const slotB = await createTestPickupSlot(vendor.id, { location: "Market B" });

    try {
      await page.goto(`/vendors/${vendor.slug}`);
      await page.getByRole("button", { name: "Add" }).click();
      // Client-side Link navigation, not page.goto("/cart") - the cart
      // lives in an in-memory React context (CartProvider), a full page
      // load would silently drop the item just added.
      await page.getByRole("link", { name: /cart/i }).click();
      await expect(page).toHaveURL(/cart/, { timeout: 15_000 });
      await page.getByPlaceholder("Your name").fill("Playwright Slot Picker");
      await page
        .getByPlaceholder("Mobile number (for pickup texts)")
        .fill("+15005550093");

      const checkoutButton = page.getByRole("button", { name: /checkout/i });
      await expect(checkoutButton).toBeDisabled();

      await page.getByRole("radio", { name: new RegExp(slotA.location!) }).check();
      await expect(checkoutButton).toBeEnabled();
    } finally {
      await deleteProduct(product.id);
      await deletePickupSlotByLocation(vendor.id, "Market A");
      await deletePickupSlotByLocation(vendor.id, "Market B");
      await deleteVendorBySlug(vendor.slug);
    }
  },
);

test(
  "[P1] zero upcoming slots: shows 'no pickup times available' and Checkout never enables",
  async ({ page }) => {
    const vendor = await createTestVendor();
    const product = await createTestProduct(vendor.id);

    try {
      await page.goto(`/vendors/${vendor.slug}`);
      await page.getByRole("button", { name: "Add" }).click();
      await page.getByRole("link", { name: /cart/i }).click();
      await expect(page).toHaveURL(/cart/, { timeout: 15_000 });
      await page.getByPlaceholder("Your name").fill("Playwright No Slots");
      await page
        .getByPlaceholder("Mobile number (for pickup texts)")
        .fill("+15005550092");

      await expect(page.getByText(/no pickup times available/i)).toBeVisible();
      await expect(page.getByRole("button", { name: /checkout/i })).toBeDisabled();
    } finally {
      await deleteProduct(product.id);
      await deleteVendorBySlug(vendor.slug);
    }
  },
);
```

**Selector assumption flagged for `dev-story` (no existing UI pattern to match, per the story's own Dev Notes):** the multi-slot picker is assumed to render as a **radio group**, one radio per slot, accessibly labeled with text containing the slot's `location` (e.g. via `formatPickupWindow()` output plus location, matching `page.getByRole("radio", { name: /Market A/ })`). If implementation instead uses a `<select>`, this test's `getByRole("radio", ...)`/`.check()` call needs to change to `getByRole("combobox")`/`.selectOption()` — a one-line change, not a redesign.

Acceptance criteria coverage:
- AC1 (must select before checkout; blocked without): covered (Vitest required-field test + E2E multi-slot gating test)
- AC2 (server-validated vendor match + existence): covered (2 E2E API rejection tests)
- AC3 (`Order.pickupSlotId` set on creation): covered (E2E API success test, DB-verified)
- AC4 (zero-slots message, checkout stays blocked): covered (E2E UI test)
- AC5 (auto-select when exactly one slot): covered by design — no new scaffold needed; enforced by `payment.spec.ts`/`sms.spec.ts` staying green unmodified against `corner-sourdough`'s single seeded slot (explicitly not to be edited per the story's own Task 4 note)

## Next Steps (Task-by-Task Activation)

During `dev-story`, activate scaffolds task-by-task as each is implemented, not all at once:

1. Task 1 (`GET /api/vendors/[vendorId]/pickup-slots` route) lands → no scaffold un-skips yet; not independently exercised by a dedicated test at this layer (see Step 3's "not automated" note — covered indirectly once Task 3's UI consumes it).
2. Task 2 (`CheckoutSchema` requires `pickupSlotId`, route validates + persists it) lands → un-skip the new Vitest case and the 3 new `tests/checkout-api.spec.ts` cases. **At this point all 5 pre-existing `checkout-api.spec.ts` tests will fail at schema validation** until each is given a real `pickupSlotId` — this must happen in the same commit/PR as Task 2, not deferred, per the story's own Task 4 flag.
3. Task 3 (`cart/page.tsx` picker, auto-select, zero-slot message) lands → un-skip the 2 new `tests/storefront-cart.spec.ts` cases. Manually confirm `payment.spec.ts`'s "checkout redirects to Stripe" test and `sms.spec.ts`'s "cart requires a mobile number before checkout" test still pass unmodified — a failure there is a signal to fix auto-select, not to edit those tests.
4. Run each activated test, confirm it fails first (true red), then implement until green — same discipline as every prior story's ATDD cycle in this project.

## Implementation Guidance

New: `src/app/api/vendors/[vendorId]/pickup-slots/route.ts`. Modified: `src/app/api/checkout/schema.ts`, `src/app/api/checkout/route.ts`, `src/app/api/checkout/schema.test.ts`, `src/app/cart/page.tsx`, `tests/checkout-api.spec.ts`, `tests/storefront-cart.spec.ts`, `tests/helpers/db.ts` (`getVendorBySlug()` extended, new `createTestPickupSlot()`), `docs/api-contracts.md`, `docs/data-models.md`. Full contracts are in the story's own Tasks/Subtasks — see `_bmad-output/implementation-artifacts/5-1-customer-selects-a-pickup-slot-at-checkout.md`.

## Step 5: Validation & Completion

Validation checklist:
- [x] Prerequisites satisfied
- [x] Test files created and applied to the real repo (not draft-only); `tsc --noEmit` clean
- [x] Checklist matches acceptance criteria (AC1-AC5 all addressed, AC5 explicitly by existing-test-non-regression rather than a new scaffold)
- [x] Tests generated as red-phase scaffolds and independently executed — all 6 confirmed to fail for the right reason (feature absent), not for a broken-test reason (one authoring bug found and fixed during verification — see Step 4)
- [x] Story metadata and handoff paths captured
- [x] No CLI/MCP browser sessions opened (`tea_browser_automation` resolved to `none`); a local dev server was started/stopped manually only to debug and fix the `page.goto("/cart")` state-loss bug, then torn down
- [x] Temp artifacts: none retained (2 orphaned test orders created by the red-phase API runs' real side effects were cleaned up via Prisma after verification). Durable artifacts: this checklist plus the actual edits to `src/app/api/checkout/schema.test.ts`, `tests/checkout-api.spec.ts`, `tests/storefront-cart.spec.ts`, `tests/helpers/db.ts`

**Completion summary:**
- Applied and verified: 1 Vitest case (`schema.test.ts`), 5 Playwright cases (3 `checkout-api.spec.ts`, 2 `storefront-cart.spec.ts`) — 6 red-phase tests total, plus 2 test-helper extensions (`getVendorBySlug`, new `createTestPickupSlot`)
- Checklist: this file
- Story: `_bmad-output/implementation-artifacts/5-1-customer-selects-a-pickup-slot-at-checkout.md`
- Next recommended workflow: `dev-story`
