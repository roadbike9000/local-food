---
baseline_commit: 66de6b4
---

# Story 1.6: Vendor notified of placeholder Stock Quantity or Low-Stock Threshold

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a vendor,
I want to know which of my products still has a migration-placeholder Stock Quantity or Low-Stock Threshold,
so that I can enter the real numbers.

## Acceptance Criteria

1. Given a product whose `Product.stockIsPlaceholder` is `true`, or whose `Product.thresholdIsPlaceholder` is `true`, when the vendor views `/dashboard/products`, then a badge flags that row — **one shared badge for either condition**, not two separate flags. Both booleans already exist on the schema (Story 1.2's migration `20260818151647_add_stock_quantity_and_threshold` / `20260818170751_add_threshold_placeholder_marker`) and are already selected by this page's existing `prisma.product.findMany({ where: { vendorId: vendor.id }, ... })` call (no `select` narrowing it) — this story is read/display only, it does not add either flag, does not touch the migration, and does not touch either flag's write path.
2. The badge disappears the moment the vendor edits the flagged field to any value, via the existing `EditStockControl` → `PATCH /api/products/[id]` → `setStock()`/`setLowStockThreshold()` path — **already fully implemented and tested** by Story 1.2 (see `src/lib/inventory.ts`'s `setStock()`/`setLowStockThreshold()` doc comments and `tests/inventory.spec.ts`'s 4 clear/no-clear cases). This story adds no new write mechanism for clearing either flag; the next `router.refresh()` after a successful save (already wired in `EditStockControl.tsx`) re-fetches the row and the badge condition re-evaluates to `false` for free.
3. No SMS/email is sent — this is dashboard-display-only, consistent with `stockIsPlaceholder`/`thresholdIsPlaceholder` never being read by anything outside `src/app/dashboard/products/page.tsx` after this story ships.

*(FR13, AD-9.)*

## Tasks / Subtasks

- [x] Task 1: Render a shared placeholder badge on `/dashboard/products` (AC #1, #3)
  - [x] `src/app/dashboard/products/page.tsx`: in the existing `products.map((p) => ...)` row, add a badge (e.g. a small `<span>` styled consistently with `ProductCard.tsx`'s existing out-of-stock badge — `rounded-full`, a muted background/text color pairing, not the same red used for "out of stock" so the two don't read as the same severity) that renders when `p.stockIsPlaceholder || p.thresholdIsPlaceholder` is true. **One badge, driven by the OR of both flags** — do not render two separate badges or two separate conditions (AC #1's explicit "same banner mechanism for either placeholder, not two separate flags").
  - [x] Place it in the `Name` `<td>`, near `p.name` — mirrors where `ProductCard.tsx`'s out-of-stock badge sits relative to the product it describes, and keeps it visually anchored to the row it flags rather than floating in an unrelated column.
  - [x] Wording should describe the actual meaning to a vendor who has never seen this before — e.g. "Needs review" or "Placeholder values" with a `title`/tooltip or adjacent text naming which field(s) (Stock Quantity, Low-Stock Threshold, or both) are still placeholders. Don't just say "placeholder" with zero context — the vendor reading this has no idea what a "placeholder" is unless the badge explains it.
  - [x] No new component file needed — this codebase's existing convention for a single small conditional badge is inline JSX at the call site (see `ProductCard.tsx`'s out-of-stock badge, which is not its own component). Match that, don't introduce a new file for a few lines of conditional markup.
  - [x] Give the badge a stable accessible name/selector for testability — this page already has a per-product `aria-labelledby` pattern in `EditStockControl.tsx` (`stock-qty-label-${productId}` etc.) for the same reason; reuse that convention's shape (e.g. an `id` or `aria-label` keyed on `productId`, not on `p.name`, since `productId` is the row's actual unique key — unlike Story 1.5's round-1 review finding about name-keyed labels, which this story should not repeat).

- [x] Task 2: New test — `tests/dashboard.spec.ts` (AC #1, #2)
  - [x] Added to the existing `test.describe("vendor dashboard (authenticated)", ...)` block, following the exact pattern of `"[P1] vendor can edit an existing product's Stock Quantity via the inline control"` immediately above it in the same file (dedicated `createTestProduct` fixture with a timestamped unique name, `page.getByRole("row", { name: new RegExp(productName) })` to scope assertions to the fixture row, `deleteProduct()` in a `finally`).
  - [x] Case A: a dedicated product created with `stockIsPlaceholder: true` (via `createTestProduct`'s existing `overrides.stockIsPlaceholder`) shows the badge on `/dashboard/products`; a sibling dedicated product created with both flags `false` (the `createTestProduct` default) does not show it on its own row.
  - [x] Case B: editing the flagged product's Stock Quantity via `EditStockControl` (same PATCH-and-reload interaction as the existing "[P1] vendor can edit..." test) makes the badge disappear after the save completes and the page reflects the persisted state.
  - [x] **Known, pre-existing environment gap confirmed, not a real bug:** ran `npx playwright test tests/dashboard.spec.ts` — both new tests fail alongside the pre-existing 11, all 13 with the identical failure signature (`getByRole('heading', { name: 'Products' })` / row locator not found because the page rendered `Sign in to LocalFood` instead — confirmed via the failure's `error-context.md` snapshot, which shows the Clerk sign-in page, not a 401 or an assertion about the badge itself). Matches `deferred-work.md`'s documented stale `playwright/.auth/vendor.json` session gap exactly. No implementation change made to work around it, per Dev Notes.

- [x] Task 3: Update stale doc reference (housekeeping, matches established precedent)
  - [x] `docs/data-models.md`'s `stockIsPlaceholder` row updated to name `/dashboard/products`'s "Needs review" badge as the read site, past tense, instead of "not yet consulted by any read site as of Story 1.3".

## Dev Notes

**This story is much smaller than the epics-list description might suggest — almost everything is already built.** Story 1.2's own scope (and its round-2 review, finding D3) already delivered: the `stockIsPlaceholder`/`thresholdIsPlaceholder` schema columns, the migration that backfills them (`true` for every pre-existing product, per Story 1.2's AC), and `setStock()`/`setLowStockThreshold()`'s existing logic to clear each flag on a genuine edit (and, critically, *not* clear it on a same-value resubmission — see `tests/inventory.spec.ts:81-100,122-140`, the round-2 D3 fix). `prisma/schema.prisma:44-52`'s own comments say so directly: *"this is what lets Story 1.6 tell a placeholder 0 apart from a vendor's deliberate 0"*. Do not re-derive placeholder status via an equality check against `PLACEHOLDER_STOCK_QUANTITY`/`PLACEHOLDER_LOW_STOCK_THRESHOLD` (the constants in `src/lib/availability.ts`, re-exported from `inventory.ts`) — architecture AD-9's prose describes the mechanism that way, but the actual implementation deliberately moved to dedicated boolean flags specifically because a vendor's *deliberate* `stockQuantity: 100` or `lowStockThreshold: 0` is indistinguishable from the placeholder by value alone. The flags already resolve that ambiguity; use them, not a value comparison.

**No migration, no new API route, no changes to `src/lib/inventory.ts` or the PATCH route.** This story's entire code surface is `src/app/dashboard/products/page.tsx` (add the badge) plus its test coverage. If a task in this story starts looking like it needs a schema change or a new write path, stop — that's a sign of re-deriving something Story 1.2 already solved, not a legitimate part of this story.

**The dashboard e2e auth gap is real, documented, and not this story's problem to fix.** `deferred-work.md`'s Story 1.1 entry (and its escalation under Story 1.2) tracks the stale `playwright/.auth/vendor.json` Clerk session blocking all 15 currently-known authenticated-dashboard/products-API tests. This story's two new tests join that same `describe` block and will very likely fail for the identical reason. Do not attempt to regenerate the auth fixture, add a workaround, or treat that failure as a story-blocking regression — verify the failure signature matches the documented one (sign-in redirect / 401) and note it in the Dev Agent Record the same way Story 1.5 did, rather than trying to fix authentication infrastructure that's explicitly out of scope.

**Badge styling: don't reuse "out of stock" red.** `ProductCard.tsx`'s existing out-of-stock badge (`bg-red-50 text-red-700`) signals "you cannot sell this right now" — a genuinely urgent, blocking state. A placeholder-values badge signals something softer ("this number might not be real yet, you may want to check it") and should read as lower-severity so vendors don't confuse the two badge types across different pages. Pick a distinct color pairing (e.g. amber/yellow) already used elsewhere in this codebase's Tailwind palette if one exists, rather than inventing a new one from scratch.

### Project Structure Notes

- One file changes in `src/`: `src/app/dashboard/products/page.tsx`. No new files, no new components (per Task 1's "match `ProductCard.tsx`'s inline-badge convention" note).
- Matches architecture's Capability → Architecture Map: *"FR-13 (vendor placeholder-count notification) | `src/app/dashboard/products/page.tsx` | AD-9"* — exactly the one file this story's scope predicts.
- `docs/data-models.md` gets a one-line correction (Task 3); no other doc site references either placeholder flag or FR13 as of this story's baseline.

### Testing Standards Summary

- Playwright only, extending `tests/dashboard.spec.ts`'s existing authenticated `describe` block — no Vitest surface here (this is server-rendered display logic reading already-fetched Prisma fields, not a pure function).
- Every new test uses its own dedicated `createTestProduct` fixture with a timestamped unique name (matches the existing "[P1] vendor can edit..." test's own pattern in the same file) — never shared seed data, per the `fullyParallel: true` discipline established across Stories 1.3-1.5.
- `createTestProduct`'s `overrides.stockIsPlaceholder`/`overrides.thresholdIsPlaceholder` already exist in `tests/helpers/db.ts` (added for Story 1.2's own `tests/inventory.spec.ts` coverage) — reuse them directly, no fixture-helper change needed for this story.
- Both new tests will be blocked by the pre-existing stale-Clerk-auth-fixture gap (see Dev Notes) — write them correctly per the established pattern regardless; this is the same situation Story 1.2's own dashboard test shipped into.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.6] — story definition (`grep -n "^### Story 1.6" epics.md` confirms line 169), ACs, FR13 traceability.
- [Source: _bmad-output/planning-artifacts/architecture/architecture-local-food-2026-08-10/ARCHITECTURE-SPINE.md#AD-9] — the placeholder-constants rule and the Capability → Architecture Map entry scoping FR-13 to `src/app/dashboard/products/page.tsx` only. Note: AD-9's prose describes an equality-check mechanism; the shipped implementation (Story 1.2) uses dedicated boolean flags instead — see Dev Notes for why that's the correct thing to build on, not a deviation to "fix."
- [Source: prisma/schema.prisma:35-60] — current `Product` model (read in full for this story): `stockIsPlaceholder`/`thresholdIsPlaceholder` already exist, with comments explicitly naming this story as their consumer.
- [Source: src/lib/inventory.ts] — current module (read in full for this story): `setStock()`/`setLowStockThreshold()` already clear the relevant flag on a genuine edit, already guard against clearing on a same-value resubmission (round-2 D3 fix). Nothing here needs to change.
- [Source: src/app/dashboard/products/page.tsx] — current page (read in full for this story): the table row this story adds a badge to; `products` is already fetched with no `select` narrowing, so both placeholder booleans are already in `p`.
- [Source: src/components/dashboard/EditStockControl.tsx] — current inline edit control (read in full for this story): confirms the existing PATCH → `router.refresh()` flow that will make the badge disappear for free once a flag clears server-side; also the source of this page's existing per-product `aria-labelledby` accessible-naming convention, which Task 1's badge should follow.
- [Source: src/components/ProductCard.tsx] — existing out-of-stock badge (read in full for this story): the inline-badge-markup convention Task 1 should match, and the styling this story's badge should visually distinguish itself from (see Dev Notes on color).
- [Source: docs/data-models.md] — the stale `stockIsPlaceholder`/`thresholdIsPlaceholder` doc rows Task 3 corrects.
- [Source: tests/dashboard.spec.ts] — existing dashboard Playwright coverage (read in full for this story), including the `"[P1] vendor can edit an existing product's Stock Quantity via the inline control"` test this story's Task 2 mirrors, and the `test.skip(!existsSync(authFile), ...)` / stale-session gap this story's new tests inherit.
- [Source: tests/inventory.spec.ts] — existing `setStock()`/`setLowStockThreshold()` flag-clearing coverage (read in full for this story), confirming the write-side behavior this story's AC #2 depends on is already fully tested and does not need re-testing here.
- [Source: tests/helpers/db.ts] — `createTestProduct`'s existing `stockIsPlaceholder`/`thresholdIsPlaceholder` overrides (read in full for this story) — already present, no change needed.
- [Source: _bmad-output/implementation-artifacts/1-2-stock-quantity-captured-at-creation-backfilled-for-existing-products.md] — the story that built everything this one reads from; its round-2 Review Findings document the D3 same-value-resubmission fix this story's AC #2 relies on.
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — the stale Clerk auth fixture entry this story's new tests will very likely hit.

### Review Findings (round 1, 2026-08-21, Sonnet, reviewing commit `46bbcb8`)

_Three-layer adversarial pass (Blind Hunter, Edge Case Hunter, Acceptance Auditor) against the full story diff `66de6b4..46bbcb8`. Acceptance Auditor found zero AC violations — independently verified via `grep -rn "stockIsPlaceholder\|thresholdIsPlaceholder" src/` that neither flag is read anywhere outside `page.tsx`/`inventory.ts`, confirming the story's own "never read elsewhere" claim beyond what the diff alone could prove. Two Blind Hunter findings were checked against the actual (non-diff) source and confirmed false — see the dismissed section below._

- [x] [Review][Patch] **No test exercises `thresholdIsPlaceholder` at all, and no test asserts the differentiated `title` text — the one piece of real branching logic in this diff is completely unverified.** `src/app/dashboard/products/page.tsx:8-22` (`placeholderReason`) has three return paths (both flags, stock-only, threshold-only); both new tests in `tests/dashboard.spec.ts` only ever set `stockIsPlaceholder: true`, so two of the three branches are untested, and neither test reads the badge's `title` attribute at all — only the undifferentiated visible "Needs review" string, which required no branching logic to produce.
  **RESOLVED:** Rewrote the first new test with 4 dedicated fixtures (stock-only, threshold-only, both, clean) asserting the badge's `title` attribute matches each of `placeholderReason`'s 3 non-empty branches exactly, plus the clean fixture's negative case.
- [x] [Review][Patch] **The "badge disappears" test only proves persisted state survives a hard reload — it never proves the badge disappears live, which is what AC #2 and the test's own name claim.** `tests/dashboard.spec.ts`'s second new test calls `page.reload()` before asserting the badge is gone. `EditStockControl.tsx:96` already calls `router.refresh()` on a successful save (confirmed by reading the file), which should re-render this Server Component and drop the badge without a manual reload — but nothing in the test actually exercises that path; it would pass identically even if `router.refresh()` were silently broken or removed, since the subsequent `page.reload()` would still show the correct persisted state either way.
  **RESOLVED:** Added the pre-reload assertion (badge gone immediately after the PATCH response resolves, proving the live `router.refresh()` path); kept the post-reload assertion as an additional persistence check.
- [x] [Review][Patch] **The differentiated "which field is a placeholder" information is only exposed via the native `title` attribute — inaccessible on touch devices, to keyboard users, and largely to screen readers.** `src/app/dashboard/products/page.tsx:69` (`title={placeholderReason(p)}`). `title` is mouse-hover-only; a vendor managing their shop from a phone, or using a screen reader, sees/hears only the undifferentiated "Needs review" text with no way to learn which field needs updating.
  **RESOLVED:** Added a visually-hidden (`sr-only`) span carrying `placeholderReason(p)`'s text, associated with the badge via `aria-describedby` — reuses the previously-orphaned `id` (see next finding).
- [x] [Review][Patch] **`id={`placeholder-badge-${p.id}`}` is dead code — added but never referenced by anything.** `src/app/dashboard/products/page.tsx:68`. Not used by an `aria-describedby`, not used by either new test (both use text selectors).
  **RESOLVED:** Moved the `id` onto the new `sr-only` span (renamed `placeholder-reason-${p.id}`) and pointed the badge's `aria-describedby` at it — resolved together with the accessibility finding above.
- [x] [Review][Patch] **`placeholderReason` has no internal guard against being called with both flags false — its correctness depends entirely on an external, unenforced invariant at its one call site.** `src/app/dashboard/products/page.tsx:8-22`. Called with `{ stockIsPlaceholder: false, thresholdIsPlaceholder: false }`, the function falls through both `if`s and returns the threshold message — simply wrong. Unreachable today, but the function isn't correct on its own terms, only as an appendage of its current caller.
  **RESOLVED:** Added an explicit third `if (product.thresholdIsPlaceholder)` check and a final `return ""` for the both-false case, so the function is correct standalone rather than depending on its caller's guard.
- [x] [Review][Patch] **`placeholderReason`'s parameter type is a locally duck-typed object literal instead of a shared, importable type.** `src/app/dashboard/products/page.tsx:9-12` (`product: { stockIsPlaceholder: boolean; thresholdIsPlaceholder: boolean }`). If either field is ever renamed at the schema level, this ad hoc type won't be caught by a straightforward rename/refactor the way importing `Product` from `@prisma/client` would be.
  **RESOLVED:** Changed to `Pick<Product, "stockIsPlaceholder" | "thresholdIsPlaceholder">`, importing `Product` from `@prisma/client`.

**Raised and dismissed, with reasoning:**
- *Unverified whether the products table even exposes a control for `lowStockThreshold` — if not, a threshold-flagged badge points at a dead end.* Checked directly: `EditStockControl.tsx` already has a `thresholdInput` field/label ("Low-Stock Threshold") saved together with Stock Quantity via the same PATCH/Save button (`grep -n "thresholdInput" src/components/dashboard/EditStockControl.tsx` confirms lines 38, 60, 156). The affordance exists; the finding's premise was wrong.
- *The test fixture's default `stockIsPlaceholder`/`thresholdIsPlaceholder` values are assumed `false` but never verified in this diff, so the "clean" fixture's negative assertion could be testing against a false premise.* Checked directly: `tests/helpers/db.ts:41-42` — both already default to `overrides.X ?? false`. The premise was correct; not a defect.
- *The badge is bespoke inline-styled markup rather than reusing a shared badge component.* Matches existing precedent exactly — `ProductCard.tsx`'s out-of-stock badge is equally bespoke inline Tailwind classes; no shared `Badge` component exists in this codebase to reuse instead.
- *Both new tests hardcode the vendor slug `"corner-sourdough"`, shared across parallel test workers, a latent flakiness source.* Matches the established convention every other test in this file already uses (dedicated product-level fixtures for isolation, not vendor-level) — not a new risk this diff introduces.
- *The docs change overstates completeness by not mentioning a threshold-editability gap.* Rooted in the same false premise as the first dismissed item above — the gap doesn't exist.

**Post-fix regression (2026-08-21):** `npx tsc --noEmit` clean, `npm run lint` clean ("No ESLint warnings or errors"), `npm run test:unit` 63/63 (unaffected), `npm run build` succeeds. `npx playwright test tests/dashboard.spec.ts`: 13 failed / 5 passed — identical failure set and signature as pre-fix (verified via re-run), confirming the patches introduced no new bug and remain blocked only by the documented stale-auth gap. Full `npx playwright test`: 53 passed / 17 failed — same 17 as pre-fix, zero new failures.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5

### Debug Log References

### Completion Notes List

- Task 1: Added a `placeholderReason(product)` helper and a shared "Needs review" badge to `src/app/dashboard/products/page.tsx`'s Name cell, rendered when `p.stockIsPlaceholder || p.thresholdIsPlaceholder` — one badge for either condition, never two. No new component file (matches `ProductCard.tsx`'s inline-badge convention); badge `id` keyed on `p.id`, not `p.name`, per the story's explicit callout of Story 1.5's round-1 name-keying finding. `title` attribute names which specific field(s) are still placeholders. Styled `amber` (not the storefront's out-of-stock `red`) to read as a distinct, lower-severity signal. No schema, migration, `inventory.ts`, or PATCH-route changes — confirmed by re-reading `setStock()`/`setLowStockThreshold()` that both already clear the relevant flag on a genuine edit (Story 1.2).
- Task 2: Added 2 new Playwright tests to `tests/dashboard.spec.ts`'s existing authenticated `describe` block, following the exact fixture/locator pattern of the pre-existing "[P1] vendor can edit..." test. Ran `npx playwright test tests/dashboard.spec.ts`: both new tests fail alongside the pre-existing 11 (13/13 in this file), all with the identical signature — the page renders "Sign in to LocalFood" instead of the dashboard (confirmed via each failure's `error-context.md` snapshot), matching `deferred-work.md`'s documented stale `playwright/.auth/vendor.json` session gap exactly, not an assertion failure about the badge itself. No workaround attempted, per Dev Notes' explicit instruction.
- Task 3: Updated `docs/data-models.md`'s `stockIsPlaceholder` row to name `/dashboard/products`'s badge as the read site (was: "not yet consulted by any read site as of Story 1.3").
- Full regression: `npx tsc --noEmit` clean, `npm run lint` clean ("No ESLint warnings or errors"), `npm run test:unit` 63/63 (9 files, unaffected — no `.ts` pure-function surface touched by this story), `npm run build` succeeds. Full `npx playwright test`: 53 passed / 17 failed — 15 the pre-existing documented cluster plus this story's 2 new tests, all 17 sharing the identical stale-auth signature, zero unrelated failures.

### File List

- src/app/dashboard/products/page.tsx
- tests/dashboard.spec.ts
- docs/data-models.md

## Change Log

- 2026-08-20: Implemented Story 1.6 in full. Added a shared "Needs review" badge to `/dashboard/products`, driven by the existing `Product.stockIsPlaceholder`/`thresholdIsPlaceholder` flags (both already built by Story 1.2 — no schema, migration, or write-path changes needed this story). One badge for either condition, keyed on `productId`, styled distinctly from the storefront's out-of-stock badge. Added 2 new Playwright tests to `tests/dashboard.spec.ts`; both fail alongside the pre-existing 11 in that file due to the already-documented stale Clerk auth fixture (`deferred-work.md`), confirmed via matching failure signatures, not a defect in this story's implementation. Updated one stale `docs/data-models.md` line. Full regression: typecheck clean, lint clean, 63/63 unit tests (untouched), production build succeeds, full e2e 53/70 passing with the 17 failures being the pre-existing 15 plus this story's 2 new tests, all sharing the identical stale-auth signature. Status → review.
- 2026-08-21: Round-1 review found real test-coverage gaps (only 1 of `placeholderReason`'s 3 branches was exercised, and the "badge disappears" test only proved post-reload state, never the live `router.refresh()` path AC #2 actually claims) plus a real accessibility gap (the differentiated "which field" text was `title`-only, unreachable on touch devices/screen readers) — all fixed. Also hardened `placeholderReason` to be correct standalone (explicit both-false branch instead of an unenforced caller invariant) and switched its parameter type to a `Pick<Product, ...>` import instead of a duck-typed literal. Two other Blind Hunter findings (threshold uneditable from this page; test fixture defaults unverified) were checked directly against the actual source and confirmed false. 6 Patch resolved, 0 Decision, 0 Defer. Status → review.
