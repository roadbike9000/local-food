---
baseline_commit: 105242c32b8238356bf4438d7ce11327766d3be8
---

# Story 5.1: Customer selects a pickup slot at checkout; order links to it

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a customer,
I want to choose which pickup slot my order is for,
so that I know when and where to pick it up.

## Acceptance Criteria

1. A vendor with one or more upcoming pickup slots shows them at checkout (the `/cart` page — this codebase has no separate `/checkout` page; see Dev Notes), and the customer must select one before completing checkout — no order can be created without a `pickupSlotId`.
2. The selected slot's id is validated server-side (`POST /api/checkout`) — it must belong to the same vendor as the cart and still exist — before the order is created. Never trusted from the client alone (NFR2).
3. `Order.pickupSlotId` is set to the selected slot on creation — today it's always `null` for every real order; closing that gap is this story's core deliverable.
4. A vendor with zero upcoming pickup slots shows a clear "no pickup times available" message at checkout, and checkout stays blocked (not a broken or empty picker, and not a silently-creatable order with no slot).
5. When a vendor has exactly one upcoming slot, it's auto-selected — no pointless click required to "choose" the only option. Explicit selection is only required when there are 2+ slots. (Design decision — see Dev Notes; this is why most of this codebase's *existing* checkout tests need no changes.)

