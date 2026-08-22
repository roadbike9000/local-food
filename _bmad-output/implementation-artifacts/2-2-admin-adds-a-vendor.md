---
baseline_commit: be4f2ded307a91bd9cfea4d33fbcc843f007fc39
---

# Story 2.2: Admin adds a vendor

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,
I want to onboard a new vendor onto the platform,
so that they can start selling without self-registering.

## Acceptance Criteria

1. Given the admin vendor-creation form (`/admin/vendors`), when the admin submits name, slug, and contact info, then a new `Vendor` record is created with `clerkUserId: null` (unbound until claimed, AD-8) and `createdByAdminId` set to the acting admin's `Admin.id` (not `Admin.clerkUserId` — AD-5's attribution FK targets the row id).
2. A slug that collides with an existing vendor is rejected with a friendly error via `resolveVendorSlug()` (new, `src/lib/vendor.ts`, AD-7) — never a raw Prisma unique-constraint failure surfaced to the admin.
3. The new vendor gets a live storefront at `/vendors/{slug}` immediately — no separate "publish" step. The existing storefront page (`src/app/vendors/[slug]/page.tsx`) needs no changes to serve it; a vendor with zero products/pickup slots already renders correctly (verified against current code, not assumed).
4. No new external dependency is introduced (NFR4) — this reuses Clerk gating already built in Story 2.1 and the existing `fetch()`-to-API-route write pattern (`AddProductForm.tsx`'s shape).

*(FR3, AD-5, AD-7, AD-8.)*

## Tasks / Subtasks

- [x] Task 1: Prisma schema + migration (AC #1)
  - [x] `Vendor.clerkUserId`: `String @unique` → `String? @unique` (AD-8 — admin-created vendors start unbound; Postgres/Prisma allow multiple `NULL`s under a unique index, so this doesn't break uniqueness for already-claimed vendors).
  - [x] Add `Vendor.createdByAdminId String?` + a relation to `Admin`. **Use an explicitly named relation now** (`@relation("VendorCreatedByAdmin", fields: [createdByAdminId], references: [id], onDelete: SetNull)`) — Story 2.3 adds a second `Vendor → Admin` relation (`deletedByAdminId`), and Prisma requires distinct names once there are two relations between the same two models. Naming this one now avoids a rename-migration when 2.3 lands. `onDelete: SetNull` (not `Restrict`/`Cascade`) — losing attribution if an `Admin` row were ever deleted is acceptable (AD-5: attribution is informational, not an audit log); it must not block deleting the `Admin` row or cascade-delete the `Vendor`.
  - [x] Prisma requires the back-relation on `Admin` too: add `createdVendors Vendor[] @relation("VendorCreatedByAdmin")`.
  - [x] No backfill needed — existing seeded vendors already have real `clerkUserId` values; this migration only relaxes a constraint and adds a new nullable column. Run `npx prisma migrate dev --name vendor_admin_creation` directly (no `--create-only`/hand-editing needed, unlike Story 1.2's required-column backfill).
  - [x] **Do not touch `Vendor.deletedAt`/`deletedByAdminId`** — those are Story 2.3's fields, not this story's.

- [x] Task 2: `resolveVendorSlug()` in `src/lib/vendor.ts` (AC #2, AD-7)
  - [x] `resolveVendorSlug(desiredSlug: string): Promise<{ ok: true; slug: string } | { ok: false; error: string }>`. Normalize via the existing `slugify()` (`src/lib/utils.ts`) first, then check `prisma.vendor.findUnique({ where: { slug } })` — return `{ ok: false, error: "..." }` with a friendly message (e.g. `` `The slug "${slug}" is already in use — try a different one.` ``) if taken, else `{ ok: true, slug }`. Not a throwing function — a slug collision is an expected, common validation outcome, not an unexpected failure (`project-context.md`'s "reserve throws for actual unexpected failures" rule).
  - [x] Scope is the admin-create path only (AD-7 explicitly excludes retrofitting this to any other vendor-facing flow — there isn't one yet anyway).

- [x] Task 3: New Zod schema `src/app/api/admin/vendors/schema.ts` (AC #1)
  - [x] `CreateVendorSchema`: `name: z.string().min(1)`, `slug: z.string().min(1)` (format/uniqueness is `resolveVendorSlug()`'s job, not Zod's — don't duplicate that logic here), `phone: z.string().optional()`, `description: z.string().optional()`. Matches `Vendor.phone`/`description`'s existing optionality — don't make either required, the schema doesn't require them today either.

- [x] Task 4: `POST /api/admin/vendors` route (AC #1, #2)
  - [x] New file `src/app/api/admin/vendors/route.ts`. Mirror `src/app/api/products/route.ts`'s `POST` shape exactly, but with `getCurrentAdmin()` instead of `getCurrentVendor()`: `if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })`.
  - [x] **This route is NOT covered by `middleware.ts`'s `isProtectedRoute` matcher** — `/admin(.*)` only matches paths starting with `/admin`, and this route's real path is `/api/admin/vendors`, a different prefix. This matches every existing API route in this codebase (`/api/products`, `/api/pickup-slots`, etc. — none are in the matcher either); they all self-check via `getCurrentVendor()`'s own 401 branch. Don't add `/api/admin(.*)` to the matcher to "fix" this — it would be new, inconsistent scope beyond what any existing route does, and the self-check above is already the established, sufficient pattern.
  - [x] `req.json().catch(() => null)` then `CreateVendorSchema.safeParse(...)` → `400 { error: "Invalid request" }` on failure (matches every other route's untrusted-input pattern).
  - [x] Call `resolveVendorSlug(parsed.data.slug)`. If `{ ok: false }`, return `409 { error: result.error }` — a duplicate-identifier conflict, distinct from a `400` malformed-request (no existing precedent for this exact case in this codebase; `409` is the deliberate, semantically-correct choice here, not `400`).
  - [x] `prisma.vendor.create({ data: { name: parsed.data.name, slug: result.slug, phone: parsed.data.phone, description: parsed.data.description, clerkUserId: null, createdByAdminId: admin.id } })`. Return `201 { vendor }`.

- [x] Task 5: `/admin/vendors` page (AC #1)
  - [x] New file `src/app/admin/vendors/page.tsx` (Server Component). Same gate as `src/app/admin/page.tsx`: `getCurrentAdmin()`, `notFound()` if `null` — no shared layout guard exists yet (Story 2.1's deliberate per-page-gates-itself decision), match it here too.
  - [x] Renders a new client component, `AddVendorForm` (Task 6).

- [x] Task 6: `AddVendorForm.tsx` (AC #1, #2, #3)
  - [x] New file `src/components/admin/AddVendorForm.tsx` (new directory — first admin-specific component; mirrors `src/components/dashboard/`'s existing shape, not merged into it). Mirror `AddProductForm.tsx`'s state/error/submit shape exactly: `submitting`, `error` state, `fetch()` to `POST /api/admin/vendors`, `401` → "Your session expired. Sign in again.", other non-`ok` → surface `body.error` inline (`role="alert"`).
  - [x] Fields: name (required), slug (required — auto-suggest via `slugify(name)` on the name field's `onChange` **only until the admin manually edits the slug field themselves**, then stop overwriting it; a common "auto-fill until touched" pattern, not full auto-generation with no admin control, since AC #1 has the admin explicitly submitting a slug), phone (optional), description (optional).
  - [x] On success (`201`): don't just `router.refresh()` and reset like `AddProductForm` does — show a confirmation with a link to the new storefront, `` /vendors/{createdVendor.slug} `` (`<a href=...>`), giving the admin visible proof of AC #3 ("gets a live storefront") without them needing to guess the URL or navigate away to check.

- [x] Task 7: Test helper (needed by Task 8)
  - [x] `tests/helpers/db.ts`: add `deleteVendorBySlug(slug: string)` (mirrors the existing `deleteProductByName` shape) — test cleanup for admin-created vendors.

- [x] Task 8: Tests (AC #1, #2, #3)
  - [x] Unit (Vitest): new `src/app/api/admin/vendors/schema.test.ts` for `CreateVendorSchema` — mirrors `src/app/api/products/schema.test.ts`'s exact shape (one shared valid body, accepts-valid + one rejects-case per invalid value per required field).
  - [x] `resolveVendorSlug()` touches Prisma directly — per this codebase's own established convention (Story 1.2's review moved a DB-touching Vitest test into Playwright), its test belongs in Playwright, not Vitest.
  - [x] New file `tests/admin-vendors-api.spec.ts` (API-level, mirrors `products-api.spec.ts`'s shape: `request` fixture, admin auth from Story 2.1's `playwright/.auth/admin.json`, `test.skip(!existsSync(adminAuthFile), ...)`):
    - `[P0]` valid submission → `201`, response body has the created vendor with `clerkUserId: null` and `createdByAdminId` matching the seeded admin's id (verify via a direct `prisma.vendor.findUnique` read-back, not just the response body).
    - `[P0]` slug colliding with a seeded vendor (`corner-sourdough`) → `409`, error message matches `/already in use/i`, no duplicate row created (read-back count).
    - `[P0]` missing/invalid body (e.g. no `name`) → `400`.
    - `[P0]` request with **no** admin session (use the Story 2.1 vendor fixture — a signed-in non-admin) → `401`. This is the one case in this file that needs the *vendor* auth file, not the admin one — proves the route's own `getCurrentAdmin()` check, not just middleware (which doesn't even cover this path — see Task 4).
  - [x] New file `tests/admin-vendors.spec.ts` (UI-level, admin-authenticated):
    - `[P1]` admin fills the form, submits, sees the confirmation + storefront link; then navigates to `/vendors/{slug}` directly and confirms the vendor's name renders (proves AC #3 end to end, not just that the DB row exists).
    - `[P1]` submitting a colliding slug shows the inline error, no navigation away from the form.

- [x] Task 9: Docs sync (housekeeping, matches established precedent)
  - [x] `docs/api-contracts.md`: add a `POST /api/admin/vendors` section, same shape as the existing `POST /api/products` section (request body, behavior, response, auth note referencing `getCurrentAdmin()`).
  - [x] `docs/data-models.md`: update `Vendor`'s table — `clerkUserId` now nullable (note AD-8's "unbound until claimed" reasoning), add the new `createdByAdminId` row.
  - [x] `docs/source-tree-analysis.md`: add `admin/vendors/` under the `admin/` entry (already has one row from Story 2.1) and `api/admin/vendors/route.ts` under `api/` — same treatment Story 2.1 gave the two lines it touched there.

## Dev Notes

**Story 2.1 already built everything this story needs for admin identity/gating — don't rebuild any of it.** `getCurrentAdmin()` (`src/lib/admin.ts`), the `/admin(.*)` middleware matcher, and the Admin Playwright auth fixture (`playwright/.auth/admin.json`, seeded via `E2E_ADMIN_CLERK_ID`) all already exist. This story only adds the first real *consumers* of that infrastructure.

**Decision made during this story's planning (not left to the dev agent):** Story 2.1's review flagged that `getCurrentAdmin()` fails open by convention (every caller must remember its own `if (!admin)` check) rather than by construction (no `requireAdmin()` fail-closed helper). With this story's two new call sites, the user was asked directly and chose to **keep the current pattern** — each of Task 4/Task 5's call sites adds its own check by hand, exactly like `getCurrentVendor()`'s ~8 existing call sites across Epic 1. Do not build a `requireAdmin()` helper for this story; that door was deliberately not opened. See `deferred-work.md`'s "DECIDED 2026-08-21" note under the original finding.

**The `/api/admin/vendors` route is a genuine gap in middleware's defense-in-depth, and that's expected, not a bug to fix.** `/admin(.*)` in `middleware.ts` covers page routes under `/admin/*` (like `/admin/vendors`, the *page*) but not `/api/admin/vendors` (the *route handler* — different URL prefix). This exactly matches how zero existing API routes in this codebase (`/api/products`, `/api/pickup-slots`, etc.) are in that matcher either — they all rely solely on their own `getCurrentVendor()`/`getCurrentAdmin()` check. Task 4 is explicit about this so the dev agent doesn't assume middleware provides a safety net it doesn't.

**AD-8's nullable `clerkUserId` is low-risk here — verified, not assumed.** Searched the codebase for every read of `Vendor.clerkUserId`'s *value* (not just the WHERE-clause lookups in `vendor.ts`/`admin.ts`, which are safe since `auth()` never returns a null `userId` to compare against): only `src/app/dashboard/page.tsx`'s scaffold copy mentions it, in a string literal, not a code path. No other code reads or branches on the field's value, so making it nullable needs no defensive updates elsewhere. (That same `dashboard/page.tsx` message — "create a Vendor row whose clerkUserId matches your signed-in user id, or wire up an onboarding form as a next step" — is literally foreshadowing this story, for context; it doesn't need updating, since it describes the vendor-self-registration case, which this story doesn't build. Admin-created vendors are bound out-of-band per AD-8, not through that message's flow.)

**No invite/claim flow, per AD-8 (explicitly out of scope, "Deferred" in the architecture spine).** A newly-created vendor's `clerkUserId` stays `null` until someone manually sets it later, out-of-band (direct DB write, same as this session's own `E2E_VENDOR_CLERK_ID`-binding pattern for test fixtures). Don't build any kind of invite email, token, or self-claim UI — that's explicitly flagged as future scope the PRD doesn't ask for.

**`resolveVendorSlug()`'s 409 choice is deliberate, not arbitrary.** This codebase has no prior precedent for a "value already taken" conflict (the closest analog, `setStock()`'s 409, is a *concurrent-edit* conflict, a different situation). `409 Conflict` is the semantically correct HTTP status for "the request conflicts with the current state of a resource" (a taken identifier), distinct from `400` (malformed request) — use it, don't default to `400` just because Zod-validation failures in this file also happen to return `400`.

### Project Structure Notes

- **New:** `src/lib/vendor.ts` gains `resolveVendorSlug()` (same file `getCurrentVendor()` already lives in, per AD-7's explicit placement). `src/app/api/admin/vendors/` (route.ts + schema.ts), `src/app/admin/vendors/page.tsx`, `src/components/admin/` (new directory) `/AddVendorForm.tsx`, `tests/admin-vendors-api.spec.ts`, `tests/admin-vendors.spec.ts`.
- **Modified:** `prisma/schema.prisma` (`Vendor.clerkUserId` nullable, `Vendor.createdByAdminId` + relation, `Admin.createdVendors` back-relation), `tests/helpers/db.ts` (`deleteVendorBySlug`), `docs/api-contracts.md`, `docs/data-models.md`, `docs/source-tree-analysis.md`.
- Matches the architecture spine's Capability → Architecture Map exactly: *"FR-3, FR-4 (vendor add/deactivate) | `src/app/admin/vendors/`, `src/lib/vendor.ts` | AD-1, AD-4, AD-5, AD-6, AD-7, AD-8"* — this story covers the FR-3 (add) half; FR-4 (deactivate, AD-4) is Story 2.3's.

### Testing Standards Summary

- Vitest for the one pure-Zod-schema file (`CreateVendorSchema`), matching every existing `schema.test.ts`'s pattern exactly.
- Playwright for everything touching Prisma or the UI — `resolveVendorSlug()`, the route, and the form all go through Playwright, per this codebase's established "Prisma/Clerk/server → Playwright, pure functions only → Vitest" split (`project-context.md`).
- `tests/admin-vendors-api.spec.ts`/`tests/admin-vendors.spec.ts` both need the Story 2.1 Admin auth fixture (`playwright/.auth/admin.json`) — guard with `test.skip(!existsSync(adminAuthFile), ...)`, same pattern as `tests/admin.spec.ts`. The one `401`-non-admin test needs the *vendor* fixture instead (`playwright/.auth/vendor.json`) — two different identities in the same file, same "two separate `test.describe` blocks, two independent skip guards" shape `tests/admin.spec.ts` already established; don't conflate them into one guard.
- `test.describe.configure({ mode: "serial" })` on any block using either shared session, same Clerk/Playwright concurrency workaround (clerk/javascript#7891) already applied everywhere else authenticated tests exist in this codebase.
- Every test that creates a `Vendor` must clean up via `deleteVendorBySlug()` in a `finally`, using a timestamped unique slug/name per fixture (matches every other test's isolation convention under `fullyParallel: true`) — never reuse a fixed slug across test runs, and never touch the two seeded vendors (`corner-sourdough`, `green-valley-produce`) except as the deliberate collision target in the slug-conflict test.

### ATDD Artifacts

- Checklist: `_bmad-output/test-artifacts/atdd-checklist-2-2-admin-adds-a-vendor.md`
- Unit tests: `src/app/api/admin/vendors/schema.test.ts` (new, 6 cases, `CreateVendorSchema`)
- API tests: `tests/admin-vendors-api.spec.ts` (new, 4 cases — all P0)
- E2E tests: `tests/admin-vendors.spec.ts` (new, 2 cases)
- Fixture built ahead of schedule: `tests/helpers/db.ts`'s `deleteVendorBySlug()` (Task 7, already done — both new test files needed it immediately)
- Activate task-by-task per the checklist's "Next Steps" section — not all at once. Note: Task 6's `AddVendorForm` selectors (`aria-label="Add vendor"`, button text `"Save vendor"`) were inferred by analogy to `AddProductForm.tsx` since the component didn't exist yet — match these strings or update the two E2E selectors when Task 6 lands.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.2] — story definition, ACs, FR3 traceability.
- [Source: _bmad-output/planning-artifacts/architecture/architecture-local-food-2026-08-10/ARCHITECTURE-SPINE.md#AD-5] — attribution-FK-not-audit-log rule (`createdByAdminId` targets `Admin.id`).
- [Source: _bmad-output/planning-artifacts/architecture/architecture-local-food-2026-08-10/ARCHITECTURE-SPINE.md#AD-7] — `resolveVendorSlug()`'s contract and scope (admin-create path only).
- [Source: _bmad-output/planning-artifacts/architecture/architecture-local-food-2026-08-10/ARCHITECTURE-SPINE.md#AD-8] — nullable `clerkUserId`, no invite/claim flow, "must handle null as not-yet-claimed, not crash" (verified in Dev Notes above — nothing else reads the field's value).
- [Source: _bmad-output/implementation-artifacts/2-1-admin-identity-and-access-gating.md] — `getCurrentAdmin()`, `/admin(.*)` middleware matcher, Admin Playwright fixture, and the "fails open by convention" deferred decision this story's planning resolved.
- [Source: src/lib/vendor.ts] — current `getCurrentVendor()` (read in full for this story) — `resolveVendorSlug()` joins this file.
- [Source: src/lib/utils.ts] — existing `slugify()` (read in full for this story) — `resolveVendorSlug()` and the form's auto-suggest both reuse it, don't reimplement.
- [Source: src/app/api/products/route.ts, schema.ts] — the exact `POST` route/schema pattern Task 3/4 mirror (read in full for this story).
- [Source: src/components/dashboard/AddProductForm.tsx] — the exact form pattern Task 6 mirrors (read in full for this story).
- [Source: src/app/admin/page.tsx] — the exact per-page admin gate (`getCurrentAdmin()` + `notFound()`) Task 5 mirrors (read in full for this story).
- [Source: src/app/vendors/[slug]/page.tsx] — current storefront page (read in full for this story) — confirmed it needs no changes and handles zero products/pickup slots correctly already.
- [Source: src/app/dashboard/page.tsx] — the scaffold message referencing `clerkUserId` (read for this story) — confirmed it's a string literal, not a code path, and out of this story's scope.
- [Source: prisma/schema.prisma] — current schema (read in full for this story).
- [Source: prisma/seed.ts] — existing seeded vendors (`corner-sourdough`, `green-valley-produce`) — the slug-collision test's target.
- [Source: tests/helpers/db.ts] — existing `getVendorBySlug`/`deleteProductByName` (read in full for this story) — `deleteVendorBySlug` mirrors the latter's shape.
- [Source: tests/products-api.spec.ts, tests/admin.spec.ts] — existing API-level test pattern and the two-identity/two-skip-guard pattern (read for this story) — both reused by Task 8's new files.
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — the "getCurrentAdmin() fails open" item this story's planning resolved (decision recorded there and in Dev Notes above).

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- Migration: `npx prisma migrate dev --name vendor_admin_creation` — plain nullable-constraint relax + one new nullable FK column, no backfill needed. Applied and verified directly (`ALTER COLUMN "clerkUserId" DROP NOT NULL`, `ADD COLUMN "createdByAdminId"`, FK to `Admin` with `ON DELETE SET NULL`).
- ATDD scaffolds (12 tests across 3 files, generated in a prior workflow run) activated task-by-task as each landed, per the ATDD checklist's guidance — not all at once. Two of the three scaffold files had their `beforeEach`'s `test.skip(!existsSync(...), ...)` calls accidentally caught by a blanket `test.skip(` → `test(` activation script; caught immediately via a full-file read after each activation and fixed back to `test.skip(` (that call is Playwright's per-test conditional-skip API, not a test declaration, and must never be touched by activation).
- `npx tsc --noEmit` — clean after every task.
- `npm run lint` — clean.
- `npm run test:unit` — 72/72 passed (6 newly activated `CreateVendorSchema` cases).
- `npx playwright test tests/admin-vendors-api.spec.ts` — 1 passed for real (the 401 non-admin case, using the already-configured vendor fixture), 3 skipped (need `E2E_ADMIN_EMAIL`/`E2E_ADMIN_CLERK_ID`, not configured in this dev environment — Story 2.1's known out-of-reach step, unchanged).
- `npx playwright test tests/admin-vendors.spec.ts` — 2 skipped (same admin-fixture gap); selectors verified by careful manual cross-check against `AddVendorForm.tsx`'s actual rendered markup (form `aria-label`, field labels, button text, confirmation link text/href, error role) since they can't run green locally without the fixture.
- Full `npx playwright test` — 83 passed, 6 skipped (5 new admin-fixture-gated cases + the 1 pre-existing one from Story 2.1), 0 failures, 0 regressions.
- `npm run build` — succeeds; `/admin/vendors` and `/api/admin/vendors` appear in the route table as new dynamic (`ƒ`) routes.
- **Process note:** the ATDD scaffolds were pushed to `main` as a standalone commit before this implementation began, which broke CI's typecheck gate (the two intentional red-phase type errors). Implementation proceeded immediately to fix it rather than leaving `main` red — confirmed fixed by this story's own regression run above; CI should be green on the implementation commit.

### Completion Notes List

- `Vendor.clerkUserId` made nullable, `Vendor.createdByAdminId` added with a named relation (`VendorCreatedByAdmin`, forward-compatible with Story 2.3's `deletedByAdminId`), `resolveVendorSlug()` added to `src/lib/vendor.ts`, `CreateVendorSchema`, `POST /api/admin/vendors`, `/admin/vendors` page, `AddVendorForm.tsx`.
- All 12 ATDD red-phase scaffolds activated: 6 Vitest (green), 4 API-level Playwright (1 green for real, 3 correctly skip pending the admin fixture), 2 E2E Playwright (correctly skip pending the admin fixture, selectors manually verified against the real implementation).
- Docs synced: `docs/api-contracts.md` gained a full `POST /api/admin/vendors` section, `docs/data-models.md`'s `Vendor`/`Admin` sections updated (nullable `clerkUserId`, new `createdByAdminId`, `Admin.createdVendors` back-relation), `docs/source-tree-analysis.md` gained `admin/vendors/`, `api/admin/vendors/route.ts`, `admin/AddVendorForm.tsx`, `lib/admin.ts`, and `resolveVendorSlug()` entries.
- Full regression: typecheck clean, lint clean, 72/72 unit, 83/89 e2e (6 expected skips, all needing the not-yet-configured Admin Clerk test credentials), build succeeds.

### File List

- `prisma/schema.prisma` (modified — `Vendor.clerkUserId` nullable, `Vendor.createdByAdminId` + relation, `Admin.createdVendors` back-relation)
- `prisma/migrations/20260822003459_vendor_admin_creation/migration.sql` (new)
- `src/lib/vendor.ts` (modified — `resolveVendorSlug()`)
- `src/app/api/admin/vendors/schema.ts` (new — `CreateVendorSchema`)
- `src/app/api/admin/vendors/schema.test.ts` (new — 6 cases, activated)
- `src/app/api/admin/vendors/route.ts` (new — `POST` handler)
- `src/app/admin/vendors/page.tsx` (new — gated page)
- `src/components/admin/AddVendorForm.tsx` (new — first admin component)
- `tests/admin-vendors-api.spec.ts` (new — 4 cases, activated)
- `tests/admin-vendors.spec.ts` (new — 2 cases, activated)
- `tests/helpers/db.ts` (modified — `deleteVendorBySlug`, built during the ATDD run)
- `docs/api-contracts.md` (modified — new `POST /api/admin/vendors` section)
- `docs/data-models.md` (modified — `Vendor`/`Admin` sections updated)
- `docs/source-tree-analysis.md` (modified — `admin/vendors/`, `api/admin/vendors/`, `admin/AddVendorForm.tsx`, `lib/admin.ts`, `resolveVendorSlug()` entries)
- `_bmad-output/test-artifacts/atdd-checklist-2-2-admin-adds-a-vendor.md` (new — ATDD checklist)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — status transitions)

## Change Log

- 2026-08-21: ATDD red-phase scaffolds generated (12 tests across 3 new files) via two parallel subagents, independently verified before landing. Pushed as a standalone commit — broke CI's typecheck gate (intentional red-phase errors), corrected by proceeding immediately to implementation rather than leaving `main` red.
- 2026-08-21/22: Implemented Story 2.2 in full. New `Vendor.createdByAdminId` + nullable `clerkUserId` (AD-8), `resolveVendorSlug()` (AD-7), `POST /api/admin/vendors`, `/admin/vendors` page, `AddVendorForm.tsx`. All 12 ATDD scaffolds activated — 1 caught-and-fixed activation-script bug (two `beforeEach` skip guards briefly mis-converted, fixed immediately). Docs synced across three files. Full regression: typecheck clean, lint clean, 72/72 unit tests, 83/89 e2e (6 expected skips — no `E2E_ADMIN_EMAIL`/`E2E_ADMIN_CLERK_ID` configured in this dev environment), production build succeeds. Status → review.
