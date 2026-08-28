---
baseline_commit: 7b79ef684169f395e3201468bf75664364d1ffae
---

# Story 7.1: Admin sets a vendor's real timezone

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,
I want to set a vendor's real IANA timezone at creation and edit it later for an existing vendor,
so that `Vendor.timezone` reflects where the vendor actually operates instead of silently defaulting to `America/New_York` with no way to correct it.

## Acceptance Criteria

1. The admin "add vendor" form (`CreateVendorSchema`-backed, `src/app/api/admin/vendors/route.ts`) gains a `timezone` field (IANA identifier, e.g. `"America/Los_Angeles"`), defaulting to `"America/New_York"` but changeable by admin at creation time — validated server-side with `isValidTimeZone()` (`src/lib/timezone.ts`, built in Story 6.1), not a new duplicate check.
2. A new route lets admin update an existing vendor's `timezone` after creation — no route today lets admin edit any field of an already-created vendor (only `POST /api/admin/vendors/[id]/deactivate` exists). Validated the same way as creation, so a vendor onboarded with the wrong default isn't permanently stuck with it.
3. Admin can view and change a vendor's timezone from `src/app/admin/vendors/page.tsx` (inline edit or a per-vendor edit view — implementer's choice) without needing direct database access.
4. Story 6.1's existing read-side machinery (`AddSlotForm.tsx`'s conversion calls, `formatPickupWindow()`, the pickup-slots API's `timezone` field) already reads `Vendor.timezone` fresh on every request — confirm that when an admin changes an existing vendor's timezone, `AddSlotForm`, checkout, and storefront pickup-slot display all reflect the new value on their next read, with no separate propagation, cache invalidation, or backfill step needed. Confirm this holds with a real test rather than assuming; note explicitly in Completion Notes if a gap is found instead.
5. A malformed or unrecognized timezone string, submitted at creation or edit, is rejected server-side with a validation error before any write — reusing `isValidTimeZone()` rather than duplicating that check inline in the schema.

