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
  - [x] Use this helper at every read site in Tasks 3-5 below, rather than inlining `stockQuantity > 0` three separate times

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
  **Superseded by round 1 review:** `isInStock()`/`PLACEHOLDER_*` actually live in a new `src/lib/availability.ts` — see the round-1 Review Findings' second Patch item for why.
- No new routes, no new components, no new Prisma models — only edits to five existing files (`schema.prisma`, `page.tsx` ×2, `ProductCard.tsx`, `route.ts`) plus one new migration folder and three edited test files.

### Testing Standards Summary

- `isInStock()` is a pure function with no Prisma/Clerk/server dependency — it belongs in Vitest (`src/lib/inventory.test.ts`, colocated per `project-context.md`'s convention), *not* Playwright. This is the opposite lesson from Story 1.2's review, where a DB-touching test had to move *out* of Vitest — this one has no DB dependency at all, so it stays in.
  **Superseded by round 1 review:** test file is `src/lib/availability.test.ts`, colocated with the actual `availability.ts` module.
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

### Review Findings (2026-08-18, Opus, reviewing commit `b3c52c0`)

_Reviewer independently ran `npx tsc --noEmit` (clean), `npm run lint` (clean), `npm run test:unit` (58/58), `npx playwright test tests/storefront-cart.spec.ts tests/checkout-api.spec.ts tests/inventory.spec.ts` (13/13), `npm run build` (succeeds), and `npx prisma migrate status` against the live Neon DB (up to date). Also diffed the live `Product` table's actual columns against `schema.prisma` and verified all four migrations' file checksums match `_prisma_migrations` byte-for-byte._

**Verified-good (no action):** migration history is genuinely clean, no drift, file content matches what was executed and what the DB reflects; no missed `isAvailable` reference anywhere in application code (only the two historical, correctly-untouched migration SQLs and the drift-guard test that deliberately reads them remain); checkout's whole-order rejection is genuinely atomic — the sufficiency check returns before any `Order`/Stripe session is created; the `!` non-null assertions in the checkout route are safe given the existence-count check above them; the disabled "Add" button breaks no existing test (confirmed by execution — `getByRole` still matches a disabled button).

- [x] [Review][Decision] The hand-created migration folder `prisma/migrations/20260818160625_drop_is_available/` is named in local (EDT) time, not UTC like every Prisma-generated migration in this repo — its on-disk sort order (before `…170751_add_threshold_placeholder_marker`) doesn't match its actual apply order (~3h after, confirmed via `_prisma_migrations.finished_at`). Currently harmless (the two migrations don't touch overlapping columns, so either order reaches the same end state) but untested and asymmetric with the rest of the migration history. Options: rename the folder to its UTC timestamp + update `_prisma_migrations.migration_name` to match (cheap now, one dev DB, migration is one commit old — same reasoning Story 1.2's own D1 finding used), or leave it and accept the documented hazard.
  **RESOLVED:** Renamed folder to `20260818200653_drop_is_available` (actual UTC `finished_at`) and updated `_prisma_migrations.migration_name` to match via `prisma db execute`. `npx prisma migrate status` confirms clean, no drift; on-disk sort order now matches apply order.
- [x] [Review][Patch] `isInStock()` pulls the entire Prisma Client browser shim into the public storefront's client bundle. `ProductCard.tsx` (`"use client"`) imports `@/lib/inventory`, which imports `@/lib/prisma`, which does module-scope `new PrismaClient()` — measured: the `/vendors/[slug]` route's client JS grew from 2,445 B to 43,290 B in this commit, the only route chunk containing the "PrismaClient is unable to run in this browser environment" string. Not a runtime crash (everything still works), but dead weight shipped to every shopper on the highest-traffic public page, and violates `project-context.md`'s "use client" boundary rule plus AD-3's framing of `src/lib/inventory.ts` as server-only. Fix: split the pure helper (and the `PLACEHOLDER_*` constants, which have the same problem if ever imported client-side) into a Prisma-free module, re-exported from `inventory.ts` so AD-2's single-canonical-check still holds for server callers.
  **RESOLVED:** Created `src/lib/availability.ts` (no Prisma import) holding `isInStock()` and both `PLACEHOLDER_*` constants; `inventory.ts` now re-exports them for server callers. `ProductCard.tsx` imports directly from `@/lib/availability`. Verified via `npm run build`: `/vendors/[slug]` route JS is back to 1.25 kB (from 43,290 B).
- [x] [Review][Patch] `tests/storefront-cart.spec.ts`'s "can add a product to the cart" test clicks `.first()` on the "Add" button, which is now racy against the sibling "out-of-stock" test's fixture setup — verified live: corner-sourdough's alphabetically-first product ("Cinnamon Morning Bun") is not what `.first()` was assumed to target once a same-named/earlier-sorting fixture briefly zeroes stock elsewhere in a parallel run. Before this story, a hidden `isAvailable:false` product simply vanished from `.first()`'s consideration; now it renders disabled and the click hangs to timeout. Fix: use the file's own `productCard(name)`-style helper or target a named product instead of `.first()`.
  **RESOLVED:** Test now targets "Cinnamon Morning Bun" by name (same product `.first()` happened to hit) instead of `.first()`.
- [x] [Review][Patch] Four documentation sites still instruct filtering on the now-dropped `isAvailable` column and weren't caught by this story's otherwise-exhaustive code grep: `_bmad-output/project-context.md` (a "Critical Don't-Miss Rule" telling future agents to filter `isAvailable: true` in new product queries — the exact drift AD-2 exists to prevent), `docs/data-models.md`, `docs/api-contracts.md` (also missing the new 400 sufficiency-check response shape), and `docs/index.md`. None were in this story's Tasks or File List.
  **RESOLVED:** All four updated to describe `isInStock()`/`stockQuantity`-derived availability instead of the dropped column; `docs/api-contracts.md`'s checkout behavior section now documents the per-line sufficiency check and its 400 response.
- [x] [Review][Patch] Task 2's subtask "Use this helper at every read site in Tasks 3-5" (line 34 above) is still `[ ]` while its parent Task 2 and Tasks 3-5 themselves are all `[x]`, even though the work described was in fact done — bookkeeping oversight, not a functional gap.
  **RESOLVED:** Checkbox checked.

**Dismissed as noise:** the dashboard's "Available" column being redundant with the adjacent "Stock" column is a deliberate, already-documented Task 4 decision, not a defect.

**Post-fix regression (2026-08-18):** `npx tsc --noEmit` clean, `npm run lint` clean, `npm run test:unit` 58/58, `npx playwright test tests/storefront-cart.spec.ts tests/checkout-api.spec.ts tests/inventory.spec.ts` 13/13, `npm run build` succeeds. Full `npx playwright test`: 31/46 passing, all 15 failures the same pre-existing stale-Clerk-auth-fixture gap (`dashboard.spec.ts` ×11, `products-api.spec.ts` ×4) — zero new failures.

### Review Findings (round 2, 2026-08-19, Opus, reviewing commit `228511d`)

_Three-layer adversarial pass (Blind Hunter, Edge Case Hunter, Acceptance Auditor) plus independent verification of round 1's fixes. All five round-1 items are confirmed genuinely resolved by re-running the checks: `tsc`/lint/58 unit/13 targeted e2e all clean; `npm run build` shows `/vendors/[slug]` at 1.25 kB (from 43,290 B), no client chunk contains the PrismaClient shim string; `npx prisma migrate status` shows clean/no-drift with the renamed migration; no `isAvailable` reference remains outside the two historical migrations and their drift-guard test._

- [x] [Review][Patch] **The round-1 `.first()` fix pinned the test to the exact seed product a sibling test zeroes, making the race deterministic instead of removing it.** `tests/storefront-cart.spec.ts:22-25` now targets `"Cinnamon Morning Bun"` by name; `tests/storefront-cart.spec.ts:80-100`, in the same file, sets **that same seeded product's** `stockQuantity` to `0` (restored only in `finally`). `playwright.config.ts` sets `fullyParallel: true`, so under concurrent workers the Add button test 1 clicks can render `disabled` mid-run and hang to the 45s timeout. (Independently found by all three review layers.) Fix: give the "can add a product to the cart" test its own dedicated fixture product (via `createTestProduct`/`deleteProduct`, like the other two tests in this file already do) instead of depending on shared seed data another test mutates.
  **RESOLVED:** Both tests now use their own `createTestProduct`/`deleteProduct`-scoped fixture, decoupled from shared seed data and from each other.
- [x] [Review][Patch] **The third test in the same file still uses the exact `.first()` pattern round 1 flagged, with a now-false comment.** `tests/storefront-cart.spec.ts:88-89` still clicks `getByRole("button", { name: "Add" }).first()`, and its comment (`:77-79`) claims this is "the same product the Add `.first()` click above targets" — false, since test 1 was rewritten to target by name. Fix: same as above — target a named/dedicated product here too.
  **RESOLVED:** Same fix as above (this is the same test as the previous finding) — targets its own dedicated `"Playwright Stock Drop Product"` fixture by name.
- [x] [Review][Patch] **The same `.first()`-on-corner-sourdough race exists repo-wide, in two files this story never touched.** `tests/payment.spec.ts:9` and `tests/sms.spec.ts:8` both click `page.getByRole("button", { name: "Add" }).first()` on `/vendors/corner-sourdough`, the same vendor/alphabetically-first-product pattern that made `storefront-cart.spec.ts` racy — before this story, out-of-stock products were filtered out of the listing entirely, so `.first()` was safe; now it isn't, anywhere. Fix: same as above, apply repo-wide rather than just in the one file this story edited.
  **RESOLVED:** Both files now create/delete their own dedicated fixture product instead of using `.first()`.
- [x] [Review][Defer] **The client-bundle fix (round 1) is convention-only, not build-enforced.** Nothing stops a future `"use client"` component from importing `@/lib/inventory` again and silently reintroducing the PrismaClient bundle regression — the only defense is a sentence in `project-context.md`. The `server-only` package is already present in `node_modules` (transitively via Next.js) and unused anywhere in `src/`; a one-line `import "server-only";` at the top of `src/lib/inventory.ts` would turn a future regression into a build error instead of a silent 40 kB+ regression. Cheap, but out of this story's stated scope — deferring rather than requiring it here.
  **INVESTIGATED, STAYS DEFERRED:** Tried it — `import "server-only"` at the top of `inventory.ts` throws immediately when `tests/inventory.spec.ts` imports `setStock`/`setLowStockThreshold` from it, because that Playwright spec runs outside Next's webpack bundler (no `react-server` condition is ever set, so `server-only`'s package.json `exports` always resolves to the throwing `index.js`, never the `react-server`-conditional `empty.js`). Making this work would mean restructuring `setStock`/`setLowStockThreshold` behind something tests reach differently — real scope, correctly out of this story.
