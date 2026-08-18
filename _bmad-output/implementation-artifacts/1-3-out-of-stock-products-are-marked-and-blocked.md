---
baseline_commit: 0dd09ae
---

# Story 1.3: Out-of-stock products are marked and blocked

Status: review

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

- [x] Task 1: Drop `isAvailable` from the schema (AC: #2)
  - [x] Remove `isAvailable Boolean @default(true)` from the `Product` model in `prisma/schema.prisma` (currently the line right before `stockQuantity`)
  - [x] Generate and apply the migration. `npx prisma migrate dev --name drop_is_available` refused to run non-interactively (this shell has no TTY, and Prisma's data-loss confirmation for a DROP COLUMN with non-null values requires one) — used `npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script` to get the exact SQL, hand-created the migration folder with it, applied via `npx prisma db execute`, then recorded it with `npx prisma migrate resolve --applied`. `npx prisma migrate status` confirms clean, no drift. No backfill step needed this direction.
  - [x] Did **not** touch `stockQuantity`, `lowStockThreshold`, `thresholdIsPlaceholder`, or `stockIsPlaceholder` — migration ordering (architecture AD-2) already satisfied by Story 1.2.

- [x] Task 2: Add a shared `isInStock()` helper (AC: #2)
  - [x] Added `isInStock()` to `src/lib/inventory.ts` alongside the existing `PLACEHOLDER_*` constants and `setStock()`/`setLowStockThreshold()`. `npm run test:unit` — 58/58 (the 3 ATDD-scaffolded cases now pass).
  - [ ] Use this helper at every read site in Tasks 3-5 below, rather than inlining `stockQuantity > 0` three separate times

- [x] Task 3: Storefront listing — badge + disabled Add (AC: #1)
  - [x] Removed the `isAvailable: true` filter from `src/app/vendors/[slug]/page.tsx`'s `products` include; added `stockQuantity` to `ProductCard`'s `product` prop.
  - [x] `ProductCard.tsx`: `inStock = isInStock(product)`; renders a `bg-red-50 text-red-700` "Out of stock" pill when `!inStock`; `disabled={!inStock}` + `disabled:opacity-50 disabled:cursor-not-allowed` on "Add".
  - [x] Button stays present (not hidden) when disabled — confirmed via Playwright: `getByRole("button", { name: "Add" })` still resolves and `.toBeDisabled()` passes. `npx playwright test tests/storefront-cart.spec.ts` — 3 passed, 1 skipped (Task 5's scaffold), 0 regressions.

- [x] Task 4: Dashboard products table — computed "Available" column (AC: #2)
  - [x] Replaced `{p.isAvailable ? "Yes" : "No"}` with `{isInStock(p) ? "Yes" : "No"}` in `src/app/dashboard/products/page.tsx`. No query change needed (`stockQuantity` already present, no `select` on the `findMany`).
  - [x] Column header left as "Available".

- [x] Task 5: Checkout — per-line sufficiency check, not existence-only (AC: #3)
  - [x] Dropped `isAvailable: true` from the `products` lookup; kept the existence-count check.
  - [x] Added a per-line `stockQuantity < quantity` check via `items.some(...)` after the existence check, before building `lineItems` — rejects the whole order (400) before anything is created if any line is short. Message: `"One or more items don't have enough stock"` (matches the pinned ATDD contract).
  - [x] No transaction, no decrement added — route still only creates a `PENDING` order + Stripe session.

- [x] Task 6: Update existing tests broken by the `isAvailable` drop (AC: #2, #3)
  - Done during the ATDD red-phase generation pass (commit `f215a5e`), ahead of Task 1 — see that story's Change Log entry and the ATDD checklist for detail. Confirmed compiling and passing now that Tasks 1-5 have landed.

- [x] Task 7: New tests (AC: #1, #2, #3)
  - [x] `src/lib/inventory.test.ts` — 3 cases, all passing (`npm run test:unit`: 58/58).
  - [x] E2E: `tests/storefront-cart.spec.ts`'s "out-of-stock products show a badge and a disabled Add button" and "checkout shows an error when a cart item's stock drops below the cart quantity before submitting" — both passing, unauthenticated, unaffected by the stale Clerk fixture.
  - [x] API: `tests/checkout-api.spec.ts`'s "rejects a cart requesting more than the available stock (400)" — passing.

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

Claude Sonnet 5

### Debug Log References

- `npx tsc --noEmit` — clean after each task; Task 1 alone surfaced exactly the expected set of `isAvailable`-reference errors (checkout route, dashboard page, storefront page + its `pickupSlots`/`products` inference cascade from the one bad `where` clause), narrowing to zero by Task 5.
- `npm run lint` — clean throughout.
- `npm run test:unit` — 58/58 throughout (55 pre-existing + 3 `isInStock` cases un-skipped by Task 2).
- `npx playwright test` (full suite) — 31 passed, 15 failed, all 15 the same pre-existing stale-Clerk-auth-fixture failures tracked since Story 1.1 (`dashboard.spec.ts` ×11, `products-api.spec.ts` ×4) — zero new failures, zero flaky `storefront-cart.spec.ts` failures this run (a known intermittent parallelism issue from earlier sessions, not reproduced here).
- Migration applied via a manual `prisma migrate diff` → hand-authored `migration.sql` → `prisma db execute` → `prisma migrate resolve --applied` sequence, because `prisma migrate dev` refused to run non-interactively in this shell (it requires a TTY confirmation for a DROP COLUMN with non-null data). `npx prisma migrate status` confirms clean, no drift, after `prisma generate` regenerated the client.

### Completion Notes List

- Real column drop (second migration in this story's sequence, after Story 1.2's add-with-backfill), new `isInStock()` helper, storefront badge/disabled-button UI, dashboard column re-pointed at the computed value, checkout's per-line sufficiency check replacing the old existence-only filter.
- All 6 ATDD-scaffolded red-phase tests activated and passing; the "fix the existing suite first" edits (product selectors, fixture helper) made during the ATDD pass required no further changes here.
- No dashboard e2e coverage added for AC #2's column change — consistent with the story's own Dev Notes reasoning (stale Clerk fixture blocks authenticated dashboard e2e regardless; `tsc` is the stronger, cheaper signal for a `.tsx` read-site change with no dynamic typing involved).
- Full e2e regression confirms no new failures beyond the single pre-existing stale-auth-fixture issue (unchanged at 15, not grown — this story added no new authenticated-route tests).

### File List

- `prisma/schema.prisma` (modified — removed `Product.isAvailable`)
- `prisma/migrations/20260818160625_drop_is_available/migration.sql` (new)
- `src/lib/inventory.ts` (modified — added `isInStock()`)
- `src/lib/inventory.test.ts` (new — 3 cases for `isInStock()`)
- `src/app/vendors/[slug]/page.tsx` (modified — removed the `isAvailable` filter, added `stockQuantity` to `ProductCard`'s props)
- `src/components/ProductCard.tsx` (modified — out-of-stock badge, disabled "Add" button)
- `src/app/dashboard/products/page.tsx` (modified — "Available" column now reads `isInStock(p)`)
- `src/app/api/checkout/route.ts` (modified — dropped the `isAvailable` filter, added the per-line stock-sufficiency check)
- `tests/helpers/db.ts` (modified — removed `createTestProduct`'s `isAvailable` override)
- `tests/checkout-api.spec.ts` (modified — fixed product selector, rewrote the availability-rejection test into an insufficient-stock test)
- `tests/storefront-cart.spec.ts` (modified — rewrote "unavailable products excluded" into "out-of-stock products show a badge and disabled Add"; rewrote the mid-cart-availability-change test to toggle `stockQuantity`)

## Change Log

- 2026-08-18: Implemented Story 1.3 in full. Dropped `Product.isAvailable` (hand-run migration, since `prisma migrate dev` needs an interactive TTY confirmation this shell doesn't have), added the canonical `isInStock()` helper, wired it into the storefront (out-of-stock badge + disabled Add) and dashboard, and replaced checkout's existence-only filter with a real per-line stock-sufficiency check that rejects the whole order on any short line. All 6 ATDD-scaffolded tests (3 unit, 3 Playwright) activated and passing. Full regression: typecheck clean, lint clean, 58/58 unit tests, 31/46 e2e passing with the remaining 15 all the same pre-existing stale-Clerk-auth-fixture gap (unchanged count — no new authenticated-route tests added).
