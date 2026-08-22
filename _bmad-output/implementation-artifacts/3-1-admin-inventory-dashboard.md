---
baseline_commit: 8a1c74b8f56d10d0aeaa1a97be896e9dcf733567
---

# Story 3.1: Admin inventory dashboard

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,
I want to see current stock levels across all vendors,
so that I can spot problems without asking each vendor.

## Acceptance Criteria

1. Given an admin is signed in, when they visit `/admin/inventory`, then the page shows current Stock Quantity per product across all vendors, computed live at request time (Server Component fetch, no caching staleness).
2. Any product at or below its Low-Stock Threshold, or at 0, is visually flagged.
3. A non-admin visiting `/admin/inventory` is denied (reuses Story 2.1's `getCurrentAdmin()` gate).

*(FR9, AD-1, AD-6.)*

## Tasks / Subtasks

- [x] Task 1: `isLowStock()` in `src/lib/availability.ts` (AC #2)
  - [x] Add `export function isLowStock(product: { stockQuantity: number; lowStockThreshold: number }): boolean { return product.stockQuantity <= product.lowStockThreshold || product.stockQuantity === 0; }` — same file, same shape, and directly beside the existing `isInStock()` (read it in full first: it's the canonical, Prisma-free, single-source-of-truth pattern architecture AD-2 already established; this story adds the equivalent for low-stock, not a duplicate ad hoc check inline in the page).
  - [x] The `|| stockQuantity === 0` clause is defensive, not logically necessary given today's data (a threshold `>= 0` already makes `stockQuantity <= lowStockThreshold` true at `0`) — nothing in the schema enforces `lowStockThreshold >= 0` at the DB level, so keep the explicit `=== 0` branch rather than relying on that always holding. Matches epics.md's literal AC wording and `decrementStock()`'s own "defense-in-depth on paths nothing currently reaches" precedent (`src/lib/inventory.ts`).
  - [x] Do not put this in `src/lib/inventory.ts` — that file imports `@/lib/prisma` and is Prisma-only server code; `availability.ts` is deliberately kept Prisma-free so client components can import it too (read its file-header comment). `isLowStock()` has the exact same "pure, dual-usable" shape as `isInStock()`.

- [x] Task 2: `/admin/inventory` page (AC #1, #2, #3)
  - [x] New file `src/app/admin/inventory/page.tsx` (Server Component). Same gate as `src/app/admin/page.tsx`/`src/app/admin/vendors/page.tsx`: `getCurrentAdmin()`, `notFound()` if `null` — no shared layout guard exists yet (Story 2.1's deliberate per-page-gates-itself decision), match it here too. `middleware.ts`'s `/admin(.*)` matcher already covers `/admin/inventory` with zero changes needed — verify, don't re-add or duplicate the matcher entry.
  - [x] Add `export const dynamic = "force-dynamic";` at the top of the page. AC #1 explicitly requires "no caching staleness" — this is the exact fix Story 1.3's round-1 review applied to `src/app/vendors/[slug]/page.tsx` after finding a dynamic route segment with no explicit dynamic export is cache-eligible under Next 14.2's default route cache even though it reads fresh data from Prisma. Apply it proactively here rather than waiting for a review round to catch the same class of bug a second time.
  - [x] Query **all** vendors' products, not just active ones: `prisma.product.findMany({ include: { vendor: { select: { name: true, slug: true, deletedAt: true } } }, orderBy: [{ vendor: { name: "asc" } }, { name: "asc" }] })`. **Deliberate choice, not spec'd by the AC's literal text:** AC #1 says "across all vendors" with no exclusion for deactivated ones, and an admin auditing stock levels plausibly still cares about a deactivated vendor's leftover inventory (record-keeping, potential reactivation). Do not add a `where: { vendor: { deletedAt: null } }` filter — that would silently narrow "all vendors" to "all active vendors," a scope change the AC doesn't ask for. `take: 100` as a pagination safety cap (no UI for paging beyond it yet) — matches the established precedent in `src/app/dashboard/orders/page.tsx` (`take: 50`) and `src/app/admin/vendors/page.tsx` (`take: 50`, added in Story 2.3's review); this page spans every vendor's catalog rather than one vendor's or one list of vendors, so a higher cap is reasonable, but the *pattern* (cap it in the implementation pass, don't wait for review to flag an unbounded query) is the same lesson Epic 2's retrospective named explicitly — apply it now, don't reproduce the finding a third time.
  - [x] Render a table (mirror `src/app/dashboard/products/page.tsx`'s exact `<table>`/`<thead>`/`<tbody>` shape — read it in full first). Columns: Vendor, Product, Stock Quantity, Low-Stock Threshold. For a product where `isLowStock(p)` is true, add a flag next to the Stock Quantity cell.
  - [x] **The flag must be reachable by touch/keyboard/screen-reader, not a `title`-only tooltip.** This is Epic 1's own recurring accessibility gap (shipped twice, Stories 1.5 and 1.6) and Epic 2's retrospective explicitly named it as an item that was *not* repeated because new UI used accessible patterns from the start — keep that streak going. Copy `src/app/dashboard/products/page.tsx`'s exact "Needs review" badge pattern verbatim: a visible `<span>` badge plus a paired `aria-describedby`-linked `sr-only` span carrying the detail text (e.g. `"{p.stockQuantity} in stock, at or below the low-stock threshold of {p.lowStockThreshold}."`) — not a bare `title` attribute.
  - [x] If a product's vendor is deactivated (`p.vendor.deletedAt` non-null), show a small inline note next to the vendor name (e.g. "(deactivated)") so the admin has context for why an inactive vendor's row still appears — cheap, directly useful, not required by the AC but avoids a confusing unexplained row. Keep it a plain text suffix, not a second badge system.
  - [x] Empty state (`products.length === 0`) — this only happens on a fresh/unseeded DB; render a plain `<p>` message, mirroring every other list page's empty-state shape in this codebase.

- [x] Task 3: Link from `/admin/page.tsx` (housekeeping, matches established precedent)
  - [x] `src/app/admin/page.tsx` already has a comment reading "Story 3.1 adds /admin/inventory" — add a second `<Link href="/admin/inventory">` beneath the existing "Add a vendor" link, same shape, and remove/update the now-stale forward-reference comment. Mirrors exactly what Story 2.2's review added for `/admin/vendors` (`docs/api-contracts.md`/story history — don't wait for a review round to add this a second time).

- [x] Task 4: Docs sync (housekeeping, matches established precedent)
  - [x] `docs/source-tree-analysis.md`: add `admin/inventory/page.tsx` under the `admin/` entry (mirrors the existing `admin/vendors/page.tsx` row), and note `isLowStock()` alongside `isInStock()`'s existing `src/lib/availability.ts` entry. (`src/lib/availability.ts` itself had no entry in this doc yet — added the whole line, not just a note, since neither function was previously documented there.)
  - [x] No `docs/api-contracts.md` change needed — this story ships no API route (read-only Server Component page, no mutation, no new JSON endpoint). Do not invent one.
  - [x] No `docs/data-models.md` change needed — no schema change in this story (`stockQuantity`/`lowStockThreshold` already exist on `Product` since Story 1.2).

- [x] Task 5: Tests (AC #1, #2, #3)
  - [x] Unit (Vitest): `src/lib/availability.test.ts` — add `describe("isLowStock", ...)` cases mirroring the existing `isInStock` describe block's exact shape (same file, same pattern): stock below threshold → true; stock equal to threshold → true (boundary); stock above threshold → false; stock at 0 with a positive threshold → true; stock at 0 with threshold 0 → true (the placeholder-default case, AD-9).
  - [x] New file `tests/admin-inventory.spec.ts` (Playwright, mirrors `tests/admin.spec.ts`'s two-identity/two-skip-guard shape — read it in full first):
    - Admin-authenticated block (`playwright/.auth/admin.json`, `test.skip(!existsSync(adminAuthFile), ...)`, `test.describe.configure({ mode: "serial" })` — same Clerk-concurrency workaround as every other authenticated block in this codebase):
      - `[P0]` admin visits `/admin/inventory` → `200`, page renders. Use `createTestVendor()` + `createTestProduct(vendor.id, { stockQuantity: N, lowStockThreshold: M })` (both already exist in `tests/helpers/db.ts`, Stories 1.x/2.3) to seed a product with a known, deterministic stock/threshold relationship — don't rely on seeded data's stock levels, which other tests may be mutating concurrently under `fullyParallel: true`. Assert the product's Stock Quantity and Low-Stock Threshold values render.
      - `[P0]` a product at/below its threshold shows the visible flag; a product comfortably above it does not — two dedicated fixture products in the same test, same discipline as `tests/storefront-cart.spec.ts`'s out-of-stock-badge test.
      - `[P1]` a product belonging to a deactivated vendor (`createTestVendor({ deletedAt: new Date() })`) still appears in the list (proves the deliberate "all vendors, not just active" choice from Task 2).
    - Vendor-identity block (`playwright/.auth/vendor.json`): `[P0]` a signed-in vendor (not an admin) visiting `/admin/inventory` is denied — expect `404` (matches `notFound()`, same as every other admin-page-denial test in this codebase).
    - No-`storageState` case: `[P0]` a fully unauthenticated request is redirected to `/sign-in` (middleware-level denial, same shape as `tests/auth.spec.ts`'s existing `"admin requires authentication"` case — don't duplicate that test here, this file only needs the two admin-page-specific cases above it doesn't already cover).
  - [x] **Expected:** the admin-authenticated cases will self-skip in this dev environment, same as every Epic 2 story's admin-gated tests — no `E2E_ADMIN_EMAIL`/`E2E_ADMIN_CLERK_ID` configured yet (Epic 2 retrospective's still-open action item #1). This is not a defect to work around; report it honestly in the Dev Agent Record, same as every prior story.

## Dev Notes

**No schema change in this story.** `Product.stockQuantity`/`lowStockThreshold` already exist (Story 1.2), `Admin`/`getCurrentAdmin()` already exist (Story 2.1). This story is purely a new read-only page plus one small pure-function addition — resist any urge to touch `prisma/schema.prisma`.

**`getCurrentAdmin()`'s gate is proven infrastructure at this point — reuse it exactly, don't re-derive it.** Three prior pages (`/admin`, `/admin/vendors`, and now this one) all use the identical `const admin = await getCurrentAdmin(); if (!admin) notFound();` two-line gate. No shared `admin/layout.tsx` guard exists (a deliberate decision made in Story 2.1 and never revisited) — keep matching the per-page-gates-itself shape, don't introduce a layout guard unilaterally in this story.

**This is the first cross-vendor query in the entire codebase.** Every existing dashboard/storefront query scopes to one vendor (`getCurrentVendor()`'s `vendor.id`) or one admin action; this page is the first to intentionally query `Product` with no `vendorId` filter at all. Double-check the query has no accidental `where: { vendorId: ... }` copy-pasted in from a dashboard-page pattern — that would silently break AC #1's "across all vendors" requirement in a way that would still render a plausible-looking (but wrong) page.

**Carry forward Epic 2's retrospective lessons explicitly, don't wait for a review round to re-find them:**
- *Accessible flagging, not `title`-only tooltips* — Task 2 already specifies the exact accessible-badge pattern to copy. This is the one lesson Epic 2 successfully avoided repeating (per the retro); this story is new interactive-adjacent UI (a flag/badge) and should keep that streak going.
- *Pagination cap on unbounded cross-cutting queries* — Task 2 already specifies `take: 100`, matching the pattern Story 2.3's review added to `/admin/vendors` after the fact. Apply it now.
- *Doc accuracy* — Task 4 is scoped narrowly and accurately (source-tree only; explicitly no `api-contracts.md`/`data-models.md` changes, since neither is true for this story). Don't add speculative doc sections for endpoints/schema changes this story doesn't ship.

**The admin e2e credential gap (Epic 2 retro action item #1, Jeff's to resolve) is still open as of this story's creation.** Task 5's admin-authenticated tests are written to the same standard as every prior admin-gated test in this codebase and are expected to self-skip in this dev environment exactly like Stories 2.1–2.3's did — this is not a gap in this story's own test design, and should not be "fixed" by weakening the gate or the tests.

**"Visually flagged" (AC #2) is intentionally a single-tier flag, not a severity system.** The AC doesn't ask for distinct treatment of "at threshold" vs. "at 0" vs. "far below threshold" — don't invent a red/amber/yellow severity scale the AC doesn't specify. One flag, one visual treatment, matching `isLowStock()`'s single boolean return.

### Project Structure Notes

- **New:** `src/app/admin/inventory/page.tsx`, `tests/admin-inventory.spec.ts`.
- **Modified:** `src/lib/availability.ts` (`isLowStock()`), `src/lib/availability.test.ts` (new describe block), `src/app/admin/page.tsx` (new link, stale comment removed), `docs/source-tree-analysis.md`.
- Matches the architecture spine's Capability → Architecture Map exactly: *"FR-9 (Inventory Report page) | `src/app/admin/inventory/` | AD-1, AD-6"* and the Structural Seed's file-tree sketch, which already names `src/app/admin/inventory/` as this story's target directory.

### Testing Standards Summary

- Vitest for `isLowStock()` (pure function, no Prisma/Clerk) — joins `isInStock()` in the same `availability.test.ts` file, per `project-context.md`'s established pure-function-vs-Prisma testing split.
- Playwright for the page itself (touches Prisma + Clerk auth). `tests/admin-inventory.spec.ts` joins the "one file per feature area" convention.
- `test.describe.configure({ mode: "serial" })` on the admin-authenticated block — same Clerk/Playwright concurrency workaround (clerk/javascript#7891) every other authenticated block in this codebase already uses.
- Dedicated fixtures only (`createTestVendor`/`createTestProduct`, both already exist) — never assert against seeded data's stock levels, which are mutated by other tests running concurrently under `fullyParallel: true`. Never deactivate or otherwise mutate the two seeded vendors (`corner-sourdough`, `green-valley-produce`).

### ATDD Artifacts

- Checklist: `_bmad-output/test-artifacts/atdd-checklist-3-1-admin-inventory-dashboard.md`
- Unit tests: `src/lib/availability.test.ts` (extended, 5 cases — `isLowStock()`)
- E2E tests: `tests/admin-inventory.spec.ts` (new, 5 cases — 3 admin-authenticated, 1 vendor-denial, 1 fully-unauthenticated)
- Activate task-by-task per the checklist's "Next Steps" section — not all at once. Task 1 (`isLowStock()`) unblocks all 5 unit cases with no auth dependency; Task 2 (`/admin/inventory` page) unblocks all 5 E2E cases, 2 of which (vendor-404, unauthenticated-redirect) run for real immediately.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.1] — story definition, ACs, FR9 traceability.
- [Source: _bmad-output/planning-artifacts/architecture/architecture-local-food-2026-08-10/ARCHITECTURE-SPINE.md#Capability → Architecture Map] — `FR-9 | src/app/admin/inventory/ | AD-1, AD-6`.
- [Source: _bmad-output/planning-artifacts/architecture/architecture-local-food-2026-08-10/ARCHITECTURE-SPINE.md#Structural Seed] — file-tree sketch naming `src/app/admin/inventory/` as this story's target.
- [Source: _bmad-output/planning-artifacts/prds/prd-local-food-2026-08-10/addendum.md#Inventory dashboard page (FR-9)] — confirms Server Component pattern (`await prisma.*` directly in the page body), cross-vendor query scope (unlike existing `getCurrentVendor()`-scoped dashboard pages), Admin gate requirement.
- [Source: src/lib/availability.ts] — current file (read in full for this story): `isInStock()`'s exact pure-function/dual-import shape `isLowStock()` mirrors.
- [Source: src/app/dashboard/products/page.tsx] — current file (read in full for this story): the exact table shape and the accessible (`aria-describedby` + `sr-only`, not `title`-only) badge pattern this story's flag copies verbatim.
- [Source: src/app/admin/page.tsx] — current file (read in full for this story): already contains the comment "Story 3.1 adds /admin/inventory" and the existing `/admin/vendors` link this story's Task 3 mirrors.
- [Source: src/app/admin/vendors/page.tsx] — current file (read in full for this story): the `getCurrentAdmin()`/`notFound()` gate shape this story's Task 2 mirrors, and the `take: 50` pagination-cap precedent (added Story 2.3's review) this story's `take: 100` follows.
- [Source: src/middleware.ts] — current matcher (read in full for this story): confirmed `/admin(.*)` already covers `/admin/inventory`, no change needed.
- [Source: src/app/vendors/[slug]/page.tsx] — confirmed precedent for `export const dynamic = "force-dynamic"` (added Story 1.3's round-1 review after a stale-cache finding) — applied proactively here instead of waiting for the same class of finding to recur.
- [Source: _bmad-output/implementation-artifacts/2-1-admin-identity-and-access-gating.md, 2-2-admin-adds-a-vendor.md, 2-3-admin-deactivates-a-vendor.md] — the per-page admin-gate pattern, the `Admin`/`Vendor` schema shape, and every review-round finding this story's Dev Notes/Tasks proactively address instead of waiting to rediscover.
- [Source: _bmad-output/implementation-artifacts/epic-2-retro-2026-08-22.md] — the accessibility, pagination-cap, and doc-accuracy lessons this story's Tasks/Dev Notes explicitly carry forward; the still-open admin e2e credential gap this story's tests are honestly scoped against.
- [Source: tests/admin.spec.ts, tests/admin-vendors.spec.ts, tests/storefront-cart.spec.ts] — existing two-identity/two-skip-guard test pattern and the accessible-badge assertion shape this story's new test file mirrors.
- [Source: tests/helpers/db.ts] — existing `createTestVendor()`/`createTestProduct()` (read in full for this story) — both reused directly, no new fixture helper needed.
- [Source: prisma/schema.prisma] — current schema (read in full for this story) — confirms no change needed.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- No schema/migration this story — no `npx prisma migrate dev` needed.
- ATDD scaffolds (10 tests across 2 files) generated directly (no subagent dispatch — scope too small to warrant coordination risk) and activated task-by-task as each landed. **Learned from Story 2.3's own fix for the recurring activation-script bug**: activated `tests/admin-inventory.spec.ts`'s 5 test declarations by precise line-targeted `sed`, not a blanket `test.skip(` → `test(` replace — confirmed via `grep` before editing that the two `beforeEach`'s conditional-skip calls (lines 38, 146) were untouched. Zero activation-script mistakes this run — the bug flagged twice in Epic 2's retrospective (action item #2) did not recur.
- `npx tsc --noEmit` — clean after every task; exactly 1 expected red-phase error before Task 1 landed (`isLowStock` missing export), resolved the moment Task 1 shipped.
- `npm run lint` — clean.
- `npm run test:unit` — 77/77 passed (8 in `availability.test.ts`: 3 existing `isInStock` + 5 new `isLowStock`).
- `npx playwright test tests/admin-inventory.spec.ts` — 2 passed for real (vendor-denial 404, fully-unauthenticated redirect), 3 skipped (need `E2E_ADMIN_EMAIL`/`E2E_ADMIN_CLERK_ID`, still not configured in this dev environment — Epic 2 retro's still-open action item #1).
- Full `npx playwright test` — one transient flake on first run (`products-api.spec.ts`'s stockQuantity/lowStockThreshold PATCH test, unrelated to this story — passed in isolation and on a clean full-suite re-run), 90 passed / 14 skipped / 0 failures on the confirming run.
- `npm run build` — succeeds; `/admin/inventory` appears in the route table as a new dynamic (`ƒ`) route.

### Completion Notes List

- `isLowStock()` added to `src/lib/availability.ts` (pure, Prisma-free, mirrors `isInStock()`'s exact shape). `/admin/inventory` page added: `getCurrentAdmin()`/`notFound()` gate (mirrors `/admin`/`/admin/vendors`), `export const dynamic = "force-dynamic"` (proactive, per Story 1.3's precedent), cross-vendor `Product` query including deactivated vendors (deliberate AC-driven scope choice), accessible low-stock flag (visible badge + `aria-describedby`/`sr-only` detail span, not a `title`-only tooltip), `take: 100` pagination cap. Link added from `/admin/page.tsx`.
- All 10 ATDD red-phase scaffolds activated: 5 Vitest (green), 5 Playwright (2 green for real, 3 correctly skip pending the admin fixture).
- Docs synced: `docs/source-tree-analysis.md` gained the `admin/inventory/page.tsx` entry and a new `src/lib/availability.ts` entry (previously undocumented). No `api-contracts.md`/`data-models.md` changes — correctly not needed (no route, no schema change).
- **Epic 2 retrospective lessons applied proactively, not caught in review:** accessible flag pattern from the start (not a `title`-only tooltip — the a11y gap that recurred twice in Epic 1), pagination cap included in the initial implementation (not added after a review finding, as happened to `/admin/vendors` in Story 2.3), and the ATDD activation-script bug (flagged twice, Stories 2.2/2.3) was avoided this run via precise line-targeted activation instead of a blanket replace.
- Full regression: typecheck clean, lint clean, 77/77 unit, 90/104 e2e (14 expected skips, 0 failures on the confirming run — one unrelated transient flake on the first run, isolated and re-verified as pre-existing, not a regression), production build succeeds.

### File List

- `src/lib/availability.ts` (modified — `isLowStock()`)
- `src/lib/availability.test.ts` (modified — 5 new cases, activated)
- `src/app/admin/inventory/page.tsx` (new — cross-vendor inventory dashboard)
- `src/app/admin/page.tsx` (modified — added `/admin/inventory` link, updated stale forward-reference comment)
- `tests/admin-inventory.spec.ts` (new — 5 cases, activated)
- `docs/source-tree-analysis.md` (modified — `admin/inventory/page.tsx` entry, new `availability.ts` entry)
- `_bmad-output/test-artifacts/atdd-checklist-3-1-admin-inventory-dashboard.md` (new — ATDD checklist)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — status transitions)

## Change Log

- 2026-08-22: ATDD red-phase scaffolds generated (10 tests across 2 files) directly, no subagent dispatch (scope too small to warrant coordination overhead). Activated with a precise line-targeted `sed` rather than a blanket `test.skip(` → `test(` replace, specifically to avoid the activation-script bug Epic 2's retrospective flagged as recurring twice (Stories 2.2, 2.3) — confirmed via `grep` that both `beforeEach` conditional-skip calls stayed untouched. **Not pushed as a standalone commit** — implementation followed immediately in the same session, per Story 2.3's established fix for Story 2.2's CI-breaking mistake.
- 2026-08-22: Implemented Story 3.1 in full. New `isLowStock()` (`src/lib/availability.ts`), `/admin/inventory` read-only cross-vendor stock dashboard with an accessible low-stock flag and a deliberate "include deactivated vendors" scope choice, `export const dynamic = "force-dynamic"`, `take: 100` pagination cap, and a new link from `/admin/page.tsx`. All 10 ATDD scaffolds activated with zero activation-script mistakes (Epic 2 retro action item #2 addressed proactively). Docs synced. Full regression: typecheck clean, lint clean, 77/77 unit tests, 90/104 e2e (14 expected skips — same admin-credential gap as every Epic 2 story, Epic 2 retro action item #1 still open), production build succeeds. One transient e2e flake on the first full-suite run (unrelated `products-api.spec.ts` test, confirmed pre-existing via isolated re-run and a clean confirming full-suite run). Status → review.