- [x] [Review][Patch] **No test actually exercises AD-2's per-quantity sufficiency check — every test uses `stockQuantity: 0` with `quantity: 1`, which a plain `!isInStock()` check would also satisfy.** `tests/checkout-api.spec.ts:56-67` and `tests/storefront-cart.spec.ts:97-100` both test the `0`-stock case only. Deleting the `< i.quantity` comparison in `src/app/api/checkout/route.ts:44` and replacing it with `stockQuantity <= 0` leaves the whole suite green — the one thing AC #3 adds over the old `isAvailable` filter (quantity sufficiency, not just existence) is unverified. Missing case: `stockQuantity: 1, quantity: 2`. Fix: add a test with non-zero-but-insufficient stock.
  **RESOLVED:** Added `tests/checkout-api.spec.ts`'s new "rejects a cart requesting more than available stock even when some stock remains (400)" test (`stockQuantity: 1`, `quantity: 2`), and reworked `tests/storefront-cart.spec.ts`'s stock-drop test to add quantity 2 against a fixture dropped to `stockQuantity: 1` (was exactly 0) for the same reason.
- [x] [Review][Patch] **The checkout API's insufficient-stock test asserts only `status === 400`, indistinguishable from the pre-existing existence-check 400.** `tests/checkout-api.spec.ts:71` doesn't assert the response body, so if the sufficiency block were deleted entirely, the count-mismatch path would still return 400 and this test would still pass. Fix: assert the response body message (`"One or more items don't have enough stock"`), as the browser-level test already does.
  **RESOLVED:** Both the existing and new sufficiency tests in `checkout-api.spec.ts` now assert `body.error` matches the pinned message.
