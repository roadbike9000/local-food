---
baseline_commit: d0fae663f691ffc4f60397d4d30c59166f1f5749
---

# Story 6.1: Pickup-slot times are interpreted in the vendor's own timezone

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a vendor,
I want the pickup times I enter to be understood as *my* local time, not the browser's,
so that a slot I create is never silently off by however many hours separate my timezone from whoever's device submitted the form.

## Acceptance Criteria

1. `Vendor` gains a `timezone` column (IANA timezone identifier, e.g. `"America/New_York"`, non-nullable with a schema default) — every existing vendor row gets that default value via the migration itself (a plain `@default(...)` on a new NOT NULL column backfills automatically; this is not the two-step nullable-then-backfill shape Story 1.2's `stockQuantity` needed, since every vendor gets the identical default value, not one derived per-row). No admin/vendor-facing UI to *change* it is required by this story — just the column existing and being used.
2. When a vendor submits `AddSlotForm.tsx`'s `startsAt`/`endsAt` `datetime-local` inputs, the entered wall-clock digits are interpreted as being in that vendor's `timezone`, not the submitting browser's local timezone, before being converted to the absolute UTC instant sent to `POST /api/pickup-slots` and stored in `PickupSlot.startsAt`/`endsAt`. This is the story's core deliverable: closes the exact gap the original scenario review named — someone in a different timezone than the vendor's actual business location can no longer silently create a slot that's off by the offset between the two.
3. `POST /api/pickup-slots`'s wire format is unchanged — it still receives and validates an absolute ISO UTC instant (`CreateSlotSchema`'s existing `z.string().datetime({ offset: true })` fields), and its existing refines (`endsAt > startsAt`, `startsAt` not in the past — Story 5.2) are unaffected and need no code change, since both already compare absolute instants and are timezone-agnostic by construction. Confirm this holds with a real test rather than assuming; note explicitly in Completion Notes if a gap is found instead.
4. The storefront's "Next pickup" banner (`vendors/[slug]/page.tsx`) and the vendor dashboard's own pickup-slots listing (`dashboard/pickups/page.tsx`) both display pickup times in the vendor's configured `timezone` — not the viewing browser's local timezone (the current, unstated default) — since pickup happens at the vendor's physical location regardless of which timezone the viewer is browsing from.
5. `AddSlotForm.tsx`'s `startsAt` input's native `min` attribute (added in Story 5.2) continues to reflect "now" correctly — computed in the vendor's configured timezone, not the browser's, so the native picker's own lower bound agrees with what the server will actually accept.

*(FR17.)*

## Tasks / Subtasks

