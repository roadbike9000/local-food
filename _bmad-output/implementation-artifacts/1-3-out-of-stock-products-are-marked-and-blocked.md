---
baseline_commit: 0dd09ae
---

# Story 1.3: Out-of-stock products are marked and blocked

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a customer,
I want to see when something's sold out and be stopped from ordering it,
so that I never pay for something unavailable.

## Acceptance Criteria

1. Given a product with Stock Quantity 0, when it's shown on the storefront (listing — this app has no separate detail route, see Dev Notes), then a visible out-of-stock badge renders and "Add" is disabled.
2. `Product.isAvailable` is dropped from the schema entirely — no persisted or cached boolean re-derives availability under any name. Availability is computed as `stockQuantity > 0` at every read site, including `src/app/dashboard/products/page.tsx`.
3. Checkout re-validates `stockQuantity >= requestedQuantity` per line, server-side, and rejects the *whole* order (400) if any line is short — not merely `stockQuantity > 0`. This replaces the current `where: { isAvailable: true }` existence filter, which only checked existence/display-availability, never quantity sufficiency.

*(FR6, FR7, AD-2.)*

## Tasks / Subtasks

- [ ] Task 1: Drop `isAvailable` from the schema (AC: #2)
  - [ ] Remove `isAvailable Boolean @default(true)` from the `Product` model in `prisma/schema.prisma` (currently the line right before `stockQuantity`)
  - [ ] Generate and apply the migration: `npx prisma migrate dev --name drop_is_available` (this repo's convention per `project-context.md` — never `prisma db push`). No backfill step needed this direction — dropping a column loses no downstream-required data, unlike Story 1.2's add-with-backfill. The two-step nullable→backfill→required dance from Story 1.2 does not apply here.
  - [ ] Do **not** touch `stockQuantity`, `lowStockThreshold`, `thresholdIsPlaceholder`, or `stockIsPlaceholder` in this migration — those are Story 1.2's columns and this story only removes `isAvailable`. Migration ordering (architecture AD-2) requires `stockQuantity` to already be backfilled for every existing row before this drop — it is, as of Story 1.2 shipping (see baseline_commit above) — so no window exists where availability is undefined.

- [ ] Task 2: Add a shared `isInStock()` helper (AC: #2)
  - [ ] Add `export function isInStock(product: { stockQuantity: number }): boolean { return product.stockQuantity > 0; }` to `src/lib/inventory.ts`, alongside the existing `PLACEHOLDER_*` constants and `setStock()`/`setLowStockThreshold()` — same file already owns every other stock-related concern (architecture AD-2: "no persisted or cached field may re-derive availability under any name" — a single canonical pure function everywhere `stockQuantity > 0` is checked is what prevents three call sites from each writing a slightly different version and drifting)
  - [ ] Use this helper at every read site in Tasks 3-5 below, rather than inlining `stockQuantity > 0` three separate times

- [ ] Task 3: Storefront listing — badge + disabled Add (AC: #1)
  - [ ] `src/app/vendors/[slug]/page.tsx`: remove the `where: { isAvailable: true }` filter (line 16) from the `products` include — out-of-stock products must now render, not be excluded. Add `stockQuantity` to the fields passed into `ProductCard`'s `product` prop (currently only `id, name, description, priceCents` at lines 50-55)
  - [ ] `src/components/ProductCard.tsx`: add `stockQuantity: number` to the `product` prop type (lines 9-14). Compute `const inStock = isInStock(product)` using Task 2's helper. Render a visible "Out of stock" badge (e.g. a `<span>` styled consistently with this file's existing Tailwind conventions — see `role="alert"` styling patterns elsewhere in this codebase for a small colored-text/pill treatment, e.g. `text-red-600` or a `bg-red-50 text-red-700` pill) when `!inStock`. Add `disabled={!inStock}` to the existing "Add" button (lines 32-43) and matching `disabled:opacity-50` styling (this codebase's established disabled-button pattern — see `EditStockControl.tsx`/`AddProductForm.tsx`)
  - [ ] Do not hide or remove the button when out of stock — AC #1 says "disabled," and a disabled-but-present button keeps its accessible role/name (`getByRole("button", { name: "Add" })` still resolves it in Playwright, just as `.toBeDisabled()`), which matters for Task 6's test rewrite

- [ ] Task 4: Dashboard products table — computed "Available" column (AC: #2)
  - [ ] `src/app/dashboard/products/page.tsx`: replace `{p.isAvailable ? "Yes" : "No"}` (line 43) with `{isInStock(p) ? "Yes" : "No"}` using Task 2's helper. The `products` query already has no `select`, so `p.stockQuantity` is already present on every row (Story 1.2) — no query change needed here, only the read
  - [ ] Leave the column header as "Available" — the display contract is unchanged, only what it's computed from

- [ ] Task 5: Checkout — per-line sufficiency check, not existence-only (AC: #3)
  - [ ] `src/app/api/checkout/route.ts`: change the `products` lookup (line 28) from `where: { id: { in: productIds }, vendorId, isAvailable: true }` to `where: { id: { in: productIds }, vendorId }` — fetch every requested product regardless of stock, so the code below can distinguish "doesn't exist / wrong vendor" from "exists but insufficient stock" and report each precisely rather than collapsing both into one existence-count mismatch
  - [ ] Keep the existing `products.length !== items.length` check (line 31) — it still correctly catches "product doesn't exist or isn't this vendor's," now that `isAvailable` no longer folds a third case into it
  - [ ] Add a new check, after that existence check and before building `lineItems` (i.e. right after line 36): for every requested item, find its matching product and verify `product.stockQuantity >= item.quantity`; if any line fails this, return `400` immediately — reject the *whole* order, not just the short line (AC #3's literal wording). Reuse the existing `{ error: "..." }` JSON shape this route already returns for its other 400s. **Pinned contract (see ATDD Artifacts below — the red-phase tests already assert this string):** the error message must be exactly `"One or more items don't have enough stock"`, not the old "unavailable" wording, which is no longer the precise failure mode
  - [ ] Do **not** add a transaction or decrement anything here — Story 1.3 only *validates* sufficiency at checkout time; actually decrementing stock on payment confirmation is Story 1.4's `decrementStock()`, which does not exist yet. This route still only creates a `PENDING` order and a Stripe session, exactly as today

- [ ] Task 6: Update existing tests broken by the `isAvailable` drop (AC: #2, #3)
  - [ ] `tests/helpers/db.ts`: remove `isAvailable` from `createTestProduct`'s `overrides` type (line 28) and its `data` object (line 40) — a Prisma `create` call referencing a dropped column will fail at the type level (and, if that were somehow bypassed, at runtime) the moment Task 1's migration lands
  - [ ] `tests/checkout-api.spec.ts` line 18: `vendor.products.find((p) => p.isAvailable)` → `vendor.products.find((p) => p.stockQuantity > 0)`
  - [ ] `tests/checkout-api.spec.ts` lines 52-75 ("rejects a cart containing an unavailable product"): rename to reflect the real scenario (e.g. "rejects a cart requesting more than available stock") and change the fixture from `createTestProduct(vendor.id, { name: "...", isAvailable: false })` to `createTestProduct(vendor.id, { name: "...", stockQuantity: 0 })`, requesting `quantity: 1` against it (0 available < 1 requested) — still asserts `400`
  - [ ] `tests/storefront-cart.spec.ts` lines 30-48 ("unavailable products are excluded from the storefront listing"): this test's *premise* is now backwards — out-of-stock products must be visible, not hidden. Rename it (e.g. "out-of-stock products show a badge and a disabled Add button") and rewrite: `createTestProduct(vendor.id, { name: "...", stockQuantity: 0 })`, then assert the product name **is** visible (drop the `.not.toBeVisible()` assertion), the out-of-stock badge text from Task 3 is visible, and the row's "Add" button (scoped by product name, same `getByRole("row", ...)`-style scoping Story 1.2 used in `dashboard.spec.ts` — this page isn't a table, so scope by a container `locator` around the product's name/card instead) `.toBeDisabled()`
  - [ ] `tests/storefront-cart.spec.ts` lines 50-88 ("checkout shows an error when a cart item goes unavailable before submitting"): change the setup/teardown from toggling `isAvailable` to toggling `stockQuantity` — capture the seeded product's real `stockQuantity` before the test (don't hardcode a restore value), set it to `0` mid-test (line 73-76), restore the captured value in `finally` (lines 83-87). Update the asserted message text (line 80, currently `"One or more items are unavailable"`) to match whatever exact string Task 5 ships

- [ ] Task 7: New tests (AC: #1, #2, #3)
  - [ ] Unit (Vitest, `src/lib/inventory.test.ts` — new file, this is a pure function, no Prisma/Clerk involved, so it belongs in Vitest per `project-context.md`'s Testing Rules, unlike Story 1.2's DB-touching tests which had to move to Playwright): a few cases for `isInStock()` — `stockQuantity: 0` → `false`, `stockQuantity: 1` → `true`, a larger value → `true`
  - [ ] E2E (Playwright): Task 6's rewritten `storefront-cart.spec.ts` tests already cover AC #1 and #3's user-visible behavior — no additional new E2E test file needed beyond those rewrites, but confirm both pass for real (this app's Clerk auth fixture is stale for *dashboard* tests, but the storefront and checkout are unauthenticated — these tests are not blocked by that pre-existing gap)
  - [ ] API (Playwright, `tests/checkout-api.spec.ts`): Task 6's rewritten "insufficient stock" test covers AC #3's server-side rejection at the API level directly

## Dev Notes

**This story is a removal + a read-site sweep, not new infrastructure.** Unlike Story 1.2 (new migration, new module, new route, new component), Story 1.3 touches five existing files and deletes one schema field. The risk here isn't "build the wrong thing," it's "miss a read site" — architecture AD-2 exists specifically because a missed write path (or, here, a missed *read* path) reintroduces the isAvailable/stockQuantity drift this story is meant to close for good.

**Every current `isAvailable` reference has already been located** (this story's context-gathering did a full-repo grep before writing these tasks) — the file list in Tasks 1-6 above is exhaustive as of `baseline_commit`. If a new `isAvailable` reference exists that isn't in this file, that's either a mistake in this story or new code that landed after this story was written — either way, stop and reconcile before proceeding, don't silently work around it.

**There is no separate storefront detail route.** `src/app/vendors/[slug]/page.tsx` is the *only* storefront file — it renders the vendor header, pickup info, and the full product listing (via `ProductCard`) in one page. AC #1's "listing or detail" from the epics wording collapses to just "listing" in this codebase; do not create a new detail route as part of this story, that would be scope the epic never asked for.

**The cart itself has zero availability awareness today, and this story does not change that.** `src/app/cart/page.tsx` and `CartProvider.tsx`'s `CartItem` type carry no stock/availability field — a customer can still add an item, watch it sell out to someone else, and only find out at checkout submission (which is exactly what Task 6's rewritten "checkout shows an error" test exercises). That's the intended enforcement point per AD-2 ("checkout re-validates sufficiency... regardless of client display") — Story 1.5 is what eventually adds a client-side stock ceiling to the cart's quantity stepper, not this story.

**Quantity can already exceed 1 today**, even without Story 1.5's stepper — `CartProvider.addItem()` increments an existing line's quantity by 1 on every repeated "Add" click for the same product (no stepper UI yet, but the underlying state already supports it). This is what makes a real "request more than in stock" scenario testable in Task 6/7 without needing Story 1.5 first.

**Checkout's existing 400 response shape is being reused, not replaced.** The route already returns `{ error: "..." }` with a 400 for both invalid-request-body and existence-mismatch cases (lines 20 and 32-35 today) — Task 5's new sufficiency check should return the same shape, just with accurate wording, not a new response format.

**Don't wire up decrementing stock in this story.** `decrementStock()` doesn't exist yet — that's Story 1.4, which introduces the webhook-triggered write path. This story only ever *reads* `stockQuantity` (for display and for the checkout sufficiency check); it makes zero writes to it. Resist the urge to "finish the job" by also decrementing on order creation — checkout creates a `PENDING` order before payment even happens, and decrementing before payment is confirmed is explicitly the ordering AD-3 and Story 1.4 exist to prevent.

**Migration ordering is already satisfied — this is the second half of a two-story sequence.** Story 1.2's Dev Notes stated this explicitly: "[dropping isAvailable] happens in Story 1.3, which depends on this story [1.2] having shipped first." Story 1.2 has shipped (`baseline_commit` above, currently at `status: review` after 4 code-review rounds, not yet merged to `main` — but the migration and backfill are real and applied to the dev database this story will also use). No additional backfill work is needed here.

### Project Structure Notes

- `isInStock()` goes in `src/lib/inventory.ts` (Task 2) — no new file. This matches the existing pattern of one file per stock-related concern, and keeps every stock-derived read/write in a single module (already true for `setStock`/`setLowStockThreshold`/the `PLACEHOLDER_*` constants).
- No new routes, no new components, no new Prisma models — only edits to five existing files (`schema.prisma`, `page.tsx` ×2, `ProductCard.tsx`, `route.ts`) plus one new migration folder and three edited test files.

### Testing Standards Summary

- `isInStock()` is a pure function with no Prisma/Clerk/server dependency — it belongs in Vitest (`src/lib/inventory.test.ts`, colocated per `project-context.md`'s convention), *not* Playwright. This is the opposite lesson from Story 1.2's review, where a DB-touching test had to move *out* of Vitest — this one has no DB dependency at all, so it stays in.
- Everything else in this story (storefront rendering, checkout's DB-backed sufficiency check) requires a running server/DB and belongs in the existing Playwright specs being edited in Task 6 — no new Playwright spec *files*, just rewritten tests in the two files that already cover this territory.
- Migration hygiene (`project-context.md`): `npx prisma migrate dev`, never `prisma db push`.
- `src/lib/inventory.migration.test.ts` (Story 1.2's migration-literal drift guard) needs **no change** — it only reads the *historical, already-applied* Story 1.2 migration file, which this story never touches.

### ATDD Artifacts

- Checklist: `_bmad-output/test-artifacts/atdd-checklist-1-3-out-of-stock-products-are-marked-and-blocked.md`
- Unit tests: `src/lib/inventory.test.ts` (new, 3 cases for `isInStock()`)
- API tests: `tests/checkout-api.spec.ts` (1 case rewritten to red, 1 existing case's selector fixed)
- E2E tests: `tests/storefront-cart.spec.ts` (1 new case, 1 existing case rewritten to red)
- Fixture: `tests/helpers/db.ts`'s `createTestProduct` already had its `isAvailable` override removed as part of this red-phase pass (no remaining caller needs it)
- **Pinned contracts — implement to match exactly:**
  - Checkout's insufficient-stock error message: `"One or more items don't have enough stock"`
  - Storefront out-of-stock badge text: must match `/out of stock/i` (case-insensitive substring)
- Activate task-by-task per the checklist's "Next Steps" section — not all at once.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.3] — story definition, ACs, FR-6/FR-7 traceability.
- [Source: _bmad-output/planning-artifacts/architecture/architecture-local-food-2026-08-10/ARCHITECTURE-SPINE.md#AD-2] — the binding rule: `isAvailable` dropped, computed at read time only, display = `stockQuantity > 0`, checkout = per-line `stockQuantity >= requestedQuantity`, whole-order rejection on any short line, migration-ordering precondition (satisfied by Story 1.2).
- [Source: _bmad-output/planning-artifacts/architecture/architecture-local-food-2026-08-10/ARCHITECTURE-SPINE.md#AD-3] — confirms `decrementStock()` is out of this story's scope (Story 1.4).
- [Source: prisma/schema.prisma] — current `Product` model, exact field to remove.
- [Source: prisma/migrations/20260720212533_init/migration.sql, 20260818151647_add_stock_quantity_and_threshold/migration.sql] — historical context only, not edited by this story.
- [Source: src/app/vendors/[slug]/page.tsx] — storefront listing, the only storefront route (read in full for this story).
- [Source: src/components/ProductCard.tsx] — the "Add" button component, needs the disabled/badge state.
- [Source: src/app/dashboard/products/page.tsx] — Story 1.2 already restructured this file's table (Stock/Low-Stock Threshold split); this story only touches the "Available" column read.
- [Source: src/app/api/checkout/route.ts] — full current checkout flow (read in full for this story); the sufficiency check is new logic inserted into this existing route.
- [Source: src/components/CartProvider.tsx] — confirms `CartItem`/`addItem()` shape and that quantity can already exceed 1 without Story 1.5.
- [Source: src/lib/inventory.ts] — existing module `isInStock()` is added to; existing `PLACEHOLDER_*`/`setStock()`/`setLowStockThreshold()` are unrelated and untouched by this story.
- [Source: tests/helpers/db.ts, tests/checkout-api.spec.ts, tests/storefront-cart.spec.ts] — every existing test referencing `isAvailable` (read in full for this story; exhaustive as of `baseline_commit`).
- [Source: _bmad-output/implementation-artifacts/1-2-stock-quantity-captured-at-creation-backfilled-for-existing-products.md] — previous story; establishes the migration-ordering dependency this story completes, and the `isInStock`-style single-source-of-truth reasoning behind Task 2.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
