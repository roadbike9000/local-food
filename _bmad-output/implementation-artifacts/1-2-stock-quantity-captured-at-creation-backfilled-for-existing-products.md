# Story 1.2: Stock Quantity captured at creation, backfilled for existing products, and editable

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a vendor,
I want to set how many units of a product I have, and correct that number later,
so that the system knows my real stock, on an ongoing basis — not just once.

## Acceptance Criteria

1. Given the vendor's `AddProductForm`, when they create a new product, then Stock Quantity and Low-Stock Threshold are both required fields — no product can be created without them, no default offered for either (vendor owns their own stock).
2. Given the migration runs, then every existing product's Stock Quantity is backfilled from `isAvailable` (`true` → 100, `false` → 0) and every existing product's Low-Stock Threshold is backfilled to 0 — both via named constants (`PLACEHOLDER_STOCK_QUANTITY`, `PLACEHOLDER_LOW_STOCK_THRESHOLD`), never a hardcoded literal at the call site.
3. The Low-Stock Threshold backfill of 0 is a neutral sentinel, not a real business number — a 0 threshold means the low-stock alert (future Story 3.2) never fires until the vendor sets a real positive value themselves.
4. Given an existing product, when the vendor edits its Stock Quantity or Low-Stock Threshold via a minimal inline control on `/dashboard/products`, then the values update. This is the *only* way to correct either value after creation — no full product-edit form (name/price/description editing stays out of scope).
5. The edit goes through `setStock()` — a conditional update guarded against the value the form last loaded — so a concurrent sale decrementing the same product can't be silently clobbered by the vendor's edit. If the guard fails (someone/something changed the value first), the vendor sees an error and must reload, not silently overwrite.

## Tasks / Subtasks