*(FR18. Scope decision made during story creation (Jeff, 2026-08-28): admin-set field only — no new vendor-facing self-service settings surface. Matches this app's existing pattern (admin already owns vendor onboarding per Epic 2); vendors have no self-service settings page anywhere in this app today, and building the first one was explicitly out of scope for this epic.)*

## Tasks / Subtasks

- [x] Task 1: `timezone` on vendor creation (AC #1, #5)
  - [x] `src/app/api/admin/vendors/schema.ts` — add `timezone: z.string().refine(isValidTimeZone, "Invalid timezone").default("America/New_York")` (or equivalent shape) to `CreateVendorSchema`, importing `isValidTimeZone` from `@/lib/timezone`. Match the existing field style (`.trim()` isn't relevant here — a timezone identifier has no meaningful whitespace-only case, but a malformed string must still be rejected).
  - [x] `src/app/api/admin/vendors/route.ts` — pass `parsed.data.timezone` into `prisma.vendor.create()`'s `data`.
  - [x] `src/components/admin/AddVendorForm.tsx` — add a `timezone` field to the form. A plain `<select>` populated from `Intl.supportedValuesOf("timeZone")` is the natural fit (no new dependency; this is the same runtime API `isValidTimeZone()` considered and rejected for *validation* in Story 6.1 because it excludes `"UTC"` — that gap doesn't matter here since `"UTC"` isn't a real vendor location and `America/New_York` is still the sane default). Default the selection to `"America/New_York"`, matching the schema default.
  - [x] `docs/api-contracts.md` — update `POST /api/admin/vendors`'s request-body documentation for the new field. [Source: docs/api-contracts.md#`POST /api/admin/vendors`]

- [x] Task 2: New route to edit an existing vendor's timezone (AC #2, #5)
  - [x] New file `src/app/api/admin/vendors/[id]/schema.ts` — `UpdateVendorSchema` with a single `timezone` field, same `isValidTimeZone()` refine as Task 1 (factor the refine into a shared constant/function between the two schema files if that avoids duplicating the error message, but don't force a shared base schema if the two files' other fields diverge later — a single duplicated refine call is cheap).
  - [x] New file `src/app/api/admin/vendors/[id]/route.ts` — `PATCH /api/admin/vendors/[id]`. Auth: `getCurrentAdmin()`, `401` if none, same as every other admin route (`POST /api/admin/vendors`, the deactivate route) — **not** covered by `middleware.ts`'s matcher (`/admin(.*)` matches page routes, not this API path), same reasoning documented in both existing admin route files. No ownership scoping needed (admin operates across all vendors, same as deactivate). Parse body against `UpdateVendorSchema`, `400` on failure. Look up the vendor by `params.id`; `404` if not found (a plain `findUnique`-then-`update` is fine here — unlike deactivate's `updateMany` atomic-claim pattern, there's no concurrent-writer race to guard against for a single scalar field with no state-machine semantics). Update `timezone`, return `200 { vendor }`.
  - [x] `docs/api-contracts.md` — add a new `### PATCH /api/admin/vendors/[id]` section, matching the existing `POST .../deactivate` section's format (auth, request/response shape, behavior). [Source: docs/api-contracts.md#`POST /api/admin/vendors/[id]/deactivate`]

- [x] Task 3: Admin UI to edit an existing vendor's timezone (AC #3)
  - [x] `src/app/admin/vendors/page.tsx` — the vendors table currently has Name/Slug/Status columns with no per-row edit affordance (`DeactivateVendorButton` is the only row action). Add a timezone column and an edit affordance — a new client component (e.g. `src/components/admin/EditVendorTimezoneControl.tsx`) following `DeactivateVendorButton.tsx`'s established shape: `"use client"`, local `submitting`/`error` state, `fetch` to the new `PATCH` route, `router.refresh()` on success. A `<select>` (same `Intl.supportedValuesOf("timeZone")` source as `AddVendorForm`) is simpler to implement correctly than a free-text input plus client-side validation, and avoids a round-trip just to discover a typo'd zone name — prefer it unless there's a concrete reason not to.
  - [x] No `window.confirm()` needed here (unlike `DeactivateVendorButton`) — changing a timezone is fully reversible by changing it back, unlike deactivation's real customer-facing, hard-to-undo consequence.

- [x] Task 4: Confirm existing read-side machinery picks up an edited timezone with no separate propagation step (AC #4)
  - [x] This task is verification, not new code — Story 6.1 already built `AddSlotForm.tsx`, `formatPickupWindow()`, and `GET /api/vendors/[vendorId]/pickup-slots` to read `Vendor.timezone` fresh via Prisma on every request/render; there is no cache layer between `Vendor.timezone` and any of these read sites today (confirmed: `src/app/vendors/[slug]/page.tsx` has no `export const revalidate`, and the dynamic-rendering fix from Story 1.3's deferred-work entry already forces `vendors/[slug]/page.tsx` to `force-dynamic`). Confirm this by testing it directly (Task 5's e2e test), not by re-reading the code and asserting it should work.
  - [x] If a gap is found (e.g. a caching layer this story's author didn't anticipate), note it explicitly in Completion Notes — don't silently patch around it without recording that AC #4's original assumption was wrong.

- [x] Task 5: Tests (AC #1-#5)
  - [x] `src/app/api/admin/vendors/schema.test.ts` — extend for the new `timezone` field: accepts a valid IANA identifier, accepts an omitted value (falls back to the schema default), rejects a malformed/unrecognized one. Mirrors this file's existing pattern (see `rejects an empty name` etc.).
  - [x] New `src/app/api/admin/vendors/[id]/schema.test.ts` — same shape of coverage (valid/malformed) for `UpdateVendorSchema`.
  - [x] New API-level Playwright coverage for `PATCH /api/admin/vendors/[id]`, matching `tests/admin-vendors-api.spec.ts`'s and `tests/admin-deactivate-vendor.spec.ts`'s established conventions (admin-authenticated `request.patch()` calls, not full UI interaction) — covers: successful update, unauthenticated `401`, malformed timezone `400`, nonexistent vendor id `404`.
  - [x] New/extended UI-level Playwright coverage in `tests/admin-vendors.spec.ts`, matching its established conventions (real form interaction via the admin Playwright fixture) — covers: `AddVendorForm` accepting a non-default timezone selection and the created vendor persisting it (AC #1), and the new edit affordance changing an existing vendor's timezone (AC #3).
  - [x] The AC #4 read-side confirmation test: extend or add to `tests/dashboard.spec.ts`'s existing timezone-aware coverage (Story 6.1 added a test that temporarily mutates `corner-sourdough`'s timezone directly via test helpers) — this story's version should instead go through the real admin `PATCH` route to change the timezone, then assert the vendor dashboard's pickup-slot display picks up the new value, proving the full admin-edit-to-display path works end-to-end, not just the lower-level mutation Story 6.1's test used. Restore the original timezone in `finally`, same discipline as Story 6.1's test.

- [x] Task 6: Docs sync (housekeeping, matches established precedent)
  - [x] `docs/data-models.md`'s `Vendor.timezone` row — remove the now-stale "No vendor/admin-facing UI to change it exists yet" clause, replace with a reference to this story's admin UI. [Source: docs/data-models.md#Vendor]
  - [x] `docs/api-contracts.md` — confirm the `POST /api/admin/vendors` and new `PATCH /api/admin/vendors/[id]` sections are both complete and consistent with Task 1/2's actual implementation before considering this task done.

## Dev Notes

**This story is the write-side counterpart to Story 6.1, not a re-implementation of any of its read-side logic.** `AddSlotForm.tsx`, `formatPickupWindow()`, `zonedWallTimeToUtc()`, and `isValidTimeZone()` all already exist and are correct (Story 6.1, code-reviewed on Opus, DST-bug-fixed). This story only needs to give `Vendor.timezone` a real write path — creation-time and edit-time — and confirm (Task 4) that the existing read path picks up whatever gets written, with no new conversion or display logic of its own.

**Why an admin-only field, not a vendor-facing settings page.** Jeff's explicit scope decision (2026-08-28, recorded in `deferred-work.md`'s Epic 6 review section and `sprint-status.yaml`'s epic-6 action items): admin sets it, matching this app's existing pattern where admin owns vendor onboarding (Epic 2) and there is no vendor self-service settings surface anywhere in this app today. Do not build a vendor-facing timezone settings page for this story — that would be new, unscoped surface area (the first vendor self-service settings page in this codebase), not a decision this story's AC set covers.

**Why a new route instead of extending the deactivate route or adding a general-purpose vendor-update route.** `POST /api/admin/vendors/[id]/deactivate` is a narrow, single-purpose action route (Story 2.3's explicit design — no reactivate endpoint either). A general `PATCH /api/admin/vendors/[id]` that could edit *any* vendor field is a reasonable future direction but is more scope than this story's AC set asks for (AC #2 only requires editing `timezone`); a narrowly-scoped `PATCH` that happens to only accept `timezone` today, expandable later, matches this codebase's incremental pattern (e.g. `PATCH /api/products/[id]` started narrow around stock/threshold, not every product field).

**No optimistic-concurrency/version field needed for this write**, unlike `PATCH /api/products/[id]`'s `stockVersion` mechanism. That mechanism exists because `Product.stockQuantity` has *multiple independent concurrent writers* (a sale decrementing it, a vendor editing it) racing on the same field — `Vendor.timezone` has exactly one writer (this new admin route) and no concurrent-decrement-style race to protect against. A plain read-then-write (or even a direct `update`) is sufficient; don't port `stockVersion`'s pattern here without a concrete race to justify it.

**`isValidTimeZone()` (`src/lib/timezone.ts`, Story 6.1) is the single source of truth for "is this a valid IANA identifier" across this codebase** — both the create-time schema (Task 1) and the edit-time schema (Task 2) must call it, not re-derive their own check. It was deliberately built to accept `"UTC"` (unlike a naive `Intl.supportedValuesOf("timeZone").includes()` check, which excludes it) — see its own doc comment for why.

**`Intl.supportedValuesOf("timeZone")` is a real, already-available runtime API** (no new dependency) — the natural source for a `<select>` of valid timezones in both `AddVendorForm.tsx` (Task 1) and the new edit control (Task 3). It's a large list (~400 entries); a plain `<select>` with all of them is acceptable for an admin-only, low-frequency-use form — don't over-engineer a searchable/filtered picker unless it proves genuinely unusable in practice.

**Every pre-existing vendor already has a `timezone` value today** (Story 6.1's migration backfilled the schema default to every row) — this story never needs to handle a vendor with a missing/null timezone. The only scenario this story's edit path needs to handle is *correcting* an existing value, not filling in an absent one.

### Project Structure Notes

- **New:** `src/app/api/admin/vendors/[id]/route.ts`, `src/app/api/admin/vendors/[id]/schema.ts`, `src/app/api/admin/vendors/[id]/schema.test.ts`, `src/components/admin/EditVendorTimezoneControl.tsx` (or equivalent — naming/shape at implementer's discretion, matching `DeactivateVendorButton.tsx`'s established pattern).
- **Modified:** `src/app/api/admin/vendors/schema.ts` (`CreateVendorSchema` gains `timezone`), `src/app/api/admin/vendors/route.ts` (passes it through to `prisma.vendor.create()`), `src/app/api/admin/vendors/schema.test.ts`, `src/components/admin/AddVendorForm.tsx` (new field), `src/app/admin/vendors/page.tsx` (new column + edit affordance), `docs/data-models.md`, `docs/api-contracts.md`, `tests/admin-vendors-api.spec.ts` or a new sibling file, `tests/admin-vendors.spec.ts`, `tests/dashboard.spec.ts`.
- No changes needed to `src/lib/timezone.ts`, `src/components/dashboard/AddSlotForm.tsx`, `src/lib/utils.ts`'s `formatPickupWindow()`, `src/app/vendors/[slug]/page.tsx`, `src/app/dashboard/pickups/page.tsx`, or `src/app/api/vendors/[vendorId]/pickup-slots/route.ts` — all already correctly read `Vendor.timezone` fresh (Story 6.1). Confirm via Task 4's test, don't assume.

### Testing Standards Summary

- Vitest for both schemas' `timezone` validation (Task 5) — valid/omitted/malformed cases, matching `schema.test.ts`'s existing style throughout this codebase.
- Playwright, API-level, for the new `PATCH` route — matching `tests/admin-vendors-api.spec.ts`/`tests/admin-deactivate-vendor.spec.ts`'s established `request.patch()`-style conventions, not full UI interaction, for auth/validation/not-found coverage.
- Playwright, UI-level, for `AddVendorForm`'s new field and the new edit affordance — matching `tests/admin-vendors.spec.ts`'s established real-form-interaction conventions.
- Playwright, end-to-end, proving AC #4: an admin-driven timezone edit through the real `PATCH` route is reflected in the vendor dashboard's pickup-slot display with no separate step — this is the one test that actually proves the write-side (this story) and read-side (Story 6.1) compose correctly together.
- No mocking — matches this codebase's established convention.

### References

- [Source: docs/api-contracts.md#`POST /api/admin/vendors`]
- [Source: docs/api-contracts.md#`POST /api/admin/vendors/[id]/deactivate`]
- [Source: docs/data-models.md#Vendor]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 7: Vendor Timezone Configuration]

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- ATDD red-phase run (before this dev-story session): `npx vitest run` — 127 passed, 2 failed (both malformed-timezone rejection cases, the only genuinely unimplemented behavior). `npx tsc --noEmit` and `npm run lint` clean against the stubs.
- Task 1/2 green-phase run: `npx vitest run` — 129/129 passed after adding `.refine(isValidTimeZone, "Invalid timezone")` to both schemas; both previously-red cases flipped with no test-file changes needed, confirming the ATDD scaffolds pinned the right behavior.
- Full regression after all tasks: `npx vitest run` 129/129, `npx tsc --noEmit` clean, `npm run lint` clean, `npm run build` succeeds (new `/api/admin/vendors/[id]` route registered).
- `CI=true npx playwright test` (full suite): first run — 1 failure, the new AC #4 test (`tests/dashboard.spec.ts`), same assertion (`patchResponse.ok()`) failing identically on both retries. Second full run — identical failure, same test, same line. Consistent, reproducible, not intermittent — investigated rather than dismissed. Isolated runs of the same test (alone, and alongside every other admin-session-consuming spec file) passed clean every time, narrowing the trigger to something specific to running deep into a long (~4 min) full-suite wall-clock run.
- Root cause: the test used a bare `request.newContext({ storageState: adminAuthFile })` — an API-only context that never loads any page/JS, so Clerk's session cookie is used exactly as captured by global-setup at suite start, with no live refresh. Every other authenticated test in this codebase uses a real `page` with a `page.goto("/")` warm-up, letting Clerk's client-side SDK refresh the session — this test's admin identity had no equivalent, so its captured cookie could go stale by the time it ran late in a long suite. Fixed by opening a real second browser context/page (`browser.newContext({ storageState: adminAuthFile })` + `page.goto("/")`) and using `adminPage.request.patch(...)` instead of a bare API context.
- Post-fix verification: `CI=true npx playwright test` (full suite) — run 1: 145/145 passed. Run 2: 144 passed, 1 flaky (`tests/admin-vendors.spec.ts`'s pre-existing "AC #3" test, a `Test timeout of 45000ms exceeded` that passed on Playwright's automatic retry) — a *different*, unrelated test than either of the two runs that failed before the fix, self-healed on retry, matching this project's already-documented pre-existing Clerk-session-TTL-under-full-suite-wall-clock-runtime flakiness class (Story 6.1's own investigation found the identical pattern: different unrelated tests failing on different runs, clean in isolation). This story's own new test (the one that was actually broken) passed clean on both post-fix runs — confirmed fixed, not just no-longer-reproducing.

### Completion Notes List

- All 5 ACs implemented and verified. AC #1 (create-time field): `CreateVendorSchema` gains `timezone` with `isValidTimeZone()` validation and `"America/New_York"` default; `AddVendorForm.tsx` gets a `<select>` sourced from `Intl.supportedValuesOf("timeZone")`. AC #2 (edit-time field): new `PATCH /api/admin/vendors/[id]` route + `UpdateVendorSchema`, same validation. AC #3 (admin UI): new `EditVendorTimezoneControl.tsx`, wired into `/admin/vendors`'s table as a new Timezone column — deliberately rendered for deactivated vendors too (not hidden), since there's no reason admin shouldn't be able to correct a timezone on a deactivated vendor. AC #4 (read-side machinery, no separate propagation): verified by real end-to-end test, not by inspection — see Debug Log. AC #5 (malformed rejection, reusing `isValidTimeZone()`): both schemas call the same existing `src/lib/timezone.ts` helper, not a re-derived check — confirmed by the ATDD red-phase tests pinning the exact error message/path.
- No task or AC required a settings-UI decision beyond what was already decided during story creation (admin-set field only) — nothing deferred on that front.
- Task 4 found no gap: Story 6.1's read-side machinery genuinely has no cache layer between it and `Vendor.timezone` (confirmed both by static inspection — `force-dynamic` on the relevant routes/pages — and by the real end-to-end test in Task 5).
- One genuine test-infrastructure bug found and fixed during this session, unrelated to any story AC: see Debug Log's root-cause note. Recorded here rather than silently folded into "implementation," since it's a real lesson (API-only Playwright contexts don't get Clerk's live session refresh that browser-page contexts do) that could recur in a future story reaching for the same `request.newContext()` shortcut for an authenticated-but-headless API call.
- Full regression clean: `npx tsc --noEmit`, `npm run lint`, 129/129 Vitest, `npm run build`, and 2 consecutive full Playwright suite runs post-fix (145/145, then 144/145 + 1 flaky-but-passed-on-retry unrelated pre-existing test).

### File List

- `src/app/api/admin/vendors/schema.ts` (modified — `timezone` field)
- `src/app/api/admin/vendors/schema.test.ts` (modified — 3 new cases)
- `src/app/api/admin/vendors/route.ts` (modified — passes `timezone` through)
- `src/app/api/admin/vendors/[id]/schema.ts` (new — `UpdateVendorSchema`)
- `src/app/api/admin/vendors/[id]/schema.test.ts` (new — 3 cases)
- `src/app/api/admin/vendors/[id]/route.ts` (new — `PATCH` handler)
- `src/components/admin/AddVendorForm.tsx` (modified — timezone `<select>`)
- `src/components/admin/EditVendorTimezoneControl.tsx` (new)
- `src/app/admin/vendors/page.tsx` (modified — new Timezone column)
- `docs/api-contracts.md` (modified — `POST /api/admin/vendors` request body updated, new `PATCH /api/admin/vendors/[id]` section)
- `docs/data-models.md` (modified — `Vendor.timezone` row updated)
- `tests/admin-vendors-edit-api.spec.ts` (new — API-level `PATCH` coverage)
- `tests/admin-vendors.spec.ts` (modified — 2 new UI-level cases)
- `tests/dashboard.spec.ts` (modified — new AC #4 end-to-end case)
- `_bmad-output/test-artifacts/atdd-checklist-7-1-admin-sets-a-vendors-real-timezone.md` (new, from the prior ATDD pass)

## Change Log

- 2026-08-28: Initial implementation — all 6 tasks, all 5 ACs. Includes one test-infrastructure fix (found and resolved during this same session, not a separate review round): the new AC #4 Playwright test's admin session needed a real browser page, not a bare `request.newContext()`, to avoid a stale-cookie 401 late in a full-suite run.
