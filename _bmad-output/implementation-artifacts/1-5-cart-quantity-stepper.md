---
baseline_commit: cc574e9
---

# Story 1.5: Cart quantity stepper

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a customer,
I want to bump a cart line's quantity up or down directly,
so that I don't have to remove and re-add it.

## Acceptance Criteria

1. Each cart line on `/cart` renders a stepper (decrement button, current quantity, increment button) in place of the current static `{quantity} × {name}` text. Clicking increment/decrement changes that line's quantity by exactly 1.
2. The stepper's floor is 1 — the decrement button is disabled (not hidden) when a line's quantity is already 1. There is no stepper-driven path to 0; removing a line entirely stays the existing "remove" link/button (Story 1.1), unchanged by this story.
3. The stepper's ceiling is the product's Stock Quantity as known to the cart (`CartItem.stockQuantity`, captured at add-to-cart time) — the increment button is disabled once a line's quantity reaches that value. Per architecture AD-3, this is a **UX hint only**: it is never re-validated against the server between add-to-cart and checkout, may go stale (another customer could buy the remaining stock in the meantime), and checkout's existing per-line `stockQuantity >= requestedQuantity` sufficiency check (Story 1.3/1.4, `src/app/api/checkout/route.ts`) remains the sole enforcement point regardless of what the stepper allowed. This story does not touch `/api/checkout`.
4. The cart total recalculates immediately on every stepper click, using the existing `totalCents` derivation (`Σ priceCents × quantity`) — no separate recompute path.
5. `CartItem` gains a `stockQuantity: number` field (captured at the moment the item is added, mirroring how `name`/`priceCents` are already captured then) — this field does not currently exist on `CartItem` despite architecture AD-3 describing it as already in place. `ProductCard`'s "Add" click must start passing it through; every existing `addItem` call site needs it.
6. Repeat-clicking a storefront "Add" button for a product already in the cart is also capped at that product's Stock Quantity (the same ceiling the stepper enforces), reusing one shared clamp rather than two separately-maintained limits. This is a silent cap — "Add" does not gain a new disabled state or error message when the cap is hit; it simply stops increasing the quantity. (This is a proportionate consistency fix, not new visible UX scope: FR11's literal request is the cart-page stepper, but leaving "Add" unclamped would let repeat-clicking silently exceed the same ceiling the stepper enforces one line down, on the same product, for no reason.)

*(FR11, AD-2 "checkout is sole enforcement", AD-3 "client ceiling is a UX hint only".)*

## Tasks / Subtasks