- [ ] Task 1: `Vendor.timezone` schema migration (AC #1)
  - [ ] `prisma/schema.prisma` — add `timezone String @default("America/New_York")` to the `Vendor` model. Pick the default deliberately (this codebase's existing vendors/seed data give no explicit signal either way — `America/New_York` is a reasonable single-market assumption for a first cut, but this is a real judgment call, not a mechanical one) and say what you picked and why in Completion Notes.
  - [ ] Run `npm run prisma:migrate` — confirm via `npx prisma studio` or a direct query that every existing `Vendor` row picked up the default value, not `NULL`. No hand-written backfill script needed — this is the simple case (identical default for every row), unlike Story 1.2's `stockQuantity`/`lowStockThreshold` migration, which needed per-row derivation from `isAvailable` and is not a pattern to copy here.
  - [ ] `docs/data-models.md` — add the new `timezone` row to the `Vendor` table (matches every other schema field's documentation precedent in that file).

- [ ] Task 2: New `src/lib/timezone.ts` module — wall-clock ⇄ UTC conversion for an arbitrary IANA zone (AC #2, #5)
  - [ ] **This is the highest-risk part of this story — read this task in full before starting, and do not hand-roll a simpler-looking version.** No date library (`date-fns`/`luxon`/`dayjs`/`date-fns-tz`) exists in this codebase's `package.json` today (confirmed by grep during story creation) — adding one is a legitimate option (`date-fns-tz` is the natural minimal fit if picked), but the codebase's existing pattern for every other date need (`formatPickupWindow`, `toDatetimeLocalValue`) is hand-rolled `Intl`-based code with no dependency. If implementing by hand, this reference algorithm is the standard technique for wall-clock→UTC-in-arbitrary-zone conversion using only native `Intl` (verify it, don't assume it's correct as pasted):
    ```ts
    // Converts a "YYYY-MM-DDTHH:mm" wall-clock string (no offset info, as
    // produced by a datetime-local input's .value) interpreted as being in
    // `timeZone` into the UTC instant it actually represents.
    export function zonedWallTimeToUtc(wallTime: string, timeZone: string): Date {
      const naiveUtc = new Date(`${wallTime}:00Z`); // treat the digits as if UTC
      const dtf = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hour12: false,
      });
      const parts = Object.fromEntries(dtf.formatToParts(naiveUtc).map((p) => [p.type, p.value]));
      // What naiveUtc actually displays as, in the target zone:
      const asDisplayedInZone = Date.UTC(
        Number(parts.year), Number(parts.month) - 1, Number(parts.day),
        Number(parts.hour) % 24, Number(parts.minute), Number(parts.second),
      );
      const offsetMs = asDisplayedInZone - naiveUtc.getTime();
      return new Date(naiveUtc.getTime() - offsetMs);
    }
    ```
  - [ ] Also add the inverse-ish direction for AC #5 / display use: a function that formats a UTC `Date` as a `"YYYY-MM-DDTHH:mm"` wall-clock string *in a given timezone* (simpler than the above — no offset math needed, `Intl.DateTimeFormat(...).formatToParts()` already returns the target zone's wall-clock components directly for a given instant). `AddSlotForm.tsx`'s existing `toDatetimeLocalValue()` does this today but hardcodes the browser's own zone (via `d.getFullYear()` etc., not `Intl`) — either generalize it to accept a `timeZone` param and move it into `src/lib/timezone.ts`, or add a sibling function; dev's call which, but don't leave two divergent implementations of the same formatting logic.
  - [ ] **Mandatory Vitest coverage, not optional:** at minimum — (a) a non-DST-boundary date in a zone behind UTC (e.g. `America/New_York`) round-trips correctly; (b) a zone ahead of UTC round-trips correctly; (c) **at least one real DST-transition-boundary case** (e.g. a wall-clock time on the day of `America/New_York`'s spring-forward or fall-back transition) — this is exactly the class of bug that looks correct on every "normal" date and silently breaks twice a year; skipping this case is not acceptable coverage for this module. Use a fixed real date for the DST case (look up the actual 2026 US DST transition dates), not a relative one, since the whole point is pinning behavior at a known boundary.

- [ ] Task 3: Thread `Vendor.timezone` through slot creation (AC #2, #5)
  - [ ] `src/app/dashboard/pickups/page.tsx` already fetches `vendor` (a Server Component, `getCurrentVendor()`) — pass `timezone={vendor.timezone}` as a new prop to `<AddSlotForm />` (currently rendered with no props).
  - [ ] `AddSlotForm.tsx` — accept the new `timezone: string` prop. Replace `new Date(startsAtLocal)` / `new Date(endsAtLocal)` (currently interpreted in the *browser's* local zone) with `zonedWallTimeToUtc(startsAtLocal, timezone)` / `zonedWallTimeToUtc(endsAtLocal, timezone)` from the new module. The rest of `handleSubmit` (validation, `.toISOString()`, the POST body shape) is unchanged — this only changes *how* the `Date` objects are constructed from the raw input strings, matching AC #3's "wire format unchanged" requirement.
  - [ ] `AddSlotForm.tsx`'s `min={toDatetimeLocalValue(new Date())}` (Story 5.2) — replace with the vendor-timezone-aware equivalent from Task 2, so the native picker's lower bound is computed in the vendor's configured zone, not the browser's (AC #5).
  - [ ] **Known, accepted UX limitation, not a gap to close in this story:** the `datetime-local` input widget itself is always rendered and labeled by the browser in the browser's own local timezone — there's no way to make the widget's own chrome say "this is Eastern time" if the vendor's browser is set to Pacific. This story treats the digits the vendor types as vendor-timezone digits regardless of what the widget's surrounding UI implies, per Jeff's explicit 2026-08-26 decision (`deferred-work.md`). A visible "you're entering times in {vendor.timezone}" hint next to the form would be a reasonable follow-up UX improvement, but is not required by any AC here — don't scope-creep into it.

- [ ] Task 4: Display pickup times in the vendor's own timezone (AC #4)
  - [ ] `src/lib/utils.ts`'s `formatPickupWindow(startsAt: Date, endsAt: Date)` — add a required third parameter, `timeZone: string`, and pass `{ timeZone, ... }` into both `toLocaleDateString`/`toLocaleTimeString` calls' options objects (native `Intl`/`Intl`-backed `Date` methods already support a `timeZone` option — no new dependency needed for this half, this is the simple direction of the conversion problem, unlike Task 2's).
  - [ ] Update both existing call sites to pass it: `src/app/vendors/[slug]/page.tsx` (already has `vendor.timezone` in scope from its Prisma query) and `src/app/dashboard/pickups/page.tsx` (same). This is a signature-breaking change to a shared utility — grep for every call site before considering this task done, don't rely on TypeScript alone to catch a missed one if a call site was ever wrapped in a way that erases the type error.

- [ ] Task 5: Tests (AC #1-#5)
  - [ ] Task 2's own Vitest coverage (see above) is the primary correctness proof for the conversion logic itself — don't substitute e2e coverage for it.
  - [ ] New Vitest cases for `formatPickupWindow()` (`src/lib/utils.test.ts` if it exists, or co-located per this codebase's `schema.test.ts` convention — check which pattern this file already follows) — same instant, two different `timeZone` values, confirms the displayed string actually differs (proves the parameter is wired through, not silently ignored).
  - [ ] Extend `tests/dashboard.spec.ts`'s existing `AddSlotForm` e2e tests (`"vendor can add a new pickup slot"`) — the seeded/test vendor's `timezone` will be whatever `Task 1`'s default resolves to; if the test environment's own machine timezone differs from that default, this is exactly the scenario this story exists to get right, so these existing tests are a real regression check, not just a formality. Re-run them after Task 3 lands and confirm they still pass for the right reason (the created slot's stored UTC instant matches the vendor-zone-interpreted input), not by accident.
  - [ ] New Playwright test (`tests/dashboard.spec.ts`, extending the authenticated describe block): create a vendor fixture with an explicit non-default `timezone` override (Task 6's `createTestVendor()` extension), submit a known wall-clock time via `AddSlotForm`, and assert the resulting `PickupSlot.startsAt` in the DB is the UTC instant that wall-clock time actually represents in *that* zone — not the test runner's own machine timezone. This is the one test that actually proves AC #2 end-to-end; the existing tests alone (single implicit timezone throughout) can't catch a regression here.
  - [ ] New Playwright or component-level assertion that the storefront "Next pickup" banner and the dashboard's slot listing both render using `vendor.timezone`, not the browser's — reuse the same non-default-timezone vendor fixture.

- [ ] Task 6: Test helpers and docs sync (housekeeping, matches established precedent)
  - [ ] `tests/helpers/db.ts`'s `createTestVendor()` — add a `timezone` override to its `overrides` type (mirrors the existing `deletedAt`/`deletedByAdminId` override pattern), defaulting to the schema default if omitted, needed by Task 5's dedicated timezone test.
  - [ ] `docs/data-models.md` — the new `Vendor.timezone` row (Task 1) and, if `formatPickupWindow()`'s signature is documented anywhere outside its own doc comment, update that too.
  - [ ] `docs/api-contracts.md` — `POST /api/pickup-slots`'s documented request body is unchanged (AC #3), but consider whether its "ISO 8601 datetime" comment should note that the *value itself* is now computed relative to the vendor's configured timezone rather than the submitting browser's, so a future reader of the API contract alone (not the UI code) understands what "the instant" actually represents.

## Dev Notes

**This story's real complexity is entirely in Task 2's conversion math, not in the plumbing around it.** Every other task is straightforward parameter-threading. Getting `zonedWallTimeToUtc()` wrong (especially around a DST transition) is the one way this story can look done, pass a casual test pass, and still silently corrupt data for two days a year. Treat Task 2's Vitest coverage as this story's actual acceptance bar, not a formality alongside the "real" work.

**Why the wire format stays unchanged (AC #3) instead of moving zone-awareness server-side.** An alternative design would send the raw wall-clock string to the server and have `POST /api/pickup-slots` do the zone conversion (using `getCurrentVendor()`'s already-available `vendor.timezone`) instead of the client. That would match this codebase's general NFR2 "server-side is authoritative" preference more literally — but it would require moving the `endsAt > startsAt` / past-`startsAt` refines out of `CreateSlotSchema` (a pure function on strings today) and into the route, after the zone conversion happens, since a bare wall-clock string can't be compared for "is this in the past" without first knowing which zone it's in. That's a bigger, riskier restructuring of code Story 5.2 already hardened through review, for no behavioral difference the vendor would ever observe (the conversion result is byte-identical either way, since `vendor.timezone` doesn't change between the client fetching it and the client submitting the form — no trust boundary is actually being crossed by doing the math client-side here, unlike e.g. price or stock checks, which genuinely can be manipulated by a malicious client). Keep the conversion client-side, keep `CreateSlotSchema` exactly as Story 5.2 left it.

**`PickupSlot.capacity`'s enforcement (Story 5.1's deferred finding, resolved 2026-08-27 in `POST /api/checkout`) is unrelated to this story** — this story is about which timezone a slot's wall-clock input is interpreted in, not slot capacity. Don't conflate the two.

**No vendor-facing settings UI to change `Vendor.timezone` exists after this story ships**, per AC #1's explicit scope boundary — every vendor gets the Task 1 default and there is currently no way for a vendor or admin to change it through the app. If `POST /api/admin/vendors` (`CreateVendorSchema`) should optionally accept a `timezone` at vendor-creation time instead of always taking the schema default, that's a reasonable, low-risk addition (`Intl.supportedValuesOf("timeZone")` — a real runtime API — can validate an incoming IANA identifier without a new dependency, if this is picked up) but it is **discretionary**, not required by any AC here, matching Story 5.2's Task 3 precedent for optional scope. If skipped, say so in Completion Notes rather than silently omitting it.

**`formatPickupWindow()`'s new required `timeZone` parameter is a breaking signature change.** Grep for every call site (`src/app/vendors/[slug]/page.tsx`, `src/app/dashboard/pickups/page.tsx` are the two known today) before considering Task 4 done — don't assume those are the only two without checking, since a missed call site fails silently (wrong displayed time, not a compile error, if a default parameter value were added instead of a required one — don't add a default for this reason; a missing argument should be a type error, not a silent fallback to some incorrect implicit zone).

### Project Structure Notes

- **New:** `src/lib/timezone.ts` (Task 2's conversion functions).
- **Modified:** `prisma/schema.prisma` (`Vendor.timezone`), `src/lib/utils.ts` (`formatPickupWindow()` signature), `src/components/dashboard/AddSlotForm.tsx` (new `timezone` prop, conversion call sites), `src/app/dashboard/pickups/page.tsx` (pass `vendor.timezone` to both `AddSlotForm` and `formatPickupWindow`), `src/app/vendors/[slug]/page.tsx` (pass `vendor.timezone` to `formatPickupWindow`), `tests/helpers/db.ts` (`createTestVendor()` gains a `timezone` override), `tests/dashboard.spec.ts`, `docs/data-models.md`, `docs/api-contracts.md`.
- No changes needed to `src/app/api/pickup-slots/schema.ts`, `src/app/api/pickup-slots/route.ts`, `src/app/api/checkout/route.ts`, or `src/app/api/vendors/[vendorId]/pickup-slots/route.ts` — all four already operate on absolute instants and are timezone-agnostic by construction (AC #3). Confirm, don't assume.

### Testing Standards Summary

- Vitest for `src/lib/timezone.ts`'s pure conversion functions (Task 2) — this is the primary correctness proof for this story, including a real DST-boundary case.
- Vitest for `formatPickupWindow()`'s new `timeZone` parameter (Task 5).
- Playwright for the end-to-end vendor-creates-a-slot-in-their-own-zone path (Task 5) — the one test that actually exercises AC #2 against a non-default vendor timezone, not just the default the whole existing test suite happens to already use everywhere.
- No mocking — matches this codebase's established convention. `Intl`/`Date` timezone behavior is real runtime behavior, not something to stub.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.1] — story definition and ACs, and Epic 6's scope note.
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — "scenario review with Jeff" entry (2026-08-24) and its 2026-08-26 decision note — the original scenario and Jeff's decision to add `Vendor.timezone` this story implements.
- [Source: _bmad-output/implementation-artifacts/5-2-pickup-slot-creation-rejects-a-past-start-time.md] — previous story touching this exact surface (read in full) — confirms `CreateSlotSchema`'s existing refines already compare absolute instants and are timezone-agnostic (Dev Notes: "this story's check is timezone-agnostic by construction"), the basis for this story's AC #3 and its decision to keep zone conversion client-side rather than restructure the schema.
- [Source: src/components/dashboard/AddSlotForm.tsx] — current form (read in full) — confirms today's `new Date(startsAtLocal)` browser-local interpretation and the existing `toDatetimeLocalValue()`/`min` attribute pattern this story extends.
- [Source: src/lib/utils.ts] — `formatPickupWindow()` (read in full) — confirms it takes no timezone parameter today and relies on the runtime's implicit default zone.
- [Source: src/app/dashboard/pickups/page.tsx, src/app/vendors/[slug]/page.tsx] — both call sites (read in full) — both already fetch a full `vendor` object via Prisma, confirming `vendor.timezone` will be available with zero new queries once Task 1 lands.
- [Source: src/app/api/pickup-slots/schema.ts, src/app/api/pickup-slots/route.ts, src/app/api/checkout/route.ts] — current schema/routes (read in full) — confirm all absolute-instant comparisons, supporting AC #3's "no code change needed here" claim.
- [Source: prisma/schema.prisma] — `Vendor` model (read in full) — confirms no existing timezone-adjacent field, and the exact shape (unique `slug`, nullable `clerkUserId`, etc.) `timezone` needs to fit alongside.
- [Source: tests/helpers/db.ts] — `createTestVendor()` (read in full) — confirms its existing `overrides` pattern to extend for Task 6.
- [Source: package.json] — confirms no date library (`date-fns`/`luxon`/`dayjs`/`date-fns-tz`) exists in this codebase today, the basis for Task 2's "flag this as an explicit choice" framing.