*(FR15, NFR2. Scope note: no pickup-slot selection UI exists anywhere in the current cart/checkout flow — this is new customer-facing UI, not just a backend wiring change, confirmed by reading `src/app/cart/page.tsx` in full: it's a pure client component with no server data fetching today.)*

## Tasks / Subtasks

- [x] Task 1: New public endpoint to list a vendor's upcoming pickup slots (AC #1, #4, #5)
  - [x] Create `src/app/api/vendors/[vendorId]/pickup-slots/route.ts` — `GET` only, **no auth** (this is the first public read API route in this codebase — every existing API route is either auth-gated or a write; confirmed by reading every file under `src/app/api/`). Query `prisma.pickupSlot.findMany({ where: { vendorId: params.vendorId, startsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" } })` — only upcoming slots, ordered soonest-first. Return `{ slots: PickupSlot[] }`, `200`, even for a vendor with zero slots (empty array, not a 404 — a "no pickup times" state is a valid, expected response, not an error).
  - [x] No vendor-existence check needed beyond the query itself — an unknown `vendorId` just returns `{ slots: [] }`, same shape as a real vendor with zero slots. The cart already only ever holds a `vendorId` that came from a real `ProductCard`/`addItem` call, so this isn't a new trust boundary to defend beyond what `POST /api/checkout` already re-validates.

- [x] Task 2: Require and validate `pickupSlotId` server-side (AC #2, #3)
  - [x] `src/app/api/checkout/schema.ts` — add `pickupSlotId: z.string().min(1)` to `CheckoutSchema` (required, not optional — AC #1 says no order can be created without one).
  - [x] `src/app/api/checkout/route.ts` — after the existing vendor-active check (keep that first — cheapest, fail-fast check stays fail-fast) and before the product/stock queries, add: `prisma.pickupSlot.findFirst({ where: { id: parsed.data.pickupSlotId, vendorId } })`. Not found → `400 { error: "Selected pickup time is no longer available" }` (distinct message from the existing "One or more items are unavailable" — a vendor mismatch or a since-deleted slot is a different failure than a bad product). Placed before the product/stock work so a bad slot fails fast, same reasoning the vendor-active check already uses.
  - [x] Add `pickupSlotId` to the `prisma.order.create({ data: {...} })` call — this is literally the entire point of AC #3; today that field is never set.
  - [x] **Scope note, not a task**: "still exists" (AC #2) is interpreted as "the row exists and belongs to this vendor," not "hasn't started yet." `PickupSlot` has no soft-delete, and re-checking `startsAt` at checkout time isn't in this story's ACs — a customer who sits on the cart page past a slot's start time could theoretically still complete checkout for it. Not fixed here; flag in Completion Notes if it's worth a `deferred-work.md` entry.

- [x] Task 3: Pickup-slot picker on the cart page (AC #1, #4, #5)
  - [x] `src/app/cart/page.tsx` (stays `"use client"` — it reads `useCart()`) — on mount and whenever `vendorId` changes, `fetch(`/api/vendors/${vendorId}/pickup-slots`)` and store the result in local state (`useState`, not `CartContext` — slot selection is checkout-flow-local, not cart state that needs to survive navigation or be shared elsewhere; don't add it to `CartProvider.tsx`'s public API for a single consumer).
  - [x] **Zero slots**: render the "no pickup times available" message (AC #4); the `Checkout` button's existing `disabled={loading || !name || !phone}` gains `|| !selectedSlotId` — with zero slots, `selectedSlotId` can never be set, so checkout stays permanently disabled, matching AC #4's "checkout stays blocked."
  - [x] **Exactly one slot**: auto-select it (`useEffect` setting `selectedSlotId` once slots load and `slots.length === 1`) — AC #5.
  - [x] **2+ slots**: render a picker (radio group or `<select>` — dev's call, no existing pattern in this codebase to match since this is new UI) using `formatPickupWindow(startsAt, endsAt)` (`src/lib/utils.ts`, already used by `vendors/[slug]/page.tsx`'s "Next pickup" banner — reuse it, don't reformat dates a second way) plus `location` when set, for each option. No option pre-selected; `Checkout` stays disabled until the customer picks one.
  - [x] Include `pickupSlotId: selectedSlotId` in the existing `POST /api/checkout` body (alongside `vendorId`, `customerName`, `customerPhone`, `items`).

- [x] Task 4: Tests (AC #1-#5)
  - [x] **This is the task most likely to be under-scoped — read it in full before starting.** `CheckoutSchema` requiring `pickupSlotId` means every existing direct-API-call test in `tests/checkout-api.spec.ts` (5 tests, none of which send a `pickupSlotId` today) will start failing at schema validation the moment Task 2 lands, regardless of what each test actually checks. Every one of those 5 requests needs a real `pickupSlotId` added. `corner-sourdough` (the vendor all 5 use) has exactly one seeded pickup slot (`prisma/seed.ts`) — `tests/helpers/db.ts`'s `getVendorBySlug()` currently only does `include: { products: true }`, not `pickupSlots` — extend it to include `pickupSlots` too so these tests can grab `vendor.pickupSlots[0].id` directly, no new helper needed for the happy-path cases.
  - [x] The deactivated-vendor test (`createTestVendor({ deletedAt: new Date() })`) creates a vendor with **zero** pickup slots by default (`createTestVendor()` doesn't create any) — that's fine, because Task 2's ordering puts the vendor-active check *before* the pickup-slot check, so this test never reaches slot validation and needs no real slot, just any non-empty string for `pickupSlotId` to satisfy Zod (e.g. `"placeholder"`).
  - [x] Add a new `createTestPickupSlot(vendorId, overrides)` helper to `tests/helpers/db.ts` (no existing helper creates a standalone slot — `createTestVendor`/`createTestProduct` don't touch `PickupSlot` at all) for the new dedicated tests below. Needs at minimum `startsAt`/`endsAt` overrides (default to "tomorrow," matching the seed data's own pattern) to support a "wrong vendor's slot" test and a multi-slot test.
  - [x] New unit test (Vitest), `src/app/api/checkout/schema.test.ts` (extend the existing file): `pickupSlotId` required — omitting it now fails where it previously would have passed (mirrors Story 4.1's pattern for a similar schema-tightening test).
  - [x] New Playwright tests, extend `tests/checkout-api.spec.ts`: `[P0]` a valid `pickupSlotId` belonging to the cart's vendor succeeds and `Order.pickupSlotId` is set to it (verify via DB, not just a 200); `[P0]` a `pickupSlotId` belonging to a *different* vendor is rejected (400, `"no longer available"` message) — use `createTestPickupSlot()` against `green-valley-produce` (or a throwaway vendor) and try to check out against `corner-sourdough`'s cart; `[P1]` a non-existent `pickupSlotId` is rejected the same way.
  - [x] New Playwright test, extend `tests/storefront-cart.spec.ts` or add to a new file (dev's call — this is new UI, not an extension of an existing described behavior): `[P1]` a vendor with 2+ upcoming slots shows a picker at `/cart`, `Checkout` stays disabled until one is selected, then enables; use `createTestPickupSlot()` to give a throwaway vendor + product a second slot alongside a first one. `[P1]` a vendor with zero pickup slots shows the "no pickup times available" message and `Checkout` never enables regardless of name/phone (use `createTestVendor()` + `createTestProduct()`, no slot created).
  - [x] **Do not modify** `tests/payment.spec.ts`'s "checkout redirects to Stripe" test or `tests/sms.spec.ts`'s "cart requires a mobile number before checkout" test — both exercise `corner-sourdough`, which has exactly one seeded slot, so AC #5's auto-select means both should keep passing unchanged. If either fails after Task 3 lands, that's a real signal AC #5's auto-select isn't wired correctly — don't "fix" it by editing those tests to manually select a slot; fix the auto-select logic instead.

- [x] Task 5: Docs sync (housekeeping, matches established precedent)
  - [x] `docs/api-contracts.md` — add a new section for `GET /api/vendors/[vendorId]/pickup-slots` (first public read route — note that explicitly, matching the doc's existing per-endpoint format), and update `POST /api/checkout`'s documented request body to include the new required `pickupSlotId` field.
  - [x] `docs/data-models.md` — check `Order.pickupSlotId`'s row for any "always null" / "not yet set" language (Task 3's Dev Notes source reference below flags it as a likely candidate) and update if stale; record the finding either way in Completion Notes, don't assume.

## Dev Notes

**There is no `/checkout` page — `/cart` *is* checkout.** `src/app/checkout/success/page.tsx` exists (the post-payment landing page Stripe redirects to), but the entire "review cart, enter contact info, click Checkout" flow lives in `src/app/cart/page.tsx`, a single client component. AC #1's "at checkout" means this page — don't build a new route.

**`CartProvider.tsx` should not gain a `selectedSlotId` field.** It's tempting to thread slot selection through the same global cart context that already holds `vendorId`/`items`, but it doesn't need to survive navigation the way cart contents do, and every existing `CartProvider` consumer/test would need to reason about a new field it doesn't care about. Keep it as `cart/page.tsx`'s own local state.

**Design decision — auto-select the only slot when there's exactly one (AC #5).** Every vendor in seed data (`corner-sourdough`, `green-valley-produce`) has exactly one pickup slot. Without auto-select, every existing checkout-flow e2e test that clicks "Checkout" (`payment.spec.ts`, `sms.spec.ts`) would need to learn how to select a slot first, purely as incidental friction from a UI change unrelated to what those tests actually verify. Auto-select for the single-option case is also just better UX — nobody should have to click to "choose" the only thing available. This is why Task 4 says not to touch those two files.

**This is the first public (unauthenticated) `GET` API route in this codebase.** Every existing route under `src/app/api/` is either a write (`POST`/`PATCH`) behind a `getCurrentVendor()`/`getCurrentAdmin()` check, or a webhook authenticated by signature. The storefront itself has never needed a public API before because `vendors/[slug]/page.tsx` is a Server Component that queries Prisma directly — but `cart/page.tsx` is a client component with no such access, hence the new route. No auth needed: pickup slot times/locations are exactly what the storefront page already shows publicly (the "Next pickup" banner).

**`formatPickupWindow()` already exists (`src/lib/utils.ts`) and is already used for this exact kind of display** (`vendors/[slug]/page.tsx`'s "Next pickup" banner). Reuse it for the picker's option labels — don't write a second date-formatting function.

**`PickupSlot.capacity` (max orders for that window) is not enforced anywhere in this codebase today, and this story doesn't add that enforcement.** AC #2 only asks for "belongs to the correct vendor, still exists" — not "still has room." Don't scope-creep into capacity checking; that's a different story's job if it's ever wanted.

### Project Structure Notes

- **New:** `src/app/api/vendors/[vendorId]/pickup-slots/route.ts`.
- **Modified:** `src/app/api/checkout/schema.ts`, `src/app/api/checkout/route.ts`, `src/app/api/checkout/schema.test.ts`, `src/app/cart/page.tsx`, `tests/checkout-api.spec.ts`, `tests/helpers/db.ts` (`getVendorBySlug()` extended, new `createTestPickupSlot()`), `docs/api-contracts.md`, `docs/data-models.md` (pending Task 5's own check).
- Matches the existing `src/app/api/{resource}/route.ts` + `schema.ts` convention, nested one level under a new `vendors/[vendorId]/` segment — no existing precedent for a nested dynamic-segment API route in this codebase (`api/admin/vendors/[id]/deactivate` is the closest shape, also nested), so match that file's structure if unsure.

### Testing Standards Summary

- Vitest for `CheckoutSchema`'s pure validation logic (extend the existing `schema.test.ts`).
- Playwright for the route (`tests/checkout-api.spec.ts`, extended) and the UI (`tests/cart.spec.ts` new, or added to `tests/storefront-cart.spec.ts` — dev's call).
- No mocking — matches this codebase's established convention. The new picker's data comes from a real Prisma query via the new public route, not a stub.
- Every `checkout-api.spec.ts` test needs a real, valid `pickupSlotId` to reach the code path it's actually testing — this is the single biggest regression-risk surface in this story (5 existing tests, all currently silent about pickup slots).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.1] — story definition and ACs.
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 5] — epic scope, standalone from Epics 1-4 except sharing `/api/checkout` with Epic 1.
- [Source: src/app/cart/page.tsx] — current file (read in full for this story) — the exact page this story extends; no existing slot-selection UI to build on.
- [Source: src/app/api/checkout/route.ts, src/app/api/checkout/schema.ts] — current checkout route/schema (read in full) — the exact validation-order and `Order.create` call this story extends.
- [Source: src/components/CartProvider.tsx] — current cart context (read in full) — confirms `vendorId`/`vendorSlug` are already available client-side, and that adding `selectedSlotId` here would be unnecessary scope (see Dev Notes).
- [Source: prisma/schema.prisma] — `PickupSlot`/`Order` models (read in full) — `Order.pickupSlotId` already exists (nullable, currently always null), `PickupSlot` has no soft-delete and an unenforced `capacity` field.
- [Source: prisma/seed.ts] — confirms both seeded vendors have exactly one pickup slot each, the basis for the auto-select design decision and for which existing tests don't need changes.
- [Source: tests/checkout-api.spec.ts] — existing API-level checkout tests (read in full) — all 5 need a `pickupSlotId` added; the single biggest regression-risk surface in this story.
- [Source: tests/payment.spec.ts, tests/sms.spec.ts] — existing UI-level checkout tests that must keep passing unmodified if AC #5's auto-select is implemented correctly.
- [Source: tests/helpers/db.ts] — `getVendorBySlug()`/`createTestVendor()` (read in full) — confirms `pickupSlots` isn't included today and no slot-creation helper exists yet.
- [Source: src/lib/utils.ts] — `formatPickupWindow()` already exists and is already used for pickup-time display elsewhere.
- [Source: src/app/vendors/[slug]/page.tsx] — the existing "Next pickup" banner, the only other place in the app that displays `PickupSlot` data today.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- Task 1 (`GET /api/vendors/[vendorId]/pickup-slots`): no dedicated automated test at this layer (by design — see the ATDD checklist's own note that Task 1 isn't independently exercised, covered indirectly by Task 3's UI tests). Verified manually against a running dev server + seeded DB instead: real vendor → `200 { slots: [...] }` with the one seeded upcoming slot; unknown `vendorId` → `200 { slots: [] }`, same shape.
- **Discovered mid-verification, not a code bug**: the dev DB's seeded pickup slots had drifted into the past (`prisma/seed.ts` computes "tomorrow" relative to whenever it last ran, not the current date) — the route correctly returned `{ slots: [] }` for `corner-sourdough`, which would have broken AC #5's auto-select for `payment.spec.ts`/`sms.spec.ts` had the suite run against the stale DB. Fixed by re-seeding (`npm run db:seed`); logged as a project-context.md Actual State Log entry, no code change warranted.
- Task 2: `CheckoutSchema` requiring `pickupSlotId` broke all 5 pre-existing `tests/checkout-api.spec.ts` tests at schema validation, exactly as the story's own Task 4 flagged. Fixed in the same pass (not deferred) — 4 tests now pass `vendor.pickupSlots[0].id` via `getVendorBySlug()`'s new `pickupSlots` include; the deactivated-vendor test passes a `"placeholder"` string since the vendor-active check runs first and it never reaches slot validation.
- One transient Neon `ConnectorError` (FK-violation-shaped, `PostgresError 23001`) hit once during a 4-worker parallel run of `checkout-api.spec.ts`; the same test passed clean both in isolation and in a subsequent full-suite re-run, and the DB's own post-run state showed the correct end result (order deleted, product intact, stock unchanged) — treated as connection-pool flakiness under concurrent load right after a fresh re-seed, not a real regression. Not chased further; did not recur.
- `npx tsc --noEmit` — clean throughout.
- `npm run lint` — clean (no ESLint warnings or errors).
- `npx vitest run` — 91/91 passed (90 pre-existing + 1 new).
- Full `npx playwright test` — 128/128 passed (an initial run against a stale manually-started dev server showed 1 unrelated failure + 13 not-run, both resolved by letting Playwright start its own fresh server — not a real regression, see Debug Log above).

### Completion Notes List

- New public route `src/app/api/vendors/[vendorId]/pickup-slots/route.ts` — `GET` only, no auth, returns a vendor's upcoming (`startsAt >= now`) pickup slots soonest-first, `{ slots: [] }` for zero slots or an unknown `vendorId` (same shape either way, per Task 1's design).
- `CheckoutSchema` now requires `pickupSlotId`; `POST /api/checkout` validates it belongs to the requested vendor and still exists (row-exists + vendor-match, not a `startsAt` re-check — see below) before creating the order, and now sets `Order.pickupSlotId` on every new order.
- `src/app/cart/page.tsx` fetches the vendor's upcoming slots on mount/`vendorId` change, auto-selects when there's exactly one (AC #5), renders a radio-group picker for 2+ (labeled via the existing `formatPickupWindow()` + location), and shows "No pickup times available." for zero — `Checkout` stays disabled without a selection in every case.
- **AC #2's "still exists" scope decision, as flagged in the story's own Task 2 note**: interpreted as "row exists and belongs to this vendor," not "hasn't started yet" — no `startsAt` re-check at checkout time. Judged not worth a `deferred-work.md` entry: the story's own Dev Notes already documents this as a deliberate scope boundary (not a gap that slipped through), the window is narrow (customer sitting on `/cart` past a slot's start time with no interaction), and no AC calls for it.
- Docs re-checked per Task 5: `docs/api-contracts.md` gained a new `GET /api/vendors/[vendorId]/pickup-slots` section and the `POST /api/checkout` request-body/behavior-list updates (renumbered steps 3-9). `docs/data-models.md`'s `Order.pickupSlotId` row updated — it didn't say "always null" verbatim, but "FK → PickupSlot, optional" was stale-by-omission now that every new order sets it; reworded to say so while keeping the field's actual DB nullability (unchanged, no migration) accurate.
- All 6 ATDD red-phase scaffolds (1 Vitest + 5 Playwright) activated and pass for real, no skips. `payment.spec.ts`'s "checkout redirects to Stripe" and `sms.spec.ts`'s "cart requires a mobile number before checkout" — both left unmodified per Task 4's explicit instruction — still pass, confirming AC #5's auto-select is wired correctly.
- Full regression: typecheck clean, lint clean, 91/91 unit, 128/128 e2e (zero skips, zero regressions).

### File List

- `src/app/api/vendors/[vendorId]/pickup-slots/route.ts` (new)
- `src/app/api/checkout/schema.ts` (modified — `pickupSlotId` required)
- `src/app/api/checkout/route.ts` (modified — pickup-slot validation + `Order.create` now sets `pickupSlotId`)
- `src/app/api/checkout/schema.test.ts` (modified — `validBody` gained `pickupSlotId`, 1 new test)
- `src/app/cart/page.tsx` (modified — pickup-slot fetch/auto-select/picker UI, `Checkout` gating)
- `tests/checkout-api.spec.ts` (modified — 5 pre-existing tests given a real/placeholder `pickupSlotId`, 3 new tests)
- `tests/storefront-cart.spec.ts` (modified — 2 new tests, new imports)
- `tests/helpers/db.ts` (modified — `getVendorBySlug()` now includes `pickupSlots`, new `createTestPickupSlot()`)
- `docs/api-contracts.md` (modified — new endpoint section, `POST /api/checkout` contract updated)
- `docs/data-models.md` (modified — `Order.pickupSlotId` row reworded)
- `_bmad-output/project-context.md` (modified — new Actual State Log entry for the seed-data staleness discovery)
- `_bmad-output/test-artifacts/atdd-checklist-5-1-customer-selects-a-pickup-slot-at-checkout.md` (from the prior ATDD pass, referenced not modified this session)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — status transitions)

## Change Log

- 2026-08-25: Implemented Story 5.1 in full. New public `GET /api/vendors/[vendorId]/pickup-slots` route; `CheckoutSchema`/`POST /api/checkout` now require and validate `pickupSlotId` server-side and set it on order creation; `/cart` gained a pickup-slot picker with auto-select for a single slot and a blocked-checkout "no pickup times available" state for zero. Fixed all 5 pre-existing `checkout-api.spec.ts` tests broken by the now-required schema field, in the same pass. Discovered and worked around (not a code bug) a dev-DB seed-data staleness trap — logged in `project-context.md`'s Actual State Log. Docs (`api-contracts.md`, `data-models.md`) re-checked and updated per Task 5. Full regression: typecheck clean, lint clean, 91/91 unit, 128/128 e2e, zero regressions, `payment.spec.ts`/`sms.spec.ts` confirmed unmodified and still green. Status → review.