- [ ] Task 1: Prisma schema + two-step backfill migration (AC: #2, #3)
  - [ ] Add `stockQuantity Int` and `lowStockThreshold Int` to the `Product` model in `prisma/schema.prisma` (both required, no `@default` — a schema-level default would apply to every future insert too, but only backfill needs it, and creation must force the vendor to choose per AC #1)
  - [ ] Generate the migration skeleton with `npx prisma migrate dev --create-only --name add_stock_quantity_and_threshold` (do **not** run the interactive `prisma migrate dev` directly on a required column with no default against a non-empty `Product` table — it will prompt for a default value interactively, which can't be scripted; `--create-only` avoids that prompt entirely)
  - [ ] Hand-edit the generated `migration.sql` to this exact sequence (order matters):
    1. `ALTER TABLE "Product" ADD COLUMN "stockQuantity" INTEGER;` (nullable for now)
    2. `ALTER TABLE "Product" ADD COLUMN "lowStockThreshold" INTEGER;` (nullable for now)
    3. `UPDATE "Product" SET "stockQuantity" = CASE WHEN "isAvailable" THEN 100 ELSE 0 END;`
    4. `UPDATE "Product" SET "lowStockThreshold" = 0;`
    5. `ALTER TABLE "Product" ALTER COLUMN "stockQuantity" SET NOT NULL;`
    6. `ALTER TABLE "Product" ALTER COLUMN "lowStockThreshold" SET NOT NULL;`
  - [ ] Add a one-line SQL comment above steps 3-4 noting these literals (`100`, `0`) must stay in sync with `PLACEHOLDER_STOCK_QUANTITY`/`PLACEHOLDER_LOW_STOCK_THRESHOLD` in `src/lib/inventory.ts` (Task 3) — raw SQL can't import a TS constant, so this is the one place AC #2's "never hardcoded at the call site" rule is necessarily broken; the comment is what keeps it from silently drifting
  - [ ] Apply with `npx prisma migrate dev` (no `--create-only` this time) so it actually runs against the dev DB and regenerates Prisma Client types
  - [ ] Do **not** touch `isAvailable` in this migration — it stays exactly as-is (still read by the checkout route and storefront listings). Dropping it is Story 1.3's job, not this one.

- [ ] Task 2: Update seed data (AC: #1 — nothing can create a `Product` without these fields anymore, including the seed script)
  - [ ] `prisma/seed.ts` creates 5 products across 2 vendors (`Corner Sourdough`: Classic Sourdough Loaf, Seeded Rye, Cinnamon Morning Bun; `Green Valley Produce`: Heirloom Tomato Box, Salad Greens Bag) via nested `products: { create: [...] }` — none currently set `stockQuantity`/`lowStockThreshold`. Once the schema requires them, `npm run db:seed` fails to typecheck. Add explicit values to all 5 (e.g. `stockQuantity: 50, lowStockThreshold: 5`) — real numbers, not the placeholder constants (this is fresh seed data being authored, not a backfill of pre-existing rows, so the placeholder sentinel doesn't apply here)

- [ ] Task 3: Create `src/lib/inventory.ts` — new module (AC: #2, #3, #5)
  - [ ] Export `PLACEHOLDER_STOCK_QUANTITY = 100`
  - [ ] Export `PLACEHOLDER_LOW_STOCK_THRESHOLD = 0`
  - [ ] Export `setStock(productId: string, newValue: number, expectedCurrentValue: number): Promise<boolean>` — conditional update per architecture AD-3: `UPDATE "Product" SET "stockQuantity" = :newValue WHERE id = :productId AND "stockQuantity" = :expectedCurrentValue`, returns `true` if a row was affected, `false` if not (someone changed it first — optimistic-lock miss, not an error to throw). Use Prisma's `updateMany` with a `where` clause matching both `id` and the expected `stockQuantity`, then check `result.count === 1`
  - [ ] Export `setLowStockThreshold(productId: string, newValue: number): Promise<void>` — plain `prisma.product.update`, no conditional guard needed (nothing else ever writes this field, so there's no concurrent-write race to protect against — don't add optimistic-locking complexity this field doesn't need)
  - [ ] `decrementStock()` is **not** part of this story — that's Story 1.4. Don't create it here; leave `inventory.ts` with just what this story needs.

- [ ] Task 4: Product creation requires the new fields (AC: #1)
  - [ ] `src/app/api/products/schema.ts` — add `stockQuantity: z.number().int().nonnegative()` and `lowStockThreshold: z.number().int().nonnegative()` to `CreateProductSchema`, both required (no `.optional()`)
  - [ ] `src/app/api/products/route.ts`'s `POST` handler needs no other change — `parsed.data` already spreads into `prisma.product.create`, so the new required fields flow through automatically once the schema requires them
  - [ ] `src/components/dashboard/AddProductForm.tsx` — add two new required number inputs (`Stock Quantity`, `Low-Stock Threshold`, both `type="number" min="0" step="1" required`), read them via `Number(formData.get(...))` alongside the existing fields, include in the POST body

- [ ] Task 5: New PATCH endpoint for editing stock (AC: #4, #5)
  - [ ] New file `src/app/api/products/[id]/route.ts` (new dynamic route — doesn't exist today, only `src/app/api/products/route.ts` does)
  - [ ] New `UpdateProductStockSchema` in a colocated `src/app/api/products/[id]/schema.ts` (mirrors the existing `schema.ts`-beside-`route.ts` pattern): `{ stockQuantity: z.number().int().nonnegative(), lowStockThreshold: z.number().int().nonnegative(), expectedStockQuantity: z.number().int().nonnegative() }` — all three required; the form always resubmits both current values together rather than tracking per-field dirty state (simpler, and `setLowStockThreshold` is cheap to call even when unchanged)
  - [ ] Handler: `getCurrentVendor()` first (401 if none) — then verify the product belongs to that vendor (`prisma.product.findFirst({ where: { id, vendorId: vendor.id } })`, 404 if not found or not theirs) — **never trust the product ID alone**, this is the same ownership-scoping discipline `project-context.md` already documents for every other vendor-scoped route
  - [ ] Call `setStock(id, body.stockQuantity, body.expectedStockQuantity)` — if it returns `false`, respond `409` with an error message the UI surfaces ("Stock changed since you loaded this page — refresh and try again"), do not retry automatically
  - [ ] If `setStock` succeeds, call `setLowStockThreshold(id, body.lowStockThreshold)`
  - [ ] Return `200` with the updated product on success
  - [ ] **Accepted non-atomicity:** these are two independent writes, not wrapped in a transaction. If `setStock` succeeds but `setLowStockThreshold` throws, the product ends up with a new stock value and a stale threshold — no rollback. Both fields are independently correct-or-not (neither's validity depends on the other), so this is acceptable for this story's scope; don't add `prisma.$transaction` complexity for a failure mode this low-stakes.

- [ ] Task 6: Inline edit UI (AC: #4, #5)
  - [ ] New client component `src/components/dashboard/EditStockControl.tsx` — takes `productId`, `initialStockQuantity`, `initialLowStockThreshold` as props; renders two small number inputs + a "Save" button (mirror `AddProductForm`'s state/error-handling shape: `submitting`, `error` state, `router.refresh()` on success)
  - [ ] On submit, `PATCH /api/products/${productId}` with `{ stockQuantity, lowStockThreshold, expectedStockQuantity: initialStockQuantity }`
  - [ ] On `409`, show the conflict error inline (`role="alert"`) — same pattern `AddProductForm` already uses for its error state
  - [ ] Wire into `src/app/dashboard/products/page.tsx`: add "Stock" and "Low-Stock Threshold" columns to the existing table, each cell rendering `<EditStockControl productId={p.id} initialStockQuantity={p.stockQuantity} initialLowStockThreshold={p.lowStockThreshold} />`
  - [ ] Do **not** touch the existing "Available" column or its `p.isAvailable` read in this story — that's Story 1.3's job

- [ ] Task 7: Update existing e2e tests that submit the add-product form (AC: #1)
  - [ ] `tests/dashboard.spec.ts`'s `"vendor can add a new product"` test (~line 132) currently fills only Name and Price — once Stock Quantity and Low-Stock Threshold are required, the form will reject submission without them. Add `.fill()` calls for both new fields before the existing `Promise.all([...])` submit block
  - [ ] **Second occurrence, easy to miss:** `"add-product form shows an error when the session has expired"` (~line 217) also fills only Name and Price before clicking "Save product" to trigger its mocked-401 assertion. Once Stock Quantity/Low-Stock Threshold are `required` HTML inputs, native browser validation blocks the click before that mocked request ever fires — same failure mode, second test. Add the same two `.fill()` calls here too, or the test breaks for the wrong reason (blocked by validation, not exercising the 401 path it's meant to test).
  - [ ] **Known limitation, not this story's to fix:** both tests (and the rest of the `vendor dashboard (authenticated)` suite) are currently blocked by a pre-existing stale Clerk auth fixture (`playwright/.auth/vendor.json`, expired — see `deferred-work.md`, deferred from Story 1.1's review). Update the test source correctly regardless; full green-run verification is blocked until that separate, already-tracked issue is resolved. Don't attempt to fix the auth fixture as part of this story — out of scope, already deferred.

- [ ] Task 8: New tests (AC: #1, #4, #5)
  - [ ] **First, fix the existing suite:** `src/app/api/products/schema.test.ts`'s shared `validBody` (currently just `{ name, priceCents }`) is parsed by all 6 existing tests, including the "rejects" cases. Once `CreateProductSchema` requires `stockQuantity`/`lowStockThreshold` (Task 4), every existing test breaks — the "rejects" tests would start failing for the wrong reason (missing required field, not the thing actually under test). Add real values (e.g. `stockQuantity: 50, lowStockThreshold: 5`) to `validBody` itself before adding anything new.
  - [ ] Then extend `schema.test.ts` with cases for the two new required fields (accepts valid, rejects missing/negative/non-integer). New `src/app/api/products/[id]/schema.test.ts` for `UpdateProductStockSchema` with the same shape of cases.
  - [ ] E2E (Playwright, `tests/dashboard.spec.ts`, needs the authenticated vendor fixture — same pre-existing limitation as Task 7 applies): a test that edits a seeded product's Stock Quantity via the new inline control and confirms the displayed value updates after `router.refresh()`.

## Dev Notes

**This story is genuinely net-new** — unlike Story 1.1, there is no existing implementation to verify. Real schema migration, new library module, new API route, new UI.

**Migration ordering is load-bearing (architecture AD-2):** `stockQuantity` must be fully backfilled *before* `isAvailable` is ever dropped. This story only adds and backfills — it must not touch or remove `isAvailable`. That happens in Story 1.3, which depends on this story having shipped first.

**`setStock()`'s conditional-update contract (architecture AD-3):** the whole point of the `expectedCurrentValue` parameter is to prevent a vendor's manual correction from silently clobbering a concurrent sale's decrement (which Story 1.4 will implement via a *different* function, `decrementStock()` — not built in this story, but its existence is why `setStock()`'s optimistic lock matters even though nothing decrements stock yet). Use Prisma's `updateMany` (not `update`) so the `WHERE` clause can include the expected-value check — a plain `update` by `id` alone has no way to express "only if it still matches."

**No stock-sufficiency/out-of-stock logic belongs in this story.** Stock Quantity existing and being editable does not mean anything reads or enforces it yet — the storefront, cart, and checkout are completely unaware of this field until Story 1.3 (marking/blocking) and Story 1.4 (decrementing) ship. Resist the urge to wire this up further than the ACs ask for.

**Placeholder values are sentinels, not real defaults.** `PLACEHOLDER_STOCK_QUANTITY = 100` and `PLACEHOLDER_LOW_STOCK_THRESHOLD = 0` exist *only* for the one-time migration backfill of pre-existing rows. They are never used as a schema `@default`, and they're never applied to a product created after this story ships (creation always requires the vendor to type real numbers — AC #1).

**Testing the backfill logic itself is limited.** The dev/test database has no real "pre-existing production data with mixed `isAvailable` states" to migrate against — `npm run db:seed` wipes and recreates all products fresh (Task 2 gives them explicit values, bypassing the backfill path entirely). The backfill SQL's correctness is verified by direct review of the migration file, not an automated test — that's an accepted limitation of migration testing in this project, not a gap to engineer around.

### Project Structure Notes

- `src/lib/inventory.ts` is a new file — matches this repo's existing `src/lib/` convention of one file per concern (`stripe.ts`, `vendor.ts`, `sms/`, etc.).
- `src/app/api/products/[id]/route.ts` and its colocated `schema.ts` are new — Next.js dynamic route convention, matches how the rest of `src/app/api/` is already structured (route logic in `route.ts`, Zod schema colocated because "Next's route-type checker only allows a fixed set of named exports from a route file" — see the existing `schema.ts`'s own header comment).
- `EditStockControl.tsx` goes in `src/components/dashboard/` alongside `AddProductForm.tsx` — same directory, same "use client" + fetch + `router.refresh()` shape.

### Testing Standards Summary

- Vitest for the two schema files (pure Zod validation, no Prisma/Clerk/server involved) — matches `schema.test.ts`'s existing pattern exactly, same `describe`/`it` shape, same "valid body + one rejection per invalid case" structure.
- Playwright for anything touching the UI or a running server — `tests/dashboard.spec.ts`, not a new file.
- Ownership-scoping discipline (`project-context.md`): the new PATCH route must filter by `vendorId: vendor.id`, never trust a product ID from the client alone — same rule every other vendor-scoped route in this codebase already follows.
- Migration hygiene (`project-context.md`): always `npm run prisma:migrate` (`prisma migrate dev`), never `prisma db push`.

### ATDD Artifacts

- Checklist: `_bmad-output/test-artifacts/atdd-checklist-1-2-stock-quantity-captured-at-creation-backfilled-for-existing-products.md`
- Unit tests: `src/app/api/products/schema.test.ts` (extended, 8 new cases), `src/app/api/products/[id]/schema.test.ts` (new, 10 cases)
- API tests: `tests/products-api.spec.ts` (new, 4 cases)
- E2E tests: `tests/dashboard.spec.ts` (extended, 1 new case)
- Component tests: none (no component-testing infra in this repo)
- Activate task-by-task per the checklist's "Next Steps" section — not all at once.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2] — story definition, ACs, FR-12 traceability.
- [Source: _bmad-output/planning-artifacts/architecture/architecture-local-food-2026-08-10/ARCHITECTURE-SPINE.md#AD-2] — migration-ordering rule (backfill before `isAvailable` drop).
- [Source: _bmad-output/planning-artifacts/architecture/architecture-local-food-2026-08-10/ARCHITECTURE-SPINE.md#AD-3] — `setStock()` conditional-update contract, `decrementStock()`/`setStock()` two-mode split.
- [Source: _bmad-output/planning-artifacts/architecture/architecture-local-food-2026-08-10/ARCHITECTURE-SPINE.md#AD-9] — both placeholder constants, shared between migration and Story 1.6's banner.
- [Source: prisma/schema.prisma] — current `Product` model (read in full for this story).
- [Source: src/app/api/products/route.ts, schema.ts, schema.test.ts] — existing creation route/schema/tests this story extends.
- [Source: src/components/dashboard/AddProductForm.tsx] — existing creation form this story extends.
- [Source: src/app/dashboard/products/page.tsx] — existing products table this story adds columns to.
- [Source: prisma/seed.ts] — existing seed data this story must update (read in full for this story).
- [Source: tests/dashboard.spec.ts] — existing add-product e2e test this story updates.
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — pre-existing stale-auth-fixture limitation that blocks full e2e verification of Task 7/8's Playwright coverage.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