- [x] Task 1: Add `stockQuantity` to `CartItem` and clamp all quantity changes through it (AC #3, #5, #6)
  - [x] `src/components/CartProvider.tsx`: add `stockQuantity: number` to the `CartItem` type. Because `addItem`'s parameter type is `Omit<CartItem, "quantity">`, this alone makes every existing call site (`ProductCard.tsx`) a type error until it passes `stockQuantity` — let the type checker do the enforcement, don't add a separate runtime check for "did the caller forget it."
  - [x] Add a small internal clamp helper (e.g. `clampQuantity(quantity: number, stockQuantity: number): number => Math.max(1, Math.min(quantity, stockQuantity))`) and use it in both places quantity changes: `addItem`'s existing-item increment branch, and the new `updateQuantity` function below. One clamp, two call sites — do not duplicate the `Math.max`/`Math.min` logic inline in both.
  - [x] `addItem`'s existing-item branch currently does `{ ...i, quantity: i.quantity + 1 }` unconditionally — change to clamp against `item.stockQuantity` (the freshly-passed-in value from this click, not the stale stored one, since the click just came from a page that read current data). Also refresh the stored `stockQuantity` on that branch to the new value, so a stepper opened afterward uses the freshest ceiling this session has seen, not whatever was captured on the very first add.
  - [x] New method on the context: `updateQuantity(productId: string, quantity: number): void` — looks up the item, clamps the requested `quantity` through the same helper against that item's stored `stockQuantity`, and sets it. Add it to `CartContextValue` and the provider's returned `value`.

- [x] Task 2: Wire the stepper into `/cart` (AC #1, #2, #3, #4)
  - [x] `src/app/cart/page.tsx`: replace the `{i.quantity} × {i.name}` line with a stepper: a decrement button, the current quantity, an increment button, still followed by the existing "remove" button (unchanged, Story 1.1). Clicking decrement calls `updateQuantity(i.productId, i.quantity - 1)`; increment calls `updateQuantity(i.productId, i.quantity + 1)` — the clamp inside `updateQuantity` (Task 1) does the floor/ceiling enforcement, the page doesn't need its own bounds check.
  - [x] Decrement button: `disabled={i.quantity <= 1}`. Increment button: `disabled={i.quantity >= i.stockQuantity}`. Give both a stable, per-line accessible name for testability (e.g. `aria-label={\`Decrease quantity of ${i.name}\`}` / `\`Increase quantity of ${i.name}\``) — the existing "Add" button on `ProductCard` shares one accessible name across every card, and the existing e2e tests already work around that with DOM-position scoping (see `tests/storefront-cart.spec.ts`'s `productCard()` helper); giving the stepper buttons per-line names avoids needing the same workaround here.
  - [x] No change to `totalCents`'s derivation (`src/components/CartProvider.tsx`'s existing `useMemo`) — it already recomputes from `items` on every render, so a quantity change from the stepper flows through it for free. Do not add a second total-calculation path.

- [x] Task 3: Update `ProductCard`'s "Add" call site (AC #5, #6)
  - [x] `src/components/ProductCard.tsx`: pass `stockQuantity: product.stockQuantity` into the existing `addItem(vendorId, vendorSlug, { productId, name, priceCents })` call. `product.stockQuantity` is already in scope (used by `isInStock(product)` two lines above) — no new prop needed on `ProductCardProps`.

- [x] Task 4: New/extended tests — `tests/storefront-cart.spec.ts` (AC #1-#6)
  - [x] Extend, don't fork: this file already owns storefront+cart Playwright coverage (Story 1.1's P0 test, Story 1.3's out-of-stock tests) — add the new cases to it rather than starting a second cart spec file.
  - [x] Own dedicated `createTestProduct` fixtures for every new test, never the shared seed data — per Story 1.3 round-2's established discipline (`playwright.config.ts` has `fullyParallel: true`; a shared product's stock can be mutated by a sibling test mid-run). This story's ceiling tests specifically need a *low*-stock dedicated product (e.g. `stockQuantity: 2`) to reach the ceiling in a short test, which makes a shared/high-stock seed product actively wrong to use here, not just risky.
  - [x] Stepper increments/decrements and the total recalculates: add a dedicated product to the cart, use the stepper to go to quantity 3, assert the displayed line total is `3 × priceCents` and the cart-summary total matches; decrement back down and assert both recalculate again.
  - [x] Floor: with a line at quantity 1, assert the decrement button is disabled and clicking it (if not actually disabled — assert both) leaves quantity at 1, not 0, and does not remove the line.
  - [x] Ceiling: dedicated product with `stockQuantity: 2`. Add once (quantity 1), use the stepper to increment to 2, assert the increment button is now disabled and quantity stays at 2 (does not go to 3).
  - [x] "Add" button clamps too (AC #6): dedicated product with `stockQuantity: 2`. Click "Add" three times in a row on the storefront card; assert the cart line's quantity is 2, not 3.
  - [x] No new test against `/api/checkout` — AC #3's "ceiling is a UX hint only, checkout is sole enforcement" is already covered by this file's existing "checkout shows an error when a cart item's stock drops below the cart quantity before submitting" test (Story 1.3/1.4 territory, unchanged by this story). Don't duplicate that coverage here.

- [x] Task 5: Update docs (housekeeping, matches established precedent)
  - [x] Checked `docs/data-models.md` and every other `docs/*.md` file for a description of `CartItem`'s shape or the "Add" button's behavior — none exists (`CartItem` is client-only React state, not a Prisma model, so it was never documented there). No doc changes needed; not adding a new doc section for it now, matching the "update only what's actually stale" instruction.

## Dev Notes

**`CartItem.stockQuantity` doesn't exist yet, despite architecture describing it as already in place.** Architecture AD-3's own text says *"On the client, `CartItem` carries the `stockQuantity` known at add-to-cart time so FR-11's stepper can show a sensible ceiling"* — reading it in isolation could suggest this is pre-existing plumbing this story just consumes. It is not: `src/components/CartProvider.tsx`'s current `CartItem` type has exactly `productId`, `name`, `priceCents`, `quantity` — no `stockQuantity`. This story is what adds it. Don't skip Task 1 assuming it's already there.

**This is a pure client-state story — no new route, no new Prisma read/write, no server changes at all.** `CartProvider` is already `"use client"` and already avoids importing anything Prisma-touching (see `src/lib/availability.ts`'s doc comment on why `isInStock` lives there instead of `inventory.ts`, for the same reason). This story doesn't change that shape — everything is React state in `CartProvider.tsx` plus the two component call sites (`cart/page.tsx`, `ProductCard.tsx`). `/api/checkout` is explicitly untouched (AC #3).

**No unit-test path exists for this — it's Playwright-only, and that's correct, not a gap to fix.** `vitest.config.mts`'s `include` is `["src/**/*.test.ts"]` — `.ts` only, not `.tsx`, and there is no React Testing Library / jsdom environment configured anywhere in this project. `CartProvider`'s logic is React state (hooks, context), not a pure function extractable to a `.ts` file the way `formatPrice`/`isInStock` are — so it has no natural Vitest home. The existing precedent (`tests/storefront-cart.spec.ts`, Story 1.1's cart-removal test) already covers cart behavior exclusively through Playwright against the real running app. Follow that precedent for this story's coverage too; do not introduce `@testing-library/react`/jsdom as a new dependency to unit-test `CartProvider` in isolation — that would be a new testing capability for one story, not an existing convention this story extends (CLAUDE.md: "do not add dependencies without flagging them explicitly").

**The clamp is silent by design, not an oversight.** AC #6 caps repeat-"Add"-clicking at the product's stock ceiling but deliberately does *not* add a new disabled state, tooltip, or error message to `ProductCard`'s "Add" button when the cap is hit — it just stops increasing quantity. Building visible feedback for that specific moment is a UX decision beyond what FR11 (the cart-page stepper) actually asked for; the clamp exists only so "Add" can't trivially violate the same ceiling the stepper enforces one line down for the same product. If this needs a real "you've reached the limit" affordance later, that's a follow-up UX decision, not silently bundled into this story.

**`Navbar.tsx`'s cart-count badge needs no change and should not be touched.** `src/components/Navbar.tsx`'s `count = items.reduce((n, i) => n + i.quantity, 0)` already sums `quantity` across all lines — a stepper-driven change flows into it automatically, same as `totalCents`. Confirmed by reading the file; listed here only so it isn't mistaken for a fourth file this story needs to modify.

**Don't touch checkout.** AD-2's sufficiency check (`stockQuantity >= requestedQuantity` per line, `src/app/api/checkout/route.ts`) already exists from Story 1.3 and is already the sole enforcement point per AD-3's explicit framing — this story's ceiling is a client-side hint layered on top of it, not a replacement or a duplicate. Story 1.3/1.4's round reviews already established and tested checkout's server-side behavior; re-testing it here would be duplicate coverage, not new scope.

### Project Structure Notes

- No new files. Three existing files change: `src/components/CartProvider.tsx` (new field + clamp + `updateQuantity`), `src/app/cart/page.tsx` (stepper UI), `src/components/ProductCard.tsx` (one-line `addItem` call change).
- Matches architecture's Capability → Architecture map: *"FR-11 (cart quantity stepper) | `src/components/CartProvider.tsx`, `src/app/cart/` | AD-2 (checkout is sole enforcement), AD-3 (client ceiling is a UX hint only)"* — exactly the files this story touches, nothing wider.
- No Prisma migration, no new route, no new admin/dashboard surface — this story is entirely inside the existing storefront/cart client-state slice.

### Testing Standards Summary

- Playwright only, extending `tests/storefront-cart.spec.ts` (no Vitest — see Dev Notes on why `CartProvider` has no unit-test home in this project's current setup).
- Every new test uses its own dedicated `createTestProduct` fixture (never shared seed data), per the `fullyParallel: true` discipline Story 1.3's round-2 review established and Story 1.4 continued.
- The ceiling tests specifically need a *low*-stock dedicated product (e.g. `stockQuantity: 2`) so the ceiling is reachable within the test — this is a case where using a low-stock fixture is required for the test to mean anything, not just a style preference.
- No mocking — same "real DB, real running app" discipline as every other Playwright spec in this codebase.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.5] — story definition (`grep -n "^### Story 1.5" epics.md` confirms it at line 154), ACs, FR11 traceability.
- [Source: _bmad-output/planning-artifacts/architecture/architecture-local-food-2026-08-10/ARCHITECTURE-SPINE.md#AD-3] — "On the client, `CartItem` carries the `stockQuantity` known at add-to-cart time so FR-11's stepper can show a sensible ceiling — this is a UX hint only, may go stale, and is never authoritative; checkout's per-line sufficiency check (AD-2) is the sole enforcement point regardless of what the client allowed."
- [Source: _bmad-output/planning-artifacts/architecture/architecture-local-food-2026-08-10/ARCHITECTURE-SPINE.md#AD-2] — checkout's sufficiency check (`stockQuantity >= requestedQuantity` per line) is the sole enforcement point; not touched by this story.
- [Source: _bmad-output/planning-artifacts/architecture/architecture-local-food-2026-08-10/ARCHITECTURE-SPINE.md, Capability → Architecture Map] — confirms FR-11 is scoped to `src/components/CartProvider.tsx` and `src/app/cart/` only.
- [Source: src/components/CartProvider.tsx] — current module (read in full for this story): `CartItem` type has no `stockQuantity` field today; `addItem`'s existing-item branch increments unconditionally with no ceiling; `totalCents` is already a `useMemo` over `items` that will pick up stepper-driven quantity changes for free.
- [Source: src/app/cart/page.tsx] — current cart page (read in full for this story): renders `{i.quantity} × {i.name}` as static text per line today, with an existing "remove" button per line (Story 1.1) that stays unchanged.
- [Source: src/components/ProductCard.tsx] — current "Add to cart" component (read in full for this story): already has `product.stockQuantity` in scope via `isInStock(product)`; the `addItem(...)` call is the one site needing the new field passed through.
- [Source: src/lib/availability.ts] — `isInStock()`'s doc comment explains why client-facing modules avoid importing Prisma; this story's files already follow that shape and don't need to change it.
- [Source: tests/storefront-cart.spec.ts] — existing storefront+cart Playwright coverage (read in full for this story): Story 1.1's P0 removal/total test, Story 1.3's out-of-stock-badge test, and the checkout-sufficiency-error test this story's AC #3 relies on for its "checkout is sole enforcement" coverage without re-testing it.
- [Source: vitest.config.mts] — confirms `include: ["src/**/*.test.ts"]` (no `.tsx`), which is why this story's coverage is Playwright-only, not a gap.
- [Source: _bmad-output/implementation-artifacts/1-3-out-of-stock-products-are-marked-and-blocked.md, 1-4-inventory-decrements-immediately-on-sale-completion.md] — established the dedicated-fixture-over-shared-seed-data testing discipline this story's Task 4 follows.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5

### Debug Log References

### Completion Notes List

- Task 1/3: Added `stockQuantity: number` to `CartItem` (`src/components/CartProvider.tsx`) and a shared `clampQuantity(quantity, stockQuantity)` helper (floor 1, ceiling `stockQuantity`). Because `addItem`'s parameter type is `Omit<CartItem, "quantity">`, adding the field alone made `ProductCard.tsx`'s call site a type error until `stockQuantity: product.stockQuantity` was added there too (`product.stockQuantity` was already in scope via `isInStock(product)`) — the type checker did the enforcement as planned, no runtime guard needed. `addItem`'s existing-item branch now clamps its `quantity + 1` increment through the same helper and refreshes the stored `stockQuantity` to the freshest passed-in value. Added `updateQuantity(productId, quantity)` to the context, also routed through the clamp, and exposed on `CartContextValue`.
- Task 2: `src/app/cart/page.tsx`'s per-line `{quantity} × {name}` text replaced with a decrement/quantity/increment stepper, still followed by the unchanged Story 1.1 "remove" button. Decrement `disabled={quantity <= 1}`, increment `disabled={quantity >= stockQuantity}`; both buttons and the quantity display carry per-line `aria-label`s (`Decrease/Increase quantity of {name}`, `Quantity of {name}`) for stable Playwright targeting without the DOM-position workaround the shared-name "Add" button needs elsewhere in this file. No change to `totalCents`'s existing `useMemo` — quantity changes flow through it and through `Navbar.tsx`'s cart-count badge for free (confirmed by reading both, neither needed touching).
- Task 4: Added 4 new Playwright tests to `tests/storefront-cart.spec.ts` (increment/decrement + total recalculation, floor-disabled-at-1, ceiling-disabled-at-stockQuantity, "Add" repeat-click capped at the same ceiling), each with its own dedicated `createTestProduct` fixture (never shared seed data, matching this file's existing discipline). Ran the new tests first against pre-Task-1-3 code to confirm they failed for the expected reason (stepper buttons/aria-labels didn't exist yet), then implemented Tasks 1-3, then re-ran: all 4 new tests plus the file's existing 4 tests passed (8/8).
- Task 5: Checked `docs/data-models.md` and every other `docs/*.md` file for any description of `CartItem` or the "Add" button's behavior — none exists (client-only React state, not a Prisma model). No doc changes needed.
- Full regression at story completion: `npx tsc --noEmit` clean, `npm run lint` clean ("No ESLint warnings or errors"), `npm run test:unit` 58/58 (8 files, unaffected by this story — no `.ts` pure-function surface touched), `npx playwright test tests/storefront-cart.spec.ts` 8/8, `npm run build` succeeds, full `npx playwright test` 53 passed / 15 failed — all 15 the pre-existing stale-Clerk-auth-fixture cluster already documented in `deferred-work.md` (11 `dashboard.spec.ts`, 4 `products-api.spec.ts`), zero new failures.

### File List

- src/components/CartProvider.tsx
- src/components/ProductCard.tsx
- src/app/cart/page.tsx
- tests/storefront-cart.spec.ts

## Change Log

- 2026-08-19: Implemented Story 1.5 in full. Added `stockQuantity` to `CartItem` and a shared floor-1/ceiling-`stockQuantity` clamp used by both `addItem`'s repeat-click increment and a new `updateQuantity()` method (`src/components/CartProvider.tsx`). Replaced `/cart`'s static per-line quantity text with a decrement/quantity/increment stepper (`src/app/cart/page.tsx`), disabled at the floor/ceiling, leaving the existing Story 1.1 "remove" button untouched. Updated `ProductCard`'s "Add" call to pass `stockQuantity` through. No changes to checkout — its existing per-line sufficiency check (Story 1.3/1.4) remains the sole enforcement point; the cart ceiling is a client-side hint only, per architecture AD-3. Added 4 new Playwright tests to `tests/storefront-cart.spec.ts` covering increment/decrement + total recalculation, the floor, the ceiling, and the "Add"-button clamp; all use dedicated fixtures, never shared seed data. Full regression: typecheck clean, lint clean, 58/58 unit tests (untouched by this story), 8/8 in the extended cart spec, 53/68 e2e passing full-suite with the remaining 15 the same pre-existing stale-Clerk-auth-fixture gap (unchanged count, zero new failures), production build succeeds. Status → review.