- [x] [Review][Patch] **The pricing-check test can silently skip instead of fail if the sufficiency check ever regresses.** `tests/checkout-api.spec.ts:36` is `test.skip(!response.ok(), "Stripe test keys not configured; skipping")` — a 400 from a real bug in the sufficiency check reads identically to a missing Stripe key and reports as a skip, not a failure. Currently masked by seed stock being 50 everywhere (`prisma/seed.ts`). Fix: skip only on a specific Stripe-config signal (e.g. check for the expected error message/an env var), not a bare `!response.ok()`.
  **RESOLVED:** Skip condition narrowed to `response.status() === 500` (an unhandled exception from an invalid/missing Stripe key — the route has no try/catch around the Stripe call). A 400 now fails the test instead of skipping it. Also hardened the product lookup to require `stockQuantity >= quantity`, not just `> 0`, so the test doesn't become newly flaky once seed stock isn't uniformly 50.
- [x] [Review][Decision] **Stock is never decremented on a completed sale, and the sufficiency check is a bare read with no reservation/transaction — two concurrent checkouts for the last unit both pass.** Confirmed: `src/app/api/webhooks/stripe/route.ts` only sets `status: "PAID"`, never calls `setStock`/a decrement. This is explicitly Story 1.4's job (`inventory-decrements-immediately-on-sale-completion`) and the TOCTOU race is a natural consequence of decrementing not existing yet, so no code change is being requested here. Flagging because neither `docs/api-contracts.md` nor a comment in `src/app/api/checkout/route.ts` states that the check is advisory-only until 1.4 ships — a future reader could reasonably assume "don't have enough stock" is a hard guarantee today. Options: add a one-line comment/doc note now (cheap), or accept the gap silently until 1.4 lands and addresses it end-to-end.
  **RESOLVED (took the cheap option):** Added a note to `docs/api-contracts.md`'s checkout behavior section stating the sufficiency check is a point-in-time read with no reservation/transaction, and that stock isn't decremented until Story 1.4.
