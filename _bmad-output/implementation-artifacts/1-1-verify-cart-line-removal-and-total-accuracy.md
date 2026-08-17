---
baseline_commit: b581db2eedb96c889cc0c95de798b7c92f85a594
---

# Story 1.1: Verify cart line removal and total accuracy

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a customer,
I want to remove an item from my cart and see the total update correctly,
so that I only pay for what I actually want.

## Acceptance Criteria

1. Given a cart with 2+ line items, when I remove one line, then it disappears immediately and the total recalculates to the sum of remaining lines (no tax/shipping — none exists in this app).
2. Given a cart with exactly 1 line item, when I remove it, then the cart returns to its empty state ("Your cart is empty.").
3. This is a **verification/regression task, not new development** — the behavior already exists and must not be re-implemented.

## Tasks / Subtasks

- [x] Task 1: Add a Playwright test proving line removal + total recalculation (AC: #1, #2)
  - [x] Add a new test to `tests/storefront-cart.spec.ts` (do not create a new spec file — this file already owns storefront/cart coverage)
  - [x] Fetch the seeded vendor's real products via `getVendorBySlug("corner-sourdough")` (same helper the "checkout shows an error" test above already uses) rather than hardcoding dollar amounts — read `priceCents` from the returned products so the total assertion can't drift from actual seed data
  - [x] Add 2 distinct products to cart — every product's "Add" button shares the accessible name "Add" (no per-product distinction by role/name), so scope each click to its product card, e.g. `page.locator(...).filter({ hasText: productName }).getByRole("button", { name: "Add" })`, not `.first()`/`.nth()` alone
  - [x] Assert the displayed total equals the sum of both fetched `priceCents` values
  - [x] Remove one line via its "remove" **button** (it's a `<button>` in `cart/page.tsx`, not a link — do not query `getByRole("link", ...)` for it)
  - [x] Assert that line is gone and the total now equals only the remaining item's price
  - [x] Remove the remaining line
  - [x] Assert the cart shows its empty state
- [x] Task 2: Confirm no source changes are needed (AC: #3)
  - [x] Run the new test against the current `CartProvider.removeItem` / `/cart` implementation, unmodified
  - [x] If it passes with zero source changes, the story is done — do not touch `CartProvider.tsx` or `cart/page.tsx`
  - [x] If it fails, treat that as a real regression bug (not expected) and stop — report the failure rather than silently patching around it, since this story's scope is verification only

## Dev Notes

**This story should require zero production-code changes.** The behavior is already fully implemented:

- `src/components/CartProvider.tsx` — `removeItem(productId)` filters the item out of `items` state; `totalCents` is a `useMemo` over `items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0)`, so it recalculates automatically on every `items` change, no separate recalculation logic exists or is needed.
- `src/app/cart/page.tsx` — each cart line renders a "remove" button (`text-xs text-stone-400`) calling `removeItem(i.productId)`; the empty-cart branch (`items.length === 0`) already renders "Your cart is empty."
- No tax or shipping exists anywhere in this codebase (pickup-only marketplace) — the total is pure `priceCents × quantity` summed, nothing more to verify there.

**Do not add:**
- Per-line quantity adjustment (that's Story 1.5, not this one).
- Any Stock Quantity / `isAvailable` logic (that's Stories 1.2/1.3 — this story predates them in the epic sequence and must not depend on or anticipate them).

### Project Structure Notes

- Test goes in the existing `tests/storefront-cart.spec.ts` — this repo keeps e2e specs flat, one file per feature area (`tests/*.spec.ts`), not mirrored to `src/`. Do not create `tests/cart-removal.spec.ts` or similar.
- Follow the file's existing patterns exactly: import `{ test, expect }` from `@playwright/test`, use `page.getByRole(...)` / `page.getByText(...)` locators (this codebase asserts on visible text/roles, not CSS selectors or component internals), and reuse the seeded vendor `corner-sourdough` (seeded via `npm run db:seed`, referenced by every other test in this file).
- No `src/lib/utils.ts` (`formatPrice`) changes needed — it's already the only place cents-to-dollar formatting happens, and this story doesn't touch formatting.

### Testing Standards Summary

- **Framework:** Playwright only for this story — this is UI/integration behavior (`CartProvider` + `/cart` page working together), not a pure function, so it belongs in `tests/`, not a Vitest unit test under `src/**/*.test.ts`.
- **Run with:** `npm run test:e2e` (or `npm run test:e2e:ui` while iterating). `playwright.config.ts`'s `webServer` auto-starts `npm run dev` — do not tell the user to start the dev server manually first.
- **Timeout awareness:** the file's existing tests already work around a known first-hit-compiles-slowly race on `/cart` (`{ timeout: 15_000 }` on the `toHaveURL` assertion) — reuse that same pattern for any new navigation to `/cart`, don't drop the extended timeout.
- **No mocking:** this codebase's discipline (per `project-context.md`) is to hit real dev-mode services, never mock Stripe/Clerk/Twilio responses. This story doesn't touch any of those, but stay consistent with that principle if the test needs any setup.
- **Cleanup:** this test shouldn't need any `try/finally` DB cleanup at all — cart state is client-side only, and it only *reads* the two pre-seeded products (via `getVendorBySlug`) without creating or mutating anything. That's simpler than the "unavailable products" test above it (which creates a fixture product and must `deleteProduct` it) or the "checkout shows an error" test (which mutates then restores `isAvailable` via `prisma.product.update`) — neither pattern is needed here.

### ATDD Artifacts

- Checklist: `_bmad-output/test-artifacts/atdd-checklist-1-1-verify-cart-line-removal-and-total-accuracy.md`
- E2E tests: `tests/storefront-cart.spec.ts` (new `[P0] removing cart lines recalculates the total and empties the cart` test, currently `test.skip()` — red phase)
- API tests: none (no API surface for this story)
- Component tests: none (no component-testing infra in this repo)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.1] — story definition, ACs, FR1 traceability.
- [Source: _bmad-output/planning-artifacts/prds/prd-local-food-2026-08-10/prd.md#FR-1] — "already implemented... ships as a verification/regression task, not new development."
- [Source: src/components/CartProvider.tsx] — `removeItem`, `totalCents` (existing implementation, read in full for this story).
- [Source: src/app/cart/page.tsx] — remove button, empty-cart branch (existing implementation, read in full for this story).
- [Source: tests/storefront-cart.spec.ts] — existing test file and conventions this story's test must follow (read in full for this story).

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- Activated red-phase test (removed `test.skip()`) and ran solo: `npx playwright test tests/storefront-cart.spec.ts -g "removing cart lines"` → passed in 9.6s, first run, no source changes. Confirms the story's core premise (already-implemented, verification-only).
- Ran full `storefront-cart.spec.ts` file (all 4 tests) → all pass, no regressions in the file this story touched.
- `npm run typecheck` → clean. `npm run lint` → clean.
- `npm run test:e2e` (full suite, 34 tests) → 24 passed, 10 failed. All 10 failures are in `tests/dashboard.spec.ts`'s `vendor dashboard (authenticated)` suite — a file this story never touches. Diagnosed root cause: `playwright/.auth/vendor.json` (Clerk vendor session storage state) is stale/expired (dated 2026-08-07). Attempted `npm run test:e2e:auth` to regenerate it — failed with `ERR_CONNECTION_REFUSED` because that script requires a dev server already running standalone (Playwright's `webServer` auto-start only applies inside `playwright test` runs, not this separate script). This is a pre-existing environment-setup gap, not a code regression: confirmed via `git diff --stat {baseline_commit}` that this story's entire diff is 2 files of documentation/tracking plus a 1-line change in `tests/storefront-cart.spec.ts` (`test.skip` → `test`) — nothing that could affect Clerk auth or the dashboard.

### Completion Notes List

- Story confirmed its own premise: cart line removal and total recalculation were already fully implemented (`CartProvider.removeItem`, `totalCents` useMemo) — zero production code changed, exactly as scoped.
- New Playwright test added to `tests/storefront-cart.spec.ts`, activated (skip removed), passes on first run against the existing implementation.
- Full regression run surfaced 10 pre-existing failures unrelated to this story (stale vendor auth session in `dashboard.spec.ts`) — documented above, flagged to user, **not fixed here** since it's outside this story's scope and touches a different feature area (vendor dashboard auth) than what this story owns (cart). Recommend a follow-up story/task to regenerate/automate the vendor auth fixture.

### File List

- `tests/storefront-cart.spec.ts` (modified — added and activated one test)

## Change Log

- 2026-08-18: Added `[P0] removing cart lines recalculates the total and empties the cart` to `tests/storefront-cart.spec.ts`, activated it, confirmed green on first run against the existing implementation. No production code changed. Full regression run surfaced 10 pre-existing, unrelated failures (stale vendor auth session in `dashboard.spec.ts`) — documented in Dev Agent Record, not addressed here (out of scope for this story).
