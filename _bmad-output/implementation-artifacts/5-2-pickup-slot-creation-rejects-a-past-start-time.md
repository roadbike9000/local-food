---
baseline_commit: 4369bd7408188fc423e5f254a0ec53a7fc2399d7
---

# Story 5.2: Pickup slot creation rejects a start time already in the past

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the platform,
I want to reject a pickup slot whose start time has already elapsed,
so that customers are never offered a pickup window that's already over.

## Acceptance Criteria

1. Submitting a pickup slot (via `AddSlotForm.tsx` or a direct `POST /api/pickup-slots` call) with `startsAt` earlier than the current server time is rejected by `CreateSlotSchema` with a `400` — not silently created.
2. The existing `endsAt > startsAt` check (already enforced by `CreateSlotSchema`) is unaffected — both checks apply independently, and neither's failure message changes.

*(FR16. Comparison is against server time — `new Date()` evaluated inside the Zod refine, which runs in the route handler, not the client — so a wrong vendor-device clock can't bypass this (matches NFR2's "server-side is authoritative" discipline already applied to checkout in Story 5.1).)*

## Tasks / Subtasks

- [x] Task 1: Reject a past `startsAt` at the schema layer (AC #1, #2)
  - [x] `src/app/api/pickup-slots/schema.ts` — add a second `.refine()` to `CreateSlotSchema`: `new Date(d.startsAt) > new Date()`, message `"startsAt must not be in the past"`. Zod allows chaining multiple `.refine()` calls on the same schema (confirmed: `ZodEffects` exposes its own `.refine()`) — this is additive, it does **not** replace or restructure the existing `endsAt > startsAt` refine, which stays exactly as-is.
  - [x] Strict `>`, not `>=` — matches the existing `endsAt > startsAt` refine's own strict-inequality convention (a slot starting at literally the current instant is rejected, consistent with treating "now" as already past).
  - [x] No `route.ts` change needed for AC #1's "rejected with a `400`" — confirmed by reading `src/app/api/pickup-slots/route.ts` in full: `CreateSlotSchema.safeParse(...)` failing *for any reason* (including the existing `endsAt > startsAt` refine today) already returns the generic `400 { error: "Invalid request" }`. The new past-`startsAt` refine gets identical treatment automatically — this is the established precedent for this route, not a gap to close.

- [x] Task 2: Fix `schema.test.ts`'s hardcoded literal dates — **read this in full before starting, this is the task most likely to be under-scoped**
  - [x] `src/app/api/checkout/schema.test.ts` was a false lead — the file that actually needs fixing is `src/app/api/pickup-slots/schema.test.ts`. Its `validBody` hardcodes `startsAt: "2026-08-10T17:00:00.000Z"` / `endsAt: "2026-08-10T19:00:00.000Z"` — both now **in the past** relative to today. The moment Task 1 lands, the file's two "accepts..." tests (`"accepts a valid body and defaults capacity to 20"`, `"accepts an explicit capacity and location"`) start failing at the new past-`startsAt` refine, even though neither test is about that refine at all. This is the exact same hardcoded-past-literal decay class of bug Story 5.1 hit in `prisma/seed.ts`'s dev-DB drift (see `project-context.md`'s Actual State Log) — same root cause, different file.
  - [x] Fix: replace `validBody`'s hardcoded literals with dates computed relative to `Date.now()` (e.g. `startsAt` = now + 24h, `endsAt` = `startsAt` + 2h) — same pattern `tests/dashboard.spec.ts`'s two pickup-slot e2e tests already use (`new Date(Date.now() + 24 * 60 * 60 * 1000)`), confirmed by reading that file: those two e2e tests are **already relative-dated and need no change**, only this Vitest file has the hardcoded-literal problem.
  - [x] The file's other two tests that build their own literal dates inline (`"rejects endsAt before startsAt"`, `"rejects endsAt equal to startsAt"`) also use now-past literals — these still correctly return `success: false` either way (now failing for an *additional*, unintended reason alongside the one they're meant to test), so they won't break, but fix their literals to relative-future dates too while touching this file, so each test isolates exactly the one condition its name claims.

- [x] Task 3 (dev's discretion, not required by the AC): client-side pre-check in `AddSlotForm.tsx` mirroring its existing `endsAt <= startsAt` guard (same file, `handleSubmit`) for a friendlier inline message before the network round-trip. Not required — AC #1's "rejected... with a `400`" is fully satisfied by Task 1's schema-level fix alone, and every current e2e test already uses a relative-future `startsAt` so none would exercise this new client path either way. If added, match the existing guard's exact shape (`if (startsAt <= new Date()) { setError(...); setSubmitting(false); return; }`) and message style ("X must be Y.").

- [x] Task 4: Tests (AC #1, #2)
  - [x] New Vitest case in `src/app/api/pickup-slots/schema.test.ts`: `"rejects a startsAt already in the past"` — mirrors the file's existing `"rejects endsAt before startsAt"` test's shape, using a literal or relative past date for `startsAt` and a valid (relative-future) `endsAt`.
  - [x] Confirm (no new test needed, just verify while in the file) that an existing case still independently proves `endsAt > startsAt` is unaffected — after Task 2's fix, the existing `"rejects endsAt before startsAt"` test uses two relative-future dates with `endsAt` before `startsAt`, isolating exactly that condition per AC #2.
  - [x] New Playwright test, extend `tests/dashboard.spec.ts`'s `"vendor dashboard (authenticated)"` describe block (already serial-mode, already authenticated — matches this route's existing `GET /api/pickup-slots` direct-API-test pattern at line ~110): `[P1]` `POST /api/pickup-slots` with a past `startsAt` (and a valid `endsAt` after it) returns `400`, and no `PickupSlot` row is created for it (verify via `prisma.pickupSlot.findMany` scoped by vendor + a unique `location`, or absence of a new row — dev's call on the exact query, no existing helper does this lookup). Use `page.goto("/dashboard")` then `page.request.post(...)` — same auth-cookie-sharing pattern the existing `GET /api/pickup-slots` test in the same file already uses, confirmed by reading it.
  - [ ] Do not add a new e2e UI-level test for this — both of `tests/dashboard.spec.ts`'s existing `AddSlotForm` tests (`"vendor can add a new pickup slot"`, `"add-slot form shows a validation error when the end time is before the start time"`) already use `new Date(Date.now() + 24 * 60 * 60 * 1000)`-based times, confirmed unaffected by this change — re-run them after Task 1 lands to confirm, don't skip that check, but no new UI test is needed unless Task 3 is also done (in which case a UI test for that client-side path would be the dev's own addition, matching Task 3's own discretionary scope).

## Dev Notes

**Two different `CreateSlotSchema`/`schema.test.ts` pairs exist in this codebase — don't confuse them.** `src/app/api/checkout/schema.ts` (`CheckoutSchema`) is a different file for a different route (Story 5.1); this story only touches `src/app/api/pickup-slots/schema.ts` (`CreateSlotSchema`) and its co-located `schema.test.ts`.

**Server time, not client time, is what "already passed" means (NFR2).** The Zod `.refine()` runs inside the route handler (`POST /api/pickup-slots`) at parse time — `new Date()` there is server time regardless of what timezone or clock the vendor's browser reports. `AddSlotForm.tsx` already converts its `datetime-local` input via `new Date(startsAtLocal).toISOString()` before sending — an absolute UTC instant — so the server-side comparison is correct without needing to reason about the vendor's local timezone at all.

**No vendor-storefront timezone concept exists in this codebase, and this story does not add one.** `deferred-work.md` has an open, unresolved decision entry on exactly this question (referenced from `epics.md`'s Epic 5 as the reason a hypothetical Story 5.3 isn't written yet). This story's check is timezone-agnostic by construction (comparing two absolute instants), so it doesn't need that decision resolved — don't scope-creep into it.

**`PickupSlot.capacity`'s unenforced state (flagged in Story 5.1's review as deferred, `deferred-work.md`) is unrelated to this story** — this story is about rejecting a bad `startsAt`, not about slot capacity. Don't conflate the two.

### Project Structure Notes

- **Modified:** `src/app/api/pickup-slots/schema.ts`, `src/app/api/pickup-slots/schema.test.ts`, `tests/dashboard.spec.ts`. Optionally `src/components/dashboard/AddSlotForm.tsx` (Task 3, discretionary).
- No new files. No schema/migration changes — `PickupSlot.startsAt` is already a plain `DateTime`, no new column needed.
- Matches the existing single-file-per-route `schema.ts` + co-located `schema.test.ts` convention already used by every other API route in this codebase (`checkout`, `products`, `admin/vendors`).

### Testing Standards Summary

- Vitest for `CreateSlotSchema`'s pure validation logic (extend the existing `schema.test.ts`) — this is the primary AC #1/#2 coverage.
- Playwright for the direct-API-call path (extend `tests/dashboard.spec.ts`'s existing authenticated describe block) — covers AC #1's "or a direct API call" clause.
- No mocking — matches this codebase's established convention.
- **Regression risk to actively verify, not just assume:** after Task 1 lands, run the full existing `tests/dashboard.spec.ts` suite (not just the two pickup-slot tests) and the full `npx vitest run` — confirm nothing else in either file depended on the now-fixed hardcoded-past literals.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.2] — story definition and ACs.
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 5] — epic scope note: standalone, no Epic 1-3 dependency; timezone question explicitly deferred, not this story's job.
- [Source: src/app/api/pickup-slots/schema.ts, src/app/api/pickup-slots/route.ts] — current schema/route (read in full) — confirms the route already collapses every schema-refinement failure to a generic `400 { error: "Invalid request" }`, so no route change is needed for AC #1.
- [Source: src/app/api/pickup-slots/schema.test.ts] — current test file (read in full) — confirms the exact two tests (`"accepts a valid body..."`, `"accepts an explicit capacity and location"`) that break once Task 1 lands, and that the two "rejects endsAt..." tests use separately-hardcoded past literals of their own.
- [Source: src/components/dashboard/AddSlotForm.tsx] — current form (read in full) — confirms client already converts to an absolute ISO instant before sending, and already has an analogous client-side `endsAt <= startsAt` guard Task 3 would mirror if done.
- [Source: tests/dashboard.spec.ts] — confirms both existing `AddSlotForm` e2e tests already use relative-future (`Date.now() + 24h`) times, unaffected by this change; confirms the `page.goto("/dashboard")` + `page.request` authenticated-direct-API-call pattern already used for `GET /api/pickup-slots` at line ~110, to be mirrored for the new `POST` test.
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — open decision entry on vendor-storefront timezone (scenario review, 2026-08-24) — confirms this story's check is deliberately timezone-agnostic and doesn't need that decision resolved.
- [Source: _bmad-output/implementation-artifacts/5-1-customer-selects-a-pickup-slot-at-checkout.md] — previous story in this epic (read in full) — same `PickupSlot`/checkout surface; its own review surfaced the exact same hardcoded-future-literal-date-decay bug class (there: `prisma/seed.ts`'s dev-DB drift) that Task 2 here fixes in a different file. No other carryover — Story 5.1's `pickupSlotId`/checkout work is unrelated to this story's schema-only change.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- Task 3 (discretionary client-side pre-check) was chosen — added to `AddSlotForm.tsx`, mirroring the existing `endsAt <= startsAt` guard exactly (same shape, same placement, same message style).
- Doc drift found and fixed, not part of any listed task: `docs/api-contracts.md`'s `POST /api/pickup-slots` request-body comment documented only the `endsAt > startsAt` refine, silently stale the moment Task 1 landed. Fixed per `project-context.md`'s own doc-accuracy rule.
- `npx tsc --noEmit` — clean throughout.
- `npm run lint` — clean.
- `npx vitest run` — 92/92 passed (91 pre-existing + 1 new).
- Full `npx playwright test` (fresh re-seed, fresh dev server) — 129/129 passed, zero skips. The 3 tests that were serial-mode-aborted during ATDD's red-phase verification now run to completion normally, confirmed.
- Production build — clean.

### Completion Notes List

- `CreateSlotSchema` (`src/app/api/pickup-slots/schema.ts`) gained a second `.refine()` rejecting `startsAt <= new Date()` (server time) — additive, the existing `endsAt > startsAt` refine is untouched. No `route.ts` change needed — confirmed the route already collapses every schema-refinement failure to the same generic `400 { error: "Invalid request" }`.
- Fixed `src/app/api/pickup-slots/schema.test.ts`'s hardcoded-past-literal `validBody` (applied during the ATDD pass, verified still correct here) — now computed relative to `Date.now()`.
- Task 3 (discretionary) implemented: `AddSlotForm.tsx` now also rejects a past `startsAt` client-side before the network call, matching its existing `endsAt <= startsAt` guard's shape.
- `docs/api-contracts.md` updated (not a listed task, but stale as a direct result of this change — fixed per the project's doc-accuracy rule).
- No timezone concept added — this story's check is timezone-agnostic (two absolute instants compared server-side), per Dev Notes' explicit scope boundary.
- Full regression: typecheck clean, lint clean, 92/92 unit, 129/129 e2e (zero skips), production build succeeds.

### File List

- `src/app/api/pickup-slots/schema.ts` (modified — past-`startsAt` refine added)
- `src/app/api/pickup-slots/schema.test.ts` (modified — `validBody`/inline-date fixes and 1 new test, from the ATDD pass)
- `src/components/dashboard/AddSlotForm.tsx` (modified — client-side past-`startsAt` guard, Task 3)
- `tests/dashboard.spec.ts` (modified — 1 new test, from the ATDD pass)
- `docs/api-contracts.md` (modified — `POST /api/pickup-slots` request-body comment updated)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — status transitions)

## Change Log

- 2026-08-25: Implemented Story 5.2 in full. `CreateSlotSchema` now rejects a `startsAt` already in the past (server time), independent of the existing `endsAt > startsAt` check. Added the discretionary client-side pre-check to `AddSlotForm.tsx` for UX parity with its existing end-before-start guard. Fixed stale doc (`api-contracts.md`) and a hardcoded-past-literal test fixture (`schema.test.ts`, applied during the ATDD pass) that would otherwise have broken two unrelated tests. Full regression: typecheck clean, lint clean, 92/92 unit, 129/129 e2e (zero skips), production build succeeds. Status → review.