- [x] [Review][Patch] **`docs/api-contracts.md`'s duplicate-`productId` behavior is undocumented and the existence check takes an unrelated-looking error path.** `src/app/api/checkout/route.ts:33` compares `products.length` (distinct rows) against `items.length` (raw line count); two lines for the same in-stock product return `400 "One or more items are unavailable"` — misleading, since the product is available. The per-line sufficiency check below it also never aggregates duplicate lines, so if that count guard is ever relaxed, `[{A,3},{A,3}]` against `stockQuantity: 4` would incorrectly pass. Fix: dedupe/aggregate `items` by `productId` before both checks, or explicitly document (and test) that duplicate lines for the same product are rejected by design.
  **RESOLVED:** `src/app/api/checkout/route.ts` now aggregates requested quantity per `productId` before both the existence check (against distinct product IDs) and the sufficiency check (against total requested quantity per product) — duplicate lines for the same product are now handled correctly rather than by an accidental invariant. `docs/api-contracts.md` updated to describe the aggregation.
- [x] [Review][Defer] **No storefront render-freshness control (`dynamic`/`revalidate`) now that availability is computed at read time instead of filtered in the query.** `src/app/vendors/[slug]/page.tsx` has no dynamic-rendering export. Under Next 14.2's default route cache, a dynamic segment with no dynamic API call is cache-eligible — a stale cached render could show an in-stock, enabled Add button for a product that's since sold out (previously a stale cache only hid an available product, the safer direction). Needs verification against an actual production deploy (dev server and `next build` alone don't prove cache behavior); not blocking this story, but should be checked before Epic 1 ships to production.
  **STAYS DEFERRED:** Needs a real production deploy to verify, not something `npm run build`/dev server proves either way. Tracked in `deferred-work.md` for a pre-launch check.
- [x] [Review][Defer] **The migration folder rename + `_prisma_migrations.migration_name` patch (round 1 fix) exists only as hand-run SQL recorded in story-file prose, not as a rerunnable script.** Fine for the single shared dev DB this project uses today; would break any second environment (CI, a teammate's DB, staging) that already applied the migration under its original name `20260818160625_...`. No action needed while there's one dev DB, but worth a one-line note in the migration's own file or `deferred-work.md` so it's not forgotten if a second environment appears.
  **STAYS DEFERRED:** Tracked in `deferred-work.md` per the finding's own suggestion.
- [x] [Review][Patch] **`src/lib/availability.ts`'s docstring claims checkout uses `isInStock()` for its sufficiency check; it doesn't.** `src/app/api/checkout/route.ts:42-45` inlines `product.stockQuantity < i.quantity` directly — correct behavior (a quantity comparison, not the boolean `isInStock()` gives), but the doc comment at `src/lib/availability.ts:14-18` asserts a coupling that doesn't exist, which a future agent could trust instead of grepping. Fix: reword the comment to say checkout independently compares `stockQuantity` against the requested quantity, consistent with (not delegating to) `isInStock()`.
  **RESOLVED:** Docstring reworded to state checkout's sufficiency check is separate from and doesn't call `isInStock()`.
- [x] [Review][Patch] **`docs/data-models.md`'s Product table, edited in round 1, still omits `thresholdIsPlaceholder`/`stockIsPlaceholder`** — both exist in `prisma/schema.prisma` and are load-bearing for Story 1.6 (FR13). Fix: add both rows while the table's already being touched.
  **RESOLVED:** Both rows added.
- [x] [Review][Patch] **Two places in this story's own Dev Notes still describe the pre-round-1-fix file layout**, contradicting the shipped `src/lib/availability.ts` split: references to `isInStock()` living in `inventory.ts` ("no new file") and to `src/lib/inventory.test.ts`. Cosmetic — doesn't affect any downstream agent's ability to find the real files via File List — but should be corrected for accuracy.
  **RESOLVED:** Both Dev Notes bullets annotated with a "Superseded by round 1 review" note pointing to the actual files, rather than rewriting the original planning text.
- [x] [Review][Defer] **Disabled "Add" button has no `aria-describedby`/`aria-disabled` association with the "Out of stock" text**, so `disabled` removes the control from the tab order entirely and a screen-reader user isn't told why it's gone. Real accessibility gap; deferring rather than patching now since it's pre-existing from this story's original implementation (not introduced by round 1) and no AC calls out a11y explicitly — worth its own small follow-up.
  **RESOLVED (upgraded from Defer — cheap enough to just do):** `ProductCard.tsx`'s button now uses `aria-disabled`/`aria-describedby` (pointing at the "Out of stock" span's `id`) instead of the native `disabled` attribute, keeping it focusable and screen-reader-explained; the `onClick` handler guards on `inStock` since `aria-disabled` doesn't block clicks natively. Verified `tests/storefront-cart.spec.ts`'s `.toBeDisabled()` assertion still passes — Playwright's matcher recognizes `aria-disabled="true"`.

**Verified false alarms (checked against project docs, not action items):**
- The "placeholder stock (`stockIsPlaceholder`) is trusted as real inventory everywhere, nothing surfaces it" finding (raised independently by two of the three layers) is **not a gap in this story** — `epics.md`'s Story 1.6 ("Vendor notified of placeholder Stock Quantity or Low-Stock Threshold", FR13) is specifically scoped to add the dashboard banner/badge for exactly this. Story 1.3's job (per its own Dev Notes and AD-2) is only to compute availability from whatever `stockQuantity` currently holds, placeholder or real — correct as implemented.
- The dashboard "Available" Yes/No column reading "Yes" for a 100-unit placeholder row was flagged as newly misleading; this is the same underlying gap as above and will be addressed by Story 1.6's banner, not by re-litigating round 1's already-dismissed "redundant column" finding.
- One layer's claim that the round-1 migration-name fix "requires a rerunnable script or it's a Decision-blocking gap" was downgraded to Defer above — there's exactly one dev DB for this project today, so the operational risk is real but not urgent.

**Post-fix regression (2026-08-19):** `npx tsc --noEmit` clean, `npm run lint` clean, `npm run test:unit` 58/58, `npx playwright test tests/storefront-cart.spec.ts tests/checkout-api.spec.ts tests/inventory.spec.ts tests/payment.spec.ts tests/sms.spec.ts` 18/18, `npm run build` succeeds (`/vendors/[slug]` still 1.3 kB). Full `npx playwright test`: 32/47 passing (one new sufficiency test added this round), all 15 failures the same pre-existing stale-Clerk-auth-fixture gap — zero new failures. One real bug found and fixed mid-implementation: `payment.spec.ts`'s dedicated fixture product couldn't be deleted after a real Stripe-configured checkout run, since the created `Order`/`OrderItem` referenced it and `OrderItem.productId`'s FK has no cascade — fixed by deleting any referencing orders before the product in that test's cleanup.

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
- `prisma/migrations/20260818200653_drop_is_available/migration.sql` (new; folder renamed from `20260818160625_...` post-review to match actual UTC apply time)
- `src/lib/availability.ts` (new — Prisma-free `isInStock()` and `PLACEHOLDER_*` constants, split out post-review so client components don't pull in Prisma)
- `src/lib/availability.test.ts` (new, renamed from `inventory.test.ts` post-review — 3 cases for `isInStock()`)
- `src/lib/inventory.ts` (modified — re-exports `isInStock()`/`PLACEHOLDER_*` from `availability.ts` for server callers)
- `src/lib/inventory.migration.test.ts` (modified — imports `PLACEHOLDER_*` from `availability.ts`)
- `src/app/vendors/[slug]/page.tsx` (modified — removed the `isAvailable` filter, added `stockQuantity` to `ProductCard`'s props)
- `src/components/ProductCard.tsx` (modified — out-of-stock badge, disabled "Add" button; imports `isInStock` from `@/lib/availability` directly, not `@/lib/inventory`)
- `src/app/dashboard/products/page.tsx` (modified — "Available" column now reads `isInStock(p)`)
- `src/app/api/checkout/route.ts` (modified — dropped the `isAvailable` filter, added the per-line stock-sufficiency check)
- `tests/helpers/db.ts` (modified — removed `createTestProduct`'s `isAvailable` override)
- `tests/checkout-api.spec.ts` (modified — fixed product selector, rewrote the availability-rejection test into an insufficient-stock test)
- `tests/storefront-cart.spec.ts` (modified — rewrote "unavailable products excluded" into "out-of-stock products show a badge and disabled Add"; rewrote the mid-cart-availability-change test to toggle `stockQuantity`; "can add a product to the cart" now targets a named product instead of `.first()`; round 2: both non-badge tests now use their own dedicated fixture products instead of shared seed data, and the stock-drop test's insufficiency case is non-zero (1 < 2) instead of exactly 0)
- `_bmad-output/project-context.md`, `docs/data-models.md`, `docs/api-contracts.md`, `docs/index.md` (modified — replaced stale `isAvailable` references with `isInStock()`/`stockQuantity`-derived availability; round 2: `data-models.md` also gained the `stockIsPlaceholder`/`thresholdIsPlaceholder` rows, `api-contracts.md` also gained the duplicate-line-aggregation and advisory-only-sufficiency-check notes)
- `tests/payment.spec.ts` (modified, round 2 — dedicated fixture product instead of `.first()`; cleanup deletes any `Order`/`OrderItem` referencing the product before deleting it, since a real Stripe-configured run creates one)
- `tests/sms.spec.ts` (modified, round 2 — dedicated fixture product instead of `.first()`)
- `src/app/api/checkout/route.ts` (modified, round 2 — aggregates requested quantity per `productId` before the existence/sufficiency checks, fixing duplicate-line handling)
- `src/lib/availability.ts` (modified, round 2 — docstring corrected: checkout's sufficiency check doesn't call `isInStock()`)
- `src/components/ProductCard.tsx` (modified, round 2 — disabled state now `aria-disabled`/`aria-describedby` instead of the native `disabled` attribute, for screen-reader support)

## Change Log

- 2026-08-18: Implemented Story 1.3 in full. Dropped `Product.isAvailable` (hand-run migration, since `prisma migrate dev` needs an interactive TTY confirmation this shell doesn't have), added the canonical `isInStock()` helper, wired it into the storefront (out-of-stock badge + disabled Add) and dashboard, and replaced checkout's existence-only filter with a real per-line stock-sufficiency check that rejects the whole order on any short line. All 6 ATDD-scaffolded tests (3 unit, 3 Playwright) activated and passing. Full regression: typecheck clean, lint clean, 58/58 unit tests, 31/46 e2e passing with the remaining 15 all the same pre-existing stale-Clerk-auth-fixture gap (unchanged count — no new authenticated-route tests added).
- 2026-08-18: Resolved all 5 round-1 review findings. Renamed the hand-created migration folder to its actual UTC apply time and repointed `_prisma_migrations.migration_name` to match. Split `isInStock()`/`PLACEHOLDER_*` out of `inventory.ts` into a new Prisma-free `src/lib/availability.ts`, fixing a bug where the storefront's client bundle (`/vendors/[slug]`) was accidentally pulling in the whole Prisma Client (43,290 B → 1.25 kB after the fix, confirmed via `npm run build`). Fixed a racy `.first()` Add-button click in `storefront-cart.spec.ts` to target a named product instead. Updated 4 stale docs (`project-context.md`, `data-models.md`, `api-contracts.md`, `index.md`) that still referenced the dropped `isAvailable` column. Checked a bookkeeping-only subtask box. Full regression re-run clean: typecheck, lint, 58/58 unit, 13/13 targeted e2e, build succeeds, 31/46 full e2e (same pre-existing 15 stale-auth failures, zero new). Status → review.
- 2026-08-19: Resolved all 15 round-2 review findings (1 Decision, 10 Patch, 4 Defer — one Defer item, the accessibility gap, was upgraded to fixed since it was cheap; the other 3 stay deferred). Highlights: gave `storefront-cart.spec.ts`'s tests their own dedicated fixture products instead of racing over shared/mutated seed data (the actual bug behind round 1's incomplete `.first()` fix), applied the same fix to `payment.spec.ts`/`sms.spec.ts`; added the missing non-zero-insufficient-stock test case at both the API and browser level; fixed checkout's duplicate-`productId` handling to aggregate quantity per product instead of checking each line in isolation; corrected a docstring, two doc gaps, and two stale Dev Notes references; made the out-of-stock button's disabled state screen-reader-accessible. Two items (storefront cache-freshness verification, migration-rename script durability) tracked forward in `deferred-work.md` since they genuinely need a second environment/production deploy to resolve. One Defer item (`server-only` bundle-guard) was investigated and confirmed to break `tests/inventory.spec.ts` outside Next's bundler — stays deferred. Found and fixed one incidental bug while testing: `payment.spec.ts`'s new fixture product couldn't be deleted after a real Stripe checkout run due to an FK from the created `OrderItem`. Full regression clean: typecheck, lint, 58/58 unit, 18/18 targeted e2e, build succeeds (`/vendors/[slug]` still 1.3 kB), 32/47 full e2e (same 15 pre-existing stale-auth failures, zero new). Status stays `review`, ready for round 3.
