---
baseline_commit: 1f1ff82d220559de21cd749bb084023947847bac
---

# Story 2.1: Admin identity and access gating

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the platform,
I want a distinct Admin identity that gates admin-only routes and actions,
so that only trusted operators can manage vendors and inventory.

## Acceptance Criteria

1. Given a new `Admin` table keyed by `clerkUserId` (unique, mirrors `Vendor.clerkUserId`'s existing shape), when any server code needs to know whether the current Clerk user is an admin, then it resolves identity through `getCurrentAdmin()` (new `src/lib/admin.ts`) — a DB lookup against the `Admin` table only, **never** an inline Clerk session-claim check.
2. Given the new `/admin` route tree, when a request hits any `/admin/*` route, then that route is registered in `middleware.ts`'s `isProtectedRoute` matcher (proves *authenticated*) **and** the page/route additionally calls `getCurrentAdmin()` (proves *admin*) — mirroring how every existing vendor-scoped route already pairs middleware with `getCurrentVendor()`. Neither check alone is sufficient; both are required, same as the existing vendor pattern.
3. Given a signed-in user who is **not** in the `Admin` table, when they visit an `/admin/*` route, then they are denied. This story ships one minimal `/admin` page (`src/app/admin/page.tsx`) as the first end-to-end proof of this gate — Stories 2.2/2.3 build the real vendor-management UI on top of it.
4. No new external dependency is introduced — Admin auth reuses Clerk exactly as Vendor auth already does (NFR4).

*(FR2, AD-1, AD-6.)*

## Tasks / Subtasks

- [x] Task 1: Prisma schema + migration — new `Admin` model (AC #1)
  - [x] Add to `prisma/schema.prisma`: `model Admin { id String @id @default(cuid()); clerkUserId String @unique; createdAt DateTime @default(now()); updatedAt DateTime @updatedAt }`
  - [x] **Do not add `phone`.** Epics' own Story 3.2 AC states `Admin` "gains a `phone` field... required to actually deliver this story, missing from the original schema" — that sentence only makes sense if this story's `Admin` table does *not* have it. Adding it now would make Story 3.2's own AC false the moment it's read. (This contradicts the architecture spine's ER-diagram sketch, which shows `phone` on `Admin` already — the spine is a structural sketch predating epics.md's per-story refinement; epics.md is the authoritative source for what each *story* ships. Follow epics.md.)
  - [x] **Do not add anything to `Vendor`** (`deletedAt`, `createdByAdminId`, `deletedByAdminId`, nullable `clerkUserId`) — those belong to Stories 2.2 (creation-time fields) and 2.3 (deactivation-time fields), not this one. This story's entire schema surface is the new `Admin` table.
  - [x] This is a plain additive table with no backfill (unlike Story 1.2's hand-edited multi-step migration) — run `npx prisma migrate dev --name add_admin_table` directly, no `--create-only`/manual SQL editing needed.

- [x] Task 2: `src/lib/admin.ts` — `getCurrentAdmin()` (AC #1)
  - [x] New file. Mirror `src/lib/vendor.ts`'s `getCurrentVendor()` exactly (read it in full first): `auth()` from `@clerk/nextjs/server` for `userId`; return `null` if absent; otherwise `prisma.admin.findUnique({ where: { clerkUserId: userId } })`. Same shape, same file-header-comment convention ("Import only in server components / route handlers").

- [x] Task 3: `middleware.ts` — gate `/admin/*` at the authentication layer (AC #2)
  - [x] `src/middleware.ts`: change `createRouteMatcher(["/dashboard(.*)"])` to `createRouteMatcher(["/dashboard(.*)", "/admin(.*)"])`. This proves *authenticated* only — `getCurrentAdmin()` (Task 4) is what proves *admin*. Neither replaces the other.

- [x] Task 4: Minimal `/admin` page — proves the gate end-to-end (AC #2, #3)
  - [x] New file `src/app/admin/page.tsx` (Server Component, no `"use client"`). Call `getCurrentAdmin()`; if `null`, call `notFound()` (from `next/navigation`) — the only existing precedent for this exact pattern in this codebase is `src/app/vendors/[slug]/page.tsx:29`, and using it here is a deliberate choice, not spec'd by any doc: it's consistent with that convention, and it avoids confirming to a non-admin that the route exists/an identity check even ran. If admin resolves, render a minimal stub (e.g. a heading and one line naming `admin.clerkUserId`) — this page's real content ships in Stories 2.2 (`/admin/vendors`) and 3.1 (`/admin/inventory`); don't build anything beyond proving the gate here.
  - [x] No shared `src/app/admin/layout.tsx` in this story — `src/app/dashboard/layout.tsx` doesn't gate either; every existing dashboard page calls `getCurrentVendor()` itself. Match that per-page-gates-itself shape. A layout with nav tabs is reasonable once there's more than one admin page (Story 2.2+), not before.
  - [x] No mutating "admin action" route ships in this story. AC #2's "or calling an admin action" describes the contract `getCurrentAdmin()` must satisfy for *future* routes (2.2/2.3 add real ones), not a Story 2.1 deliverable. Document (in Dev Notes, already done below) the pattern those routes should follow: `if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })`, mirroring `src/app/api/products/[id]/route.ts`'s existing `!vendor` branch exactly — don't build one speculatively now.

- [x] Task 5: Admin Playwright auth fixture + seed data (testing infra AC #2/#3 need to be provable at all)
  - [x] `prisma/seed.ts`: add one `Admin` row, `clerkUserId: process.env.E2E_ADMIN_CLERK_ID || "seed_user_admin"` — mirrors the existing bakery `Vendor` seed block's exact `E2E_VENDOR_CLERK_ID` pattern (read that block first).
  - [x] `.env.example`: add `E2E_ADMIN_EMAIL`/`E2E_ADMIN_CLERK_ID`, mirroring the existing `E2E_VENDOR_EMAIL`/`E2E_VENDOR_CLERK_ID` block (same comments shape, right after it).
  - [x] `playwright/support/global-setup.ts`: extend to also sign in `E2E_ADMIN_EMAIL` via the same `clerk.signIn({ page, emailAddress })` Backend-API call already used for the vendor, and save `playwright/.auth/admin.json` (new file, sibling to `vendor.json`). Gate the admin half **independently** — warn-and-skip only that half if `E2E_ADMIN_EMAIL` is unset, without touching the vendor half's existing behavior either way.
  - [x] `.github/workflows/ci.yml`: add `E2E_ADMIN_EMAIL: ${{ secrets.E2E_ADMIN_EMAIL }}` / `E2E_ADMIN_CLERK_ID: ${{ secrets.E2E_ADMIN_CLERK_ID }}` to the e2e step's `env:` block, mirroring the two existing `E2E_VENDOR_*` lines.
  - [x] **Out of this story's reach:** creating the actual Clerk test user and setting the two values as real GitHub Actions secrets is a manual step outside the codebase (same as `E2E_VENDOR_EMAIL`/`E2E_VENDOR_CLERK_ID` were, earlier). Until set, the admin fixture warns and skips — CI stays green either way, but admin e2e coverage only actually executes once configured. This is expected, not a defect; note it in the Dev Agent Record.

- [x] Task 6: Tests (AC #1, #2, #3)
  - [x] `tests/auth.spec.ts`: add `"admin requires authentication"`, mirroring the existing `"dashboard requires authentication"` test exactly — `page.goto("/admin")`, expect redirect to `/sign-in`.
  - [x] New file `tests/admin.spec.ts` — new feature area, matches this repo's "one file per feature area" convention (`auth`, `dashboard`, `payment`, ... now `admin`); don't fold into `dashboard.spec.ts`, Admin is a distinct identity/route tree (AD-6), not a vendor-dashboard concern.
    - **Two separate `test.describe` blocks, one per identity** — `test.use({ storageState })` applies per block, and this file is the first to need two different identities in one file:
      - Block 1 (Vendor identity): Case A — visiting `/admin` is denied (expect `404`, matching Task 4's `notFound()`). This is the "signed-in non-admin" case from AC #3 — the existing vendor fixture already proves it, since a Vendor's Clerk user has no `Admin` row. No new fixture needed for this case.
      - Block 2 (Admin identity): Case B — visiting `/admin` succeeds (expect `200`, page content renders). Proves AC #2's full round-trip.
    - **Two independent fixtures, two independent skip guards — do not conflate them.** Either fixture can be present without the other (e.g. a fresh clone with only `E2E_VENDOR_*` configured, or CI before `E2E_ADMIN_*` secrets are added per Task 5) — guarding both blocks on the same file-existence check would wrongly skip or wrongly run one of them.
    - `test.describe.configure({ mode: "serial" })` on **both** blocks — same Clerk/Playwright concurrency workaround already applied in `dashboard.spec.ts`/`products-api.spec.ts` (documented there as clerk/javascript#7891). Block 1 shares the vendor session with those two existing files, so it needs the same protection they already have, not just Block 2 (a fresh identity/session).
    - **Discovered during implementation (not in the original plan):** `test.use({ storageState: authFile })` resolves the file at browser-context creation, *before* `beforeEach`'s `test.skip(!existsSync(authFile), ...)` ever runs — a missing file throws `ENOENT` and fails the test instead of skipping it. Confirmed empirically: `admin.json` genuinely doesn't exist in this dev environment (no real `E2E_ADMIN_EMAIL` configured), and the naive `test.use({ storageState: adminAuthFile })` failed with exactly that error. Fixed by conditionally passing `existsSync(authFile) ? authFile : undefined` into `test.use()` for both blocks, so a missing file yields an empty/unauthenticated context instead of a crash, and the `beforeEach` guard is what actually decides skip-vs-run. This is a latent defect this story's own new file exposed by being the first authenticated suite ever exercised without its credential configured — `dashboard.spec.ts`/`products-api.spec.ts` likely share the identical latent bug (never triggered there, since `vendor.json` has existed in every environment this codebase's tests have run in so far). Flagged in `deferred-work.md` rather than fixed in those files — out of this story's scope.

- [x] Task 7: Docs sync (housekeeping, matches established precedent from every prior story)
  - [x] `docs/data-models.md`: add an `Admin` entity section, same table shape as the existing `Vendor` section (`id`, `clerkUserId`, `createdAt`, `updatedAt`).
  - [x] `docs/architecture.md`: update the "Data architecture" section's table count ("Five tables" → "Six tables"), naming `Admin`. No change needed to "API design" (no new JSON route ships this story) or "Component overview" (no new `"use client"` component).

## Dev Notes

**This is Epic 2's foundational, infra-only story — no vendor-management UI ships here.** Stories 2.2 (add a vendor) and 2.3 (deactivate a vendor) build the actual admin-facing forms/actions on top of this story's identity + gating plumbing. Resist scope creep into building any of that now.

**AD-1's core rule: `Admin.clerkUserId` is the *sole* source of admin identity.** Never resolve admin-ness via a Clerk session claim/public metadata shortcut, even though Clerk supports that mechanism — every admin-gated route must call `getCurrentAdmin()`, never re-implement the check inline. This mirrors the same "one shared guard" philosophy the architecture spine already applies to `assertVendorActive()` (AD-4) and to this repo's existing `getCurrentVendor()`.

**Schema scope is deliberately narrow — see Task 1's two explicit exclusions.** `phone` is Story 3.2's to add (epics.md's own AC for that story states it's "missing from the original schema," which is only true if this story doesn't add it). The `Vendor` columns (`deletedAt`, `createdByAdminId`, `deletedByAdminId`, nullable `clerkUserId`) belong to Stories 2.2/2.3. Guessing these in now risks getting a shape wrong before the story that actually needs it has specified the shape — a follow-up migration is cheap; an incorrect early one isn't.

**The denial mechanism (`notFound()`) is a judgment call this story is making, not something epics.md/the architecture spine mandates.** It's chosen for consistency with this codebase's one existing precedent and because it doesn't confirm route existence to a non-admin. Future *mutating* admin routes (2.2/2.3, JSON API responses rather than a rendered page) should use `401 { error: "Unauthorized" }` instead — same shape as `src/app/api/products/[id]/route.ts`'s existing `!vendor` branch, just a different transport (JSON vs. a thrown Next.js not-found).

**Testing infra here is a first-class deliverable, not an afterthought.** `sprint-status.yaml`'s open Epic 1 action item literally reads: *"Fix the stale Clerk vendor auth fixture... and build an equivalent Admin test-identity fixture before Epic 2's first story lands... Admin half blocked on Epic 2's Admin identity existing first."* Task 5 is what closes that out — do not treat it as optional or defer it to a later story.

**No admin action route ships in this story.** AC #2's "or calling an admin action" describes a contract `getCurrentAdmin()` must satisfy for routes Stories 2.2/2.3 add — it is not asking this story to build one. If a task here starts drifting toward a vendor-creation or vendor-deactivation form, that's a sign of scope creep into the next two stories, not a legitimate part of this one.

**Migration is simple.** Unlike Story 1.2's required-column-with-no-default backfill (which needed `--create-only` + hand-edited SQL to avoid an interactive prompt against a non-empty table), a brand-new table with no existing rows to backfill has no such hazard — `npx prisma migrate dev --name add_admin_table` runs directly.

### Project Structure Notes

- **New:** `src/lib/admin.ts` (mirrors `src/lib/vendor.ts`'s shape exactly), `src/app/admin/page.tsx` (new route-tree root, AD-6), `tests/admin.spec.ts` (new feature-area file). `playwright/.auth/admin.json` is generated at test-run time (mirrors `.auth/vendor.json`) — gitignored, not checked in.
- **Modified:** `prisma/schema.prisma` (new `Admin` model), `src/middleware.ts` (matcher gains `/admin(.*)`), `prisma/seed.ts` (new `Admin` seed row), `.env.example`, `playwright/support/global-setup.ts`, `.github/workflows/ci.yml`, `tests/auth.spec.ts`, `docs/data-models.md`, `docs/architecture.md`.
- Matches the architecture spine's Capability → Architecture Map exactly: *"FR-2 (admin gating) | `src/lib/admin.ts`, `middleware.ts` | AD-1, AD-6"* — this story's core file surface, plus the one proof-of-gate page and its supporting test infra.

### Testing Standards Summary

- Playwright only — no Vitest surface. `getCurrentAdmin()` touches Prisma/Clerk directly, same reasoning that moved Story 1.2's `setStock()` coverage out of Vitest into Playwright (`project-context.md`'s Testing Rules reserve `src/**/*.test.ts` for pure functions/helpers only).
- `tests/admin.spec.ts` joins the established "one file per feature area" convention (`auth`, `payment`, `sms`, `dashboard`, `homepage`, `storefront-cart`, `checkout-api`, `webhooks` — now `admin`).
- `test.describe.configure({ mode: "serial" })` is required on the admin-authenticated block — same documented Clerk/Playwright concurrency issue already worked around in `dashboard.spec.ts`/`products-api.spec.ts`; omitting it reintroduces intermittent 401s under `fullyParallel: true`.
- Both new authenticated-admin tests must guard with `test.skip(!existsSync(authFile), ...)`, exactly like every existing authenticated suite — `E2E_ADMIN_EMAIL`/`CLERK_SECRET_KEY` won't be configured in CI until the GitHub secret is added separately (Task 5's explicit note); tests must skip gracefully, not fail, when absent.
- The non-admin-denial test reuses the **existing** `playwright/.auth/vendor.json` fixture — don't build a second "signed-in, not an admin" fixture from scratch; the vendor fixture already is exactly that.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.1] — story definition, ACs, FR2 traceability; also Story 3.2's AC (confirms `Admin.phone` is out of this story's scope).
- [Source: _bmad-output/planning-artifacts/architecture/architecture-local-food-2026-08-10/ARCHITECTURE-SPINE.md#AD-1] — `Admin.clerkUserId` as sole identity source.
- [Source: _bmad-output/planning-artifacts/architecture/architecture-local-food-2026-08-10/ARCHITECTURE-SPINE.md#AD-6] — `/admin/**` route tree, middleware + `getCurrentAdmin()` pairing requirement.
- [Source: _bmad-output/planning-artifacts/architecture/architecture-local-food-2026-08-10/ARCHITECTURE-SPINE.md#Structural Seed] — `Admin` ER sketch (note: shows `phone` already present; Dev Notes explains why this story doesn't add it — epics.md's Story 3.2 AC is the authoritative, later-refined source).
- [Source: src/lib/vendor.ts] — `getCurrentVendor()` (read in full for this story) — the exact pattern `getCurrentAdmin()` mirrors.
- [Source: src/middleware.ts] — current matcher (read in full for this story) — single-line change.
- [Source: src/app/vendors/[slug]/page.tsx:29] — this codebase's only existing `notFound()` precedent, the pattern Task 4 reuses for admin denial.
- [Source: src/app/dashboard/layout.tsx, src/app/dashboard/products/page.tsx] — confirms per-page gating (not a shared layout guard) is this codebase's established shape; `/admin/page.tsx` follows the same shape.
- [Source: src/app/api/products/[id]/route.ts] — the `401 { error: "Unauthorized" }` pattern future admin *action* routes (2.2/2.3) should mirror.
- [Source: prisma/schema.prisma] — current schema (read in full for this story).
- [Source: prisma/seed.ts] — existing `E2E_VENDOR_CLERK_ID`-bound Vendor seed block (read in full for this story) — the exact pattern Task 5's `Admin` seed row mirrors.
- [Source: playwright/support/global-setup.ts] — existing vendor Backend-API sign-in (read in full for this story) — the exact pattern Task 5 extends for Admin.
- [Source: .env.example] — existing `E2E_VENDOR_EMAIL`/`E2E_VENDOR_CLERK_ID` block (read in full for this story) — the pattern Task 5 mirrors.
- [Source: .github/workflows/ci.yml] — existing `E2E_VENDOR_*` secrets wiring (read in full for this story) — the pattern Task 5 mirrors.
- [Source: tests/auth.spec.ts] — existing unauthenticated-redirect coverage (read in full for this story) — the pattern Task 6's new case mirrors.
- [Source: tests/dashboard.spec.ts, tests/products-api.spec.ts] — existing `test.describe.configure({ mode: "serial" })` Clerk-concurrency workaround and `existsSync(authFile)` skip-guard pattern (read for this story) — both reused verbatim in `tests/admin.spec.ts`.
- [Source: _bmad-output/implementation-artifacts/sprint-status.yaml] — Epic 1's open action item naming this exact story as the blocker for the Admin test-fixture half of that work.
- [Source: docs/data-models.md, docs/architecture.md] — doc sections Task 7 updates.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- Migration: `npx prisma migrate dev --name add_admin_table` — plain additive table, no backfill, no `--create-only`/hand-editing needed. Applied and verified directly (`CREATE TABLE "Admin"` + unique index on `clerkUserId`).
- `npx tsc --noEmit` — clean.
- `npm run lint` — clean.
- `npm run test:unit` — 66/66 passed (unaffected — no pure-function surface touched by this story).
- `npx playwright test` (full suite) — 82 passed, 1 skipped. The skip is `"an admin visiting /admin is granted access"`, correctly self-skipping via `test.skip(!existsSync(adminAuthFile), ...)` since `E2E_ADMIN_EMAIL`/`E2E_ADMIN_CLERK_ID` aren't configured in this dev environment yet (Task 5's documented, expected out-of-reach step). All other admin.spec.ts/auth.spec.ts cases passed, including the non-admin-denial case (reuses the already-configured vendor fixture).
- `npm run build` — succeeds; `/admin` appears in the route table as a new dynamic (`ƒ`) route.

### Completion Notes List

- New `Admin` table (`clerkUserId`-unique only — deliberately no `phone`, per Story 3.2's AC), `src/lib/admin.ts`'s `getCurrentAdmin()` (mirrors `getCurrentVendor()` exactly), `middleware.ts` matcher extended to `/admin(.*)`, minimal `src/app/admin/page.tsx` stub gating via `notFound()`.
- Admin Playwright auth fixture built end-to-end: `prisma/seed.ts` seeds an `Admin` row bound to `E2E_ADMIN_CLERK_ID`, `playwright/support/global-setup.ts` extended to independently sign in and save `playwright/.auth/admin.json`, `.env.example`/`.github/workflows/ci.yml` wired for the two new secrets — closing the Epic 1 retro's open action item that named this story as its blocker.
- New `tests/admin.spec.ts` (two describe blocks, one per identity) plus one new case in `tests/auth.spec.ts`.
- **Bug found and fixed during Task 6, not in the original plan:** `test.use({ storageState: authFile })` resolves the file at browser-context creation, before `beforeEach`'s `test.skip(!existsSync(authFile), ...)` guard runs — a missing file throws `ENOENT` instead of skipping. Caught because this is the first authenticated suite in the repo actually exercised without its credential configured (`admin.json` genuinely doesn't exist here). Fixed in `tests/admin.spec.ts` via `existsSync(authFile) ? authFile : undefined`. Flagged in `deferred-work.md` as a likely-latent, unfixed instance of the same bug in `dashboard.spec.ts`/`products-api.spec.ts` — out of this story's scope to fix there.
- Docs synced: `docs/data-models.md` gained an `Admin` section, `docs/architecture.md`'s table count updated.
- Full regression: typecheck clean, lint clean, 66/66 unit, 82/83 e2e (1 expected skip), build succeeds.

### File List

- `prisma/schema.prisma` (modified — new `Admin` model)
- `prisma/migrations/20260821200021_add_admin_table/migration.sql` (new)
- `src/lib/admin.ts` (new — `getCurrentAdmin()`)
- `src/middleware.ts` (modified — matcher gains `/admin(.*)`)
- `src/app/admin/page.tsx` (new — minimal gated stub)
- `prisma/seed.ts` (modified — new seeded `Admin` row bound to `E2E_ADMIN_CLERK_ID`)
- `.env.example` (modified — `E2E_ADMIN_EMAIL`/`E2E_ADMIN_CLERK_ID`)
- `playwright/support/global-setup.ts` (modified — extended to independently sign in Admin and write `playwright/.auth/admin.json`)
- `.github/workflows/ci.yml` (modified — `E2E_ADMIN_EMAIL`/`E2E_ADMIN_CLERK_ID` added to the e2e step's `env:` block)
- `tests/auth.spec.ts` (modified — new `"admin requires authentication"` case)
- `tests/admin.spec.ts` (new — vendor-denied and admin-granted cases)
- `docs/data-models.md` (modified — new `Admin` section)
- `docs/architecture.md` (modified — table count, `Admin` identity note)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified — new entry for the discovered `storageState`/`ENOENT` latent bug)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — status transitions)

## Change Log

- 2026-08-21: Implemented Story 2.1 in full. New `Admin` table (deliberately minimal — no `phone`, per Story 3.2's own AC), `getCurrentAdmin()` mirroring `getCurrentVendor()`, `middleware.ts` gating extended to `/admin/*`, and a minimal `/admin` stub page proving the gate end-to-end via `notFound()` denial. Built the Admin Playwright auth fixture (seed row, extended `global-setup.ts`, `.env.example`/CI wiring) that Epic 1's retro flagged as blocked on this story. Found and fixed a real bug while writing `tests/admin.spec.ts`: `test.use({ storageState })` throws before a `test.skip` guard can run if the auth file is missing — fixed here, flagged in `deferred-work.md` as a likely-latent instance in two pre-existing files. Full regression: typecheck clean, lint clean, 66/66 unit tests, 82/83 e2e (1 expected skip — no `E2E_ADMIN_EMAIL` configured in this dev environment yet), production build succeeds. Status → review.
