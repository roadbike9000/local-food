---
baseline_commit: 0886f74a7ad8a16da30b948f98af38d2449436f6
---

# Story 2.3: Admin deactivates a vendor

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,
I want to deactivate a vendor,
so that they stop being orderable while their order history and fulfillment are preserved.

## Acceptance Criteria

1. Given an active vendor, when the admin deactivates them, then `Vendor.deletedAt` is set and `deletedByAdminId` records the acting admin's `Admin.id` (AD-5), enforced through a shared `assertVendorActive()` guard (`src/lib/vendor.ts`, AD-4) that **throws** a typed `VendorDeactivatedError`, never returns a boolean.
2. A customer visiting a deactivated vendor's storefront (`/vendors/{slug}`) sees a "no longer available" message instead of listings — the route itself stays reachable (this is not a 404; the vendor and URL still exist, they're just not orderable). Checkout (`POST /api/checkout`) rejects any new order for that vendor's products.
3. Orders placed before deactivation, in any non-terminal status, continue their normal fulfillment lifecycle completely unchanged — pickup, SMS, status updates. The deactivated vendor's own `/dashboard/*` access is untouched by this story; they can still sign in and manage existing orders (a customer-facing block, not a vendor-facing one).
4. The vendor's `Product`/`Order` rows remain queryable (not deleted) for order history and fulfillment — `onDelete: Cascade` is removed from `Vendor → Product` and `Vendor → Order` (`Vendor → PickupSlot` is untouched; out of this AC's explicit scope).

*(FR4, AD-4.)*

## Tasks / Subtasks

- [x] Task 1: Prisma schema + migration (AC #1, #4)
  - [x] Add `Vendor.deletedAt DateTime?` (nullable, no default — `null` means active; no backfill needed, every existing row stays active).
  - [x] Add `Vendor.deletedByAdminId String?` + a named relation to `Admin`, mirroring `createdByAdminId`'s exact shape from Story 2.2: `@relation("VendorDeletedByAdmin", fields: [deletedByAdminId], references: [id], onDelete: SetNull)`. This is the second `Vendor → Admin` relation — Story 2.2 deliberately named the first one (`VendorCreatedByAdmin`) in anticipation of this, so no rename is needed now.
  - [x] Prisma requires the back-relation on `Admin` too: add `deletedVendors Vendor[] @relation("VendorDeletedByAdmin")`.
  - [x] Change `Product.vendor`'s relation from `onDelete: Cascade` to `onDelete: Restrict`, and `Order.vendor`'s the same. `vendorId` is `NOT NULL` on both, so `SetNull` isn't an option — `Restrict` means a hard `DELETE` on a `Vendor` row with existing `Product`/`Order` rows fails at the DB level instead of silently cascading. This is defense-in-depth: nothing in this app ever calls `prisma.vendor.delete()` (deactivation is exclusively soft-delete via `deletedAt`), but `Restrict` makes an accidental future hard-delete fail loudly instead of quietly destroying order history.
  - [x] **Do not touch `PickupSlot.vendor`'s relation** — the AC's cascade-removal is scoped to `Product`/`Order` only; leave `PickupSlot` cascading as-is.
  - [x] Run `npx prisma migrate dev --name vendor_deactivation` directly — two new nullable columns plus two `onDelete` changes, no data migration.

- [x] Task 2: `assertVendorActive()` + `VendorDeactivatedError` in `src/lib/vendor.ts` (AC #1, #2, AD-4)
  - [x] `export class VendorDeactivatedError extends Error {}` — a typed error, not a generic `Error`, so callers can `instanceof`-check it specifically.
  - [x] `export function assertVendorActive(vendor: Vendor): void` — throws `VendorDeactivatedError` if `vendor.deletedAt` is non-null, returns normally (no return value) otherwise. Matches AD-4's explicit contract: "the sole check... throws... never returns a boolean." Callers wrap it in `try/catch`, not an `if` check.

- [x] Task 3: `POST /api/admin/vendors/[id]/deactivate` route (AC #1)
  - [x] New file `src/app/api/admin/vendors/[id]/deactivate/route.ts`. `getCurrentAdmin()` first — `401 { error: "Unauthorized" }` if `null` (same pattern as every other admin route; still not covered by `middleware.ts`'s matcher, same reasoning as Story 2.2's `POST /api/admin/vendors`).
  - [x] `prisma.vendor.findFirst({ where: { id: params.id } })` — `404 { error: "Not found" }` if missing. (No ownership scoping needed here — unlike vendor-scoped routes, an admin route legitimately operates across all vendors; this is intentionally different from `getCurrentVendor()`-gated routes' `vendorId: vendor.id` filtering.)
  - [x] **Idempotent, not an error, on a vendor that's already deactivated**: if `vendor.deletedAt` is already set, return `200 { vendor }` with the row as-is — do **not** overwrite `deletedByAdminId` with whichever admin double-clicked or retried. Only a genuinely active vendor (`deletedAt: null`) gets updated: `prisma.vendor.update({ where: { id }, data: { deletedAt: new Date(), deletedByAdminId: admin.id } })`.
  - [x] Return `200 { vendor: <the current, possibly-just-updated row> }`.
  - [x] No un-deactivate/reactivate endpoint — explicitly out of this story's scope (not in any AC, no PRD requirement for it).

- [x] Task 4: Storefront integration (AC #2)
  - [x] `src/app/vendors/[slug]/page.tsx`: after the existing `if (!vendor) notFound()` check, call `assertVendorActive(vendor)` wrapped in `try/catch`. On `VendorDeactivatedError`, render a "no longer available" message (e.g. `<h1>{vendor.name}</h1><p>This vendor is no longer available.</p>`) **instead of** the pickup-slot banner and product listing — not `notFound()`, the page itself must stay a real `200` response with the vendor's name still shown, per AC #2's explicit "sees a message instead of listings," not "sees a 404." Re-throw any other error (a `VendorDeactivatedError`-only catch, not a bare catch-and-swallow).

- [x] Task 5: Checkout integration (AC #2)
  - [x] `src/app/api/checkout/route.ts`: add a `prisma.vendor.findUnique({ where: { id: vendorId } })` lookup — this route currently never fetches the `Vendor` row at all, only `Product`s filtered by `vendorId`. Add this **before** the existing product query (fail fast on a bad/deactivated vendor without bothering to query products). Missing vendor → `400 { error: "One or more items are unavailable" }` (reuse the existing message — a nonexistent `vendorId` and a nonexistent product already share this message today, staying consistent). Found vendor → call `assertVendorActive(vendor)` in a `try/catch`; on `VendorDeactivatedError`, return `400 { error: "This vendor is no longer accepting orders" }` (a new, more specific message — matches AD-4's "checkout API catches it and returns the existing 4xx error-JSON shape used elsewhere in that route," i.e. the same `400 { error }` shape, not a new status code).

- [x] Task 6: Admin vendor list + deactivate UI (AC #1)
  - [x] Extend `src/app/admin/vendors/page.tsx` (Story 2.2's existing page — don't create a new route): below the existing `AddVendorForm`, add a table listing **every** vendor (`prisma.vendor.findMany({ orderBy: { createdAt: "desc" } })`, no `deletedAt` filter — the admin needs to see deactivated vendors too, not just active ones), mirroring `src/app/dashboard/products/page.tsx`'s table shape (`<table>`/`<thead>`/`<tbody>`, one row per vendor). Columns: Name, Slug, Status. Status column: a deactivated vendor shows a static "Deactivated" label (no button — nothing to do, no reactivate feature exists); an active vendor shows a `DeactivateVendorButton` (Task 6b).
  - [x] New client component `src/components/admin/DeactivateVendorButton.tsx`. `window.confirm("Deactivate {vendor.name}? Customers won't be able to order from them anymore.")` before submitting — this codebase has no existing `confirm()` precedent, but the action has a real customer-facing consequence (blocks checkout platform-wide for that vendor) and is only reversible via direct DB access (no reactivate UI), so a native confirmation is warranted here specifically, not a pattern to reach for by default elsewhere. On confirm, `POST /api/admin/vendors/${vendorId}/deactivate`, then `router.refresh()` on success. Mirror `AddVendorForm.tsx`'s `submitting`/`error` state shape and `401` handling ("Your session expired. Sign in again.").

- [x] Task 7: Test helper (needed by Task 8)
  - [x] `tests/helpers/db.ts`: add `createTestVendor(overrides)` — mirrors `createTestProduct`'s shape (timestamped unique `name`/`slug` by default, `deletedAt`/`deletedByAdminId` as optional overrides for fixtures that need to start pre-deactivated without going through the real deactivate route). `deleteVendorBySlug` (already exists, Story 2.2) is the matching cleanup — safe to call directly on a throwaway vendor with no `Product`/`Order` children (Task 1's new `Restrict` constraint only blocks a hard-delete when children exist; a bare fixture vendor never has any).

- [x] Task 8: Tests (AC #1, #2, #3, #4)
  - [x] New file `tests/admin-deactivate-vendor.spec.ts` (API-level, mirrors `tests/admin-vendors-api.spec.ts`'s two-identity pattern — admin fixture for the success/idempotency/404 cases, vendor fixture for the 401 case, plus one fully-unauthenticated case needing neither, per Story 2.2's review-added pattern):
    - `[P0]` admin deactivates an active `createTestVendor()` fixture → `200`, `deletedAt` set, `deletedByAdminId` matches the acting admin's `Admin.id` (read-back verified, same pattern as Story 2.2's creation test).
    - `[P0]` deactivating an already-deactivated vendor is idempotent → `200`, `deletedByAdminId` **unchanged** from whoever deactivated it originally (the specific behavior Task 3 requires — prove it, don't just assert `200`).
    - `[P0]` deactivating a nonexistent vendor id → `404`.
    - `[P0]` signed-in vendor (not admin) → `401`.
    - `[P0]` fully unauthenticated request → `401`.
  - [x] `tests/storefront-cart.spec.ts`: `[P0]` a deactivated vendor's storefront (`createTestVendor({ deletedAt: new Date() })`) shows the "no longer available" message, no product listing, no pickup-slot banner. Uses a throwaway fixture vendor — **never** deactivate `corner-sourdough`/`green-valley-produce`, every other test in this suite depends on them staying orderable.
  - [x] `tests/checkout-api.spec.ts`: `[P0]` checkout against a deactivated vendor's product → `400`, error matches `/no longer accepting orders/i`, no `Order` row created. Same throwaway-fixture discipline — this test needs its own `createTestProduct` under the throwaway deactivated vendor, not a seeded one.
  - [x] No test needed for AC #3 (order lifecycle unaffected) beyond what already exists — nothing in this story changes any order-status/SMS code path; the claim is provable by inspection (Tasks 1-6 touch no order-lifecycle file), not a new automated assertion.

- [x] Task 9: Docs sync (housekeeping, matches established precedent)
  - [x] `docs/api-contracts.md`: add a `POST /api/admin/vendors/[id]/deactivate` section (request/response shape, idempotency behavior, auth note). Update the checkout section's behavior list with the new vendor-active check. Update the auth-model bullet for admin routes if relevant.
  - [x] `docs/data-models.md`: add `deletedAt`/`deletedByAdminId` rows to `Vendor`'s table, update its Relations line to include `deletedByAdmin?`, update `Admin`'s Relations line to include `deletedVendors[]`. Update `Product`/`Order`'s `vendor` relation notes if they mention `onDelete: Cascade` anywhere.
  - [x] `docs/source-tree-analysis.md`: add the new `api/admin/vendors/[id]/deactivate/route.ts` and `admin/DeactivateVendorButton.tsx` entries, matching the treatment Stories 2.1/2.2 gave their own new files there.

## Dev Notes

**Decision made during this story's planning (not left to the dev agent):** Story 2.2's review flagged that `resolveVendorSlug()` will make a deactivated vendor's slug permanently unreusable once `deletedAt` exists (it checks uniqueness against *all* vendors, with no `deletedAt` filter). The user was asked directly and chose to **leave this as-is** — slugs stay permanently reserved even after deactivation, to avoid a bookmarked/shared storefront URL suddenly showing an unrelated business if the slug were ever recycled. **Do not add a `deletedAt` filter to `resolveVendorSlug()`'s uniqueness check in this story** — that door was deliberately not opened. `deferred-work.md`'s original note on this is now resolved with this decision.

**AD-4's contract is "throws, never returns a boolean" — follow it literally.** `assertVendorActive()` must not return `true`/`false`; every call site wraps it in `try/catch`, mirroring how this codebase already handles the Stripe webhook's typed error paths. Resist the urge to make it return a boolean "for convenience" — the architecture spine is explicit that this is the whole point of the design (one shared guard, one contract, no route re-implementing the `deletedAt` condition inline).

**Vendor dashboard access is completely untouched by this story.** AC #3 requires existing orders to keep their normal fulfillment lifecycle, which requires the vendor to still be able to sign into `/dashboard` and mark orders `READY`/`COMPLETED` after deactivation. Nothing in `getCurrentVendor()`, `middleware.ts`, or any `/dashboard/*` page should change. Only two places gate on vendor-active status: the public storefront (Task 4) and checkout (Task 5) — both customer-facing, not vendor-facing.

**The checkout route currently doesn't fetch the `Vendor` row at all** (verified by reading the file in full for this story) — it only queries `Product`s filtered by `vendorId`. Task 5 adds the first `Vendor` lookup this route has ever needed. Don't be surprised there's no existing pattern to mirror for "vendor not found" in this specific file; the chosen message (reusing the existing "One or more items are unavailable" string) keeps the error space small rather than inventing a new message for a case that's practically indistinguishable from "the vendor id was wrong" to the caller.

**Idempotency on the deactivate route is a deliberate design choice, not an oversight.** A double-click or a retried request must not silently reassign `deletedByAdminId` to a different admin than whoever actually made the call the first time — that would make the attribution field (AD-5) lie about who did it. Check-then-conditionally-update, not a blind `update`.

**No reactivate feature.** Nothing in any AC or the PRD's Non-Goals asks for one. If a vendor needs reactivating, that's direct DB access today — same out-of-band posture Story 2.2 established for binding an admin-created vendor's `clerkUserId`.

### Project Structure Notes

- **New:** `src/app/api/admin/vendors/[id]/deactivate/route.ts`, `src/components/admin/DeactivateVendorButton.tsx`, `tests/admin-deactivate-vendor.spec.ts`.
- **Modified:** `prisma/schema.prisma` (`Vendor.deletedAt`/`deletedByAdminId` + relation, `Admin.deletedVendors` back-relation, `Product`/`Order`'s `onDelete: Restrict`), `src/lib/vendor.ts` (`assertVendorActive()`, `VendorDeactivatedError`), `src/app/vendors/[slug]/page.tsx`, `src/app/api/checkout/route.ts`, `src/app/admin/vendors/page.tsx` (vendor list table added alongside the existing form), `tests/helpers/db.ts` (`createTestVendor`), `tests/storefront-cart.spec.ts`, `tests/checkout-api.spec.ts`, three docs files.
- Matches the architecture spine's Capability → Architecture Map: *"FR-3, FR-4 (vendor add/deactivate) | `src/app/admin/vendors/`, `src/lib/vendor.ts` | AD-1, AD-4, AD-5, AD-6, AD-7, AD-8"* — this story covers the FR-4 (deactivate) half; Story 2.2 already covered FR-3 (add).

### Testing Standards Summary

- Playwright only — no new Vitest surface (no new Zod schema; the deactivate route takes no request body).
- `tests/admin-deactivate-vendor.spec.ts` reuses both existing auth fixtures (`playwright/.auth/admin.json`, `playwright/.auth/vendor.json`) plus a fully-unauthenticated case with no `storageState` at all — the exact three-way pattern Story 2.2's review established in `tests/admin-vendors-api.spec.ts`. Copy that file's structure (two `test.describe` blocks with independent `existsSync ? file : undefined` skip guards, plus one top-level unauthenticated test), don't reinvent it.
- **Never deactivate a seeded vendor** (`corner-sourdough`, `green-valley-produce`) in any test — every other test file in this suite assumes both stay orderable. Every deactivation-related test must use `createTestVendor()` (Task 7) and clean up via `deleteVendorBySlug()`.
- `test.describe.configure({ mode: "serial" })` on any block sharing a Clerk session, same established reasoning (clerk/javascript#7891).

### ATDD Artifacts

- Checklist: `_bmad-output/test-artifacts/atdd-checklist-2-3-admin-deactivates-a-vendor.md`
- API tests: `tests/admin-deactivate-vendor.spec.ts` (new, 5 cases — all P0), `tests/checkout-api.spec.ts` (extended, 1 case)
- E2E tests: `tests/storefront-cart.spec.ts` (extended, 1 case)
- Fixture built ahead of subagent dispatch (avoiding Story 2.2's coordination race): `tests/helpers/db.ts`'s `createTestVendor()`
- Activate task-by-task per the checklist's "Next Steps" section — not all at once. Note: no dedicated UI-level E2E scaffold exists for Task 6's deactivate button (the ATDD test plan only covers the API route + the two customer-facing integration points); verify the button manually or add coverage separately if desired.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.3] — story definition, ACs, FR4 traceability.
- [Source: _bmad-output/planning-artifacts/architecture/architecture-local-food-2026-08-10/ARCHITECTURE-SPINE.md#AD-4] — `assertVendorActive()`'s exact contract (throws, typed error, storefront/checkout catch it and render/return their own error shapes).
- [Source: _bmad-output/planning-artifacts/architecture/architecture-local-food-2026-08-10/ARCHITECTURE-SPINE.md#Structural Seed] — confirms `Vendor → Product`/`Vendor → Order` drop `onDelete: Cascade`, cites `prisma/schema.prisma:46,82` (line numbers stale, fields since renumbered by Stories 2.1/2.2 — verify by field name, not line number).
- [Source: _bmad-output/implementation-artifacts/2-2-admin-adds-a-vendor.md] — `createdByAdminId`'s exact relation shape (`deletedByAdminId` mirrors it), `resolveVendorSlug()`, `AddVendorForm.tsx`'s state/error pattern `DeactivateVendorButton` mirrors, and the deferred-work decision about slug reuse this story's planning resolved.
- [Source: src/lib/vendor.ts] — current file (read in full for this story): `getCurrentVendor()`, `resolveVendorSlug()`. `assertVendorActive()`/`VendorDeactivatedError` join it.
- [Source: src/app/api/checkout/route.ts] — current file (read in full for this story) — confirmed it never fetches `Vendor` today; Task 5 adds the first lookup.
- [Source: src/app/vendors/[slug]/page.tsx] — current file (read in full for this story) — the exact `notFound()`/rendering shape Task 4 extends.
- [Source: src/app/admin/vendors/page.tsx, src/components/admin/AddVendorForm.tsx] — current files (read in full for this story) — Task 6 extends the page, Task 6b's button mirrors the form's state/error shape.
- [Source: src/app/dashboard/products/page.tsx] — the exact table pattern Task 6's vendor list mirrors.
- [Source: prisma/schema.prisma] — current schema (read in full for this story).
- [Source: tests/admin-vendors-api.spec.ts] — the exact three-identity test-file pattern (admin/vendor/unauthenticated) Task 8's new file copies.
- [Source: tests/checkout-api.spec.ts, tests/storefront-cart.spec.ts] — current files (read in full for this story) — both are public, unauthenticated test files; Task 8's new cases join them directly, no new fixture gating needed.
- [Source: tests/helpers/db.ts] — existing `createTestProduct`/`deleteVendorBySlug` (read in full for this story) — `createTestVendor` mirrors the former's shape.
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — the slug-reuse-after-soft-delete item this story's planning resolved.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- Migration: `npx prisma migrate dev --name vendor_deactivation` — two new nullable `Vendor` columns plus `Product`/`Order`'s `vendor` relation flipped from `Cascade` to `Restrict`. Applied and verified directly (`DROP CONSTRAINT`/`ADD CONSTRAINT ... ON DELETE RESTRICT` for both, `ADD COLUMN "deletedAt"`/`"deletedByAdminId"` + FK to `Admin` with `ON DELETE SET NULL`).
- ATDD scaffolds (6 tests across 3 files, generated in a prior workflow run) activated task-by-task as each landed. **Process fix applied this time, learned from Story 2.2:** did not push the red-phase scaffolds as a standalone commit — implemented straight through to green before the first push, so `main` never saw the intentional red-phase errors.
- **Bug caught and fixed during activation, same class as Story 2.2's:** the blanket `test.skip(` → `test(` activation script again caught two `beforeEach` conditional-skip calls (`test.skip(!existsSync(...), ...)`) in `tests/admin-deactivate-vendor.spec.ts`, converting them to invalid `test(...)` calls. Caught immediately via a full-file grep/read after each activation and fixed back to `test.skip(`. Worth flagging forward: this activation script is now 2-for-2 on this exact mistake — a future story should activate scaffold test declarations with a more targeted method (e.g. matching only `test.skip(\n      "` with a leading indent/quote, not any `test.skip(`) rather than a blanket string replace.
- `npx tsc --noEmit` — clean after every task.
- `npm run lint` — clean.
- `npm run test:unit` — 72/72 passed (unaffected — no new Zod schema this story).
- `npx playwright test tests/admin-deactivate-vendor.spec.ts` — 2 passed for real (vendor-401, fully-unauthenticated-401), 3 skipped (need `E2E_ADMIN_EMAIL`/`E2E_ADMIN_CLERK_ID`, still not configured in this dev environment).
- `npx playwright test tests/storefront-cart.spec.ts -g "no longer available"` — 1 passed for real.
- `npx playwright test tests/checkout-api.spec.ts -g "deactivated vendor"` — 1 passed for real.
- Full `npx playwright test` — 88 passed, 11 skipped (8 pre-existing admin-fixture-gated cases from Stories 2.1/2.2 + 3 new ones from this story), 0 failures, 0 regressions.
- `npm run build` — succeeds; `/admin/vendors` (extended) and `/api/admin/vendors/[id]/deactivate` (new) appear in the route table.
- **Known gap, noted rather than glossed over:** Task 6's admin vendor-list table + `DeactivateVendorButton` has no dedicated E2E coverage (the ATDD test plan only scoped the API route + the two customer-facing integration points, not a UI-level test of the button itself — see the ATDD checklist's own "Next Steps" note). Not manually browser-verified either, since doing so requires the same `E2E_ADMIN_EMAIL`/`E2E_ADMIN_CLERK_ID` credentials that are absent from this dev environment. The component's markup was written by direct, careful mirroring of `AddVendorForm.tsx`'s already-proven state/error/401 shape (same file this story's own code review will be able to cross-check line by line), and `npx tsc --noEmit`/`npm run build` both confirm it compiles and renders in the route tree — but "renders without crashing" is not the same as "verified working," and this note says so explicitly rather than claiming more than what was actually checked.

### Completion Notes List

- `Vendor.deletedAt`/`deletedByAdminId` added, `Product`/`Order`'s `vendor` relation changed from `Cascade` to `Restrict` (`PickupSlot`'s left untouched, per the AC's explicit scope), `assertVendorActive()`/`VendorDeactivatedError` added to `src/lib/vendor.ts`, `POST /api/admin/vendors/[id]/deactivate` (idempotent), storefront + checkout integration, admin vendor-list UI + `DeactivateVendorButton`.
- All 6 ATDD red-phase scaffolds activated: 5 API-level (2 ran green for real, 3 correctly skip pending the admin fixture), 1 E2E (ran green for real).
- Docs synced across three files: `api-contracts.md` gained a full `POST /api/admin/vendors/[id]/deactivate` section and an updated checkout behavior list, `data-models.md`'s `Vendor`/`Admin`/`Product`/`Order` sections all updated (including the `Cascade`→`Restrict` change on two relations), `source-tree-analysis.md` gained the new route/component entries.
- Full regression: typecheck clean, lint clean, 72/72 unit, 88/99 e2e (11 expected skips, all needing the not-yet-configured Admin Clerk test credentials), build succeeds.

### File List

- `prisma/schema.prisma` (modified — `Vendor.deletedAt`/`deletedByAdminId` + relation, `Admin.deletedVendors` back-relation, `Product`/`Order`'s `onDelete: Restrict`)
- `prisma/migrations/20260822113848_vendor_deactivation/migration.sql` (new)
- `src/lib/vendor.ts` (modified — `assertVendorActive()`, `VendorDeactivatedError`)
- `src/app/api/admin/vendors/[id]/deactivate/route.ts` (new — `POST` handler, idempotent)
- `src/app/vendors/[slug]/page.tsx` (modified — deactivated-vendor branch)
- `src/app/api/checkout/route.ts` (modified — vendor lookup + active check, first `Vendor` fetch this route has ever had)
- `src/app/admin/vendors/page.tsx` (modified — vendor list table added alongside Story 2.2's existing form)
- `src/components/admin/DeactivateVendorButton.tsx` (new — first `window.confirm()` in this codebase)
- `tests/admin-deactivate-vendor.spec.ts` (new — 5 cases, activated)
- `tests/checkout-api.spec.ts` (modified — 1 case, activated)
- `tests/storefront-cart.spec.ts` (modified — 1 case, activated)
- `tests/helpers/db.ts` (modified — `createTestVendor`, built ahead of the ATDD subagent dispatch)
- `docs/api-contracts.md`, `docs/data-models.md`, `docs/source-tree-analysis.md` (modified)
- `_bmad-output/test-artifacts/atdd-checklist-2-3-admin-deactivates-a-vendor.md` (new — ATDD checklist)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — status transitions)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified — the "DECIDED" resolution note for the slug-reuse-after-soft-delete item)

**Added in the 2026-08-22 review follow-up:**

- `src/app/api/admin/vendors/[id]/deactivate/route.ts` (modified — replaced check-then-act `findFirst`/conditional-`update` with an atomic `updateMany({ where: { id, deletedAt: null } })` claim + `findUnique` re-read, matching `webhooks/stripe/route.ts`'s `stockDecremented` claim pattern)
- `tests/admin-deactivate-vendor.spec.ts` (modified — idempotency test's fake `deletedByAdminId: "some-other-admin-id"` replaced with a real second `Admin` row, created and cleaned up in the test itself; the fake string violated the new FK constraint and would have failed every run once the admin fixture is configured)
- `src/app/page.tsx` (modified — homepage vendor directory now filters `where: { deletedAt: null }`, so a deactivated vendor no longer appears in public listings)
- `tests/helpers/db.ts` (modified — `createTestVendor()`'s default uniqueness suffix is no longer `Date.now()` alone, now includes a random component to avoid a same-millisecond collision under `fullyParallel: true`; `deleteVendorBySlug()` gained a comment noting the new `Restrict` constraint's child-deletion-order requirement)
- `src/app/admin/vendors/page.tsx` (modified — added `take: 50` to the vendor-list query, matching `dashboard/orders/page.tsx`'s pagination-cap precedent)
- `tests/storefront-cart.spec.ts` (modified — the deactivated-vendor test now gives the fixture vendor a real product and pickup slot before deactivating, so the "no listing/banner" assertions prove the deactivation branch actually suppresses them rather than passing vacuously against an empty fixture)
- `docs/api-contracts.md` (modified — checkout section's "before anything else runs" corrected to "before the product query"; the deactivate-route section rewritten to describe the atomic-claim behavior instead of the old check-then-act shape)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified — new forward-looking item: a deactivated vendor can still create `Product`/`PickupSlot` rows via their own untouched dashboard, since neither route calls `assertVendorActive()`; explicitly out of this story's scope)

## Change Log

- 2026-08-22: ATDD red-phase scaffolds generated (6 tests across 3 files) via two parallel subagents, both independently verified before landing; the `createTestVendor`/`deleteVendorBySlug` fixture dependency was built by the orchestrator *before* dispatching either subagent, specifically to avoid the coordination race Story 2.2's ATDD run hit. **Not pushed as a standalone commit** — implementation followed immediately in the same session, learning from Story 2.2's CI-breaking mistake.
- 2026-08-22: Implemented Story 2.3 in full. New `Vendor.deletedAt`/`deletedByAdminId` (AD-4/AD-5), `Product`/`Order`'s `onDelete: Restrict` (was `Cascade`), `assertVendorActive()`/`VendorDeactivatedError`, `POST /api/admin/vendors/[id]/deactivate` (idempotent), storefront "no longer available" branch, checkout rejection, admin vendor-list UI with a `DeactivateVendorButton`. All 6 ATDD scaffolds activated — repeated (and caught/fixed) the same activation-script bug from Story 2.2's run (blanket `test.skip()` conversion briefly broke a `beforeEach` conditional-skip call), flagged forward for a future story to fix the activation method itself. Docs synced across three files. Full regression: typecheck clean, lint clean, 72/72 unit tests, 88/99 e2e (11 expected skips — same admin-credential gap as Stories 2.1/2.2), production build succeeds. One known gap noted honestly: Task 6's admin UI has no dedicated E2E coverage and wasn't manually browser-verified (both would need the same missing admin credentials) — code was written by direct, careful mirroring of an already-proven pattern, not left to guesswork, but that's not the same claim as "verified." Status → review.
- 2026-08-22 (round-1 review): 3-layer Opus adversarial review (Blind Hunter, Edge Case Hunter, Acceptance Auditor) found and fixed one real concurrency bug and several smaller correctness/quality gaps. **Fixed:** (1) the deactivate route's check-then-act race — two concurrent requests could both observe `deletedAt: null` and both write, the second silently reassigning `deletedByAdminId` away from the original deactivator, violating AD-5 and the story's own idempotency requirement; rewritten as an atomic `updateMany` claim, independently reproduced pre-fix via a throwaway script against the real dev DB. (2) the idempotency test's fake admin-id fixture, which would have failed every run with a Prisma `P2003` foreign-key violation once admin credentials are configured — reproduced directly, fixed with a real second `Admin` row. (3) the homepage listing deactivated vendors with live product counts and working storefront links. (4) `createTestVendor()`'s `Date.now()`-only uniqueness, a same-millisecond collision risk under `fullyParallel: true`. (5) the admin vendor list's unbounded query, now capped with `take: 50`. (6) a doc-accuracy overstatement in `api-contracts.md` ("before anything else runs") and a stale description of the pre-fix check-then-act route shape. (7) `storefront-cart.spec.ts`'s deactivated-vendor test, whose "no listing" assertions were vacuous against a fixture with zero products/pickup-slots — now gives the fixture a real product and pickup slot first. **Dismissed, with reasoning:** the webhook/checkout races against an in-flight deactivation (both match already-accepted, already-documented point-in-time-check limitations elsewhere in this codebase); `assertVendorActive()` taking the full `Vendor` type (no current caller blocked); the deactivate route returning the full `Vendor` row (matches Story 2.2's already-accepted identical precedent); `DeactivateVendorButton`'s un-awaited `router.refresh()`/immediate `setSubmitting(false)` re-enable (the route is now idempotent, so a stray double-click before the refresh lands is harmless, not a correctness bug). **Deferred, logged in `deferred-work.md`:** a deactivated vendor can still create new `Product`/`PickupSlot` rows via their own untouched dashboard — real gap, explicitly out of this story's stated scope. Full regression clean after all fixes: typecheck, lint, 72/72 unit, 88/99 e2e (11 expected skips), build succeeds. Status → done.
