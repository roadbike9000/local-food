---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-08-27'
storyId: '6.1'
storyKey: '6-1-pickup-slot-times-interpreted-in-vendors-own-timezone'
storyFile: '_bmad-output/implementation-artifacts/6-1-pickup-slot-times-interpreted-in-vendors-own-timezone.md'
atddChecklistPath: '_bmad-output/test-artifacts/atdd-checklist-6-1-pickup-slot-times-interpreted-in-vendors-own-timezone.md'
generatedTestFiles:
  - 'src/lib/timezone.ts'
  - 'src/lib/timezone.test.ts'
inputDocuments:
  - '_bmad-output/implementation-artifacts/6-1-pickup-slot-times-interpreted-in-vendors-own-timezone.md'
  - 'prisma/schema.prisma'
  - 'src/components/dashboard/AddSlotForm.tsx'
  - 'src/lib/utils.ts'
  - 'src/app/dashboard/pickups/page.tsx'
  - 'src/app/vendors/[slug]/page.tsx'
  - 'tests/helpers/db.ts'
  - 'package.json'
  - 'playwright.config.ts'
  - 'vitest.config.mts'
---

# ATDD Checklist: Story 6.1 — Pickup-slot times are interpreted in the vendor's own timezone

## Step 1: Preflight & Context

- **Detected stack:** fullstack (Next.js App Router frontend + API routes; Playwright and Vitest both configured) — same detection as every prior story in this project.
- **Framework:** Vitest for the new `src/lib/timezone.ts` conversion module's pure logic — this story's actual acceptance bar per its own Dev Notes ("this story's real complexity is entirely in Task 2's conversion math"). Playwright for the DB-dependent scenarios, deferred — see scoping decision below.
- **Prerequisites met:** story has 5 clear ACs, `ready-for-dev`; `playwright.config.ts`/`vitest.config.mts` configured; dev environment available.
- **Playwright Utils:** `tea_use_playwright_utils: true` in config, no `playwright-utils` package present in `package.json`/`node_modules` (confirmed by inspection) — plain `@playwright/test` patterns, same gap noted in every prior story's ATDD pass.
- **Real prior art found and reused, not rebuilt:** none directly reusable — this is the first timezone-conversion code in this codebase (confirmed: no `date-fns`/`luxon`/`dayjs`/`date-fns-tz` in `package.json`, no existing `Intl.DateTimeFormat`-with-`timeZone` usage anywhere in `src/`). `AddSlotForm.tsx`'s existing `toDatetimeLocalValue()` is the closest precedent (same `datetime-local` value-string shape) but hardcodes the browser's own zone via `Date` getters, not `Intl` — not directly reusable, only shape-compatible.
- **Deliberate scoping decision, not an omission:** this ATDD pass generates real, executed red-phase tests for `src/lib/timezone.ts` (Task 2) only — the module the story's own Dev Notes names as the actual acceptance bar, and the one piece genuinely testable in complete isolation (pure functions, no DB dependency). Tasks 1/3/4/5's DB-dependent scenarios (the `Vendor.timezone` migration, `AddSlotForm.tsx`/`formatPickupWindow()` threading, and the e2e vendor-fixture tests that depend on both) are **not** scaffolded here — writing them requires the schema migration to exist first, which is implementation work belonging to `dev-story`, not ATDD's job of test scaffolding. Forcing the migration through ATDD to make those tests expressible would blur that boundary for no real benefit, since the migration itself is trivial (one column, one default, no per-row derivation) and low-risk compared to the conversion math. This mirrors Story 5.2's ATDD precedent of explicitly excluding out-of-scope work (there: `AddSlotForm.tsx`'s discretionary Task 3) rather than force-fitting it.
- **What `dev-story` still needs to scaffold itself, per the story file's own Task 5:** the `formatPickupWindow()` signature-change tests, the `createTestVendor()` `timezone` override, and the end-to-end "two different vendor timezones produce differently-offset stored instants" Playwright test — all named explicitly in the story's Tasks/Subtasks, none silently dropped.
- **Execution mode:** sequential, no subagent dispatch.

## Step 2: Generation Mode

**Mode: AI Generation.** ACs are clear; the scenario (wall-clock-to-UTC conversion for an arbitrary IANA zone) is a well-understood but easy-to-get-subtly-wrong algorithm, not an exploratory one. No recording — `tea_browser_automation` resolves to `none` in this environment, same as every prior story.

## Step 3: Test Strategy

AC to scenario mapping (this pass's scope only — see Step 1's scoping decision for what's deferred):

| AC | Scenario | Test Level | Priority |
| --- | --- | --- | --- |
| 2, 5 | Wall-clock string + IANA zone → correct UTC instant, zone behind UTC, no DST | Unit (Vitest) | P0 |
| 2, 5 | Wall-clock string + IANA zone → correct UTC instant, zone ahead of UTC, no DST (`Asia/Tokyo`) | Unit (Vitest) | P0 |
| 2, 5 | Same zone (`America/New_York`), winter (EST) vs. summer (EDT) offsets both resolve correctly | Unit (Vitest) | P0 |
| 2, 5 | **DST spring-forward boundary** (2026-03-08, `America/New_York`) — day-of and day-before both resolve to the correct, different offsets | Unit (Vitest) | P0 |
| 2, 5 | **DST fall-back boundary** (2026-11-01, `America/New_York`) — day-of and day-before both resolve to the correct, different offsets | Unit (Vitest) | P0 |
| 2, 5 | `UTC` itself as a zero-offset zone | Unit (Vitest) | P1 |
| 5 | Inverse direction (UTC instant → zoned wall-clock string), zone behind and ahead of UTC | Unit (Vitest) | P0 |
| 2, 5 | Round-trip: `zonedWallTimeToUtc` → `utcInstantToZonedDatetimeLocal` agree with each other across a DST boundary, not just against independently hand-computed strings | Unit (Vitest) | P1 |

**Not automated at this level (deferred to `dev-story`, per Step 1's scoping decision):**
- AC #1 (migration backfill correctness) — needs the real migration to exist; verify via `npx prisma studio`/direct query per the story's own Task 1, not a Vitest scaffold.
- AC #2/#3's "existing checks continue to work unmodified" claim — needs `dev-story` to actually run the existing `pickup-slots/schema.test.ts` and `checkout-api.spec.ts` suites after Task 3 lands and confirm no regression; nothing to scaffold ahead of that, since the claim is "no change needed," not new behavior.
- AC #4 (display in vendor's timezone) and the `formatPickupWindow()` signature change — needs Task 4's real call-site updates to exist before a test can assert against them without breaking `tsc --noEmit` prematurely (a required parameter is enforced by the type system itself once added — that check doesn't need a redundant Vitest scaffold ahead of the real change).
- The end-to-end "two vendor timezones, one wall-clock input, two correctly-different stored instants" Playwright test — named explicitly in the story's own Task 5, requires `createTestVendor()`'s `timezone` override (Task 6) and the real DB column (Task 1) to exist.

**Red phase independently executed, not just reasoned about:**
- `npx vitest run src/lib/timezone.test.ts`: 11 failed, 0 passed — every test fails with `Error: not implemented`, thrown from the real (stubbed) production functions in `src/lib/timezone.ts`, not a test-authoring mistake or an import error.
- `npx vitest run` (full suite): 96 passed, 11 failed — the 11 new failures only, zero pre-existing tests affected.
- `npx tsc --noEmit`: clean.
- `npm run lint`: clean.

## Step 4: Red-Phase Test Generation

TDD Red Phase Validation: **PASS** — both new files applied to the real repo and independently executed; true red confirmed for all 11 new cases (thrown `not implemented`, not a false-negative like an import/type error), zero other tests broken.

- **Production stub, applied now (`src/lib/timezone.ts`):** real, correctly-typed function signatures for both conversion directions, each throwing `not implemented` — intentionally unimplemented so `dev-story` writes the actual algorithm against a real failing test, not a passing placeholder.

```ts
export function zonedWallTimeToUtc(wallTime: string, timeZone: string): Date {
  throw new Error("not implemented");
}

export function utcInstantToZonedDatetimeLocal(date: Date, timeZone: string): string {
  throw new Error("not implemented");
}
```

- **Unit tests, applied now (`src/lib/timezone.test.ts`):** 11 cases across both functions. Expected UTC values were independently cross-checked against Python's `zoneinfo` (the IANA tz database) during this ATDD pass, not just hand-computed — every expected value matched exactly on the first check, so no test assertions needed correction.
  - Non-DST zone-behind-UTC and zone-ahead-of-UTC cases (`America/New_York` winter, `Asia/Tokyo`).
  - Same zone, two different offsets across a season (`America/New_York` winter vs. summer) — proves the function resolves the offset for the *given date*, not a cached/hardcoded one.
  - **DST spring-forward** (2026-03-08) and **fall-back** (2026-11-01) boundaries, each with a day-before/day-of pair — the class of bug that looks correct on any "normal" date and only breaks on the ~2 days a year that matter.
  - `UTC` as an explicit zero-offset case.
  - Inverse-direction formatting tests, plus one round-trip test tying both functions together across the spring-forward boundary.

Acceptance criteria coverage (this pass's scope):
- AC2 (wall-clock interpreted in vendor's zone, not the browser's): the core conversion logic is now under real, executed red-phase test — covered pending `dev-story`'s implementation and Task 3's threading.
- AC5 (native `min` attribute reflects vendor-timezone "now"): the inverse-direction function this depends on is under the same coverage.
- AC1, AC3, AC4: intentionally not scaffolded this pass — see Step 3's deferral list; each has a concrete plan, not a silent gap.

## Next Steps (Task-by-Task Activation)

1. Task 2 (implement `zonedWallTimeToUtc`/`utcInstantToZonedDatetimeLocal` for real, replacing the `throw` stubs) lands → re-run `npx vitest run src/lib/timezone.test.ts` directly; all 11 should flip to green with no test-file changes needed. If a DST case doesn't flip green on a plausible-looking implementation, that is the exact signal this story's Dev Notes warns about — don't adjust the test's expected value to match a wrong implementation.
2. Task 1 (migration) → apply, then extend `tests/helpers/db.ts`'s `createTestVendor()` with the `timezone` override (Task 6) before attempting the deferred e2e test.
3. Task 3 (thread into `AddSlotForm.tsx`) → write and run the deferred two-vendor-timezones Playwright test (Step 3's "not automated at this level" list) — this is the one test that actually proves AC #2 end-to-end, not just at the unit level.
4. Task 4 (`formatPickupWindow()` signature change) → grep for every call site before considering it done (the story's own Dev Notes flags this explicitly); add the deferred Vitest coverage for the new parameter.
5. Re-run the full existing `pickup-slots/schema.test.ts` and `checkout-api.spec.ts` suites after Task 3 lands to independently confirm AC #3's "unaffected, no code change needed" claim, rather than assuming it holds.

## Implementation Guidance

New: `src/lib/timezone.ts`, `src/lib/timezone.test.ts` (both already created and applied by this ATDD pass — implement the two functions for real, do not recreate the files). Modified (still to come, per the story's own Tasks/Subtasks — not touched by this ATDD pass): `prisma/schema.prisma`, `src/components/dashboard/AddSlotForm.tsx`, `src/lib/utils.ts`, `src/app/dashboard/pickups/page.tsx`, `src/app/vendors/[slug]/page.tsx`, `tests/helpers/db.ts`, `tests/dashboard.spec.ts`, `docs/data-models.md`, `docs/api-contracts.md`. Full contracts are in the story's own Tasks/Subtasks — see `_bmad-output/implementation-artifacts/6-1-pickup-slot-times-interpreted-in-vendors-own-timezone.md`.

## Step 5: Validation & Completion

Validation checklist:
- [x] Prerequisites satisfied
- [x] Test files created and applied to the real repo (not draft-only); `tsc --noEmit` and lint clean
- [x] Checklist matches acceptance criteria in scope (AC2, AC5 covered by this pass; AC1/AC3/AC4 explicitly deferred with a concrete plan, not silently dropped)
- [x] Tests generated and independently executed — true red confirmed for all 11 new cases, zero other tests broken
- [x] Story metadata and handoff paths captured
- [x] No CLI/MCP browser sessions opened (`tea_browser_automation` resolved to `none`); no dev server or DB writes needed this pass — pure Vitest, no side effects to clean up
- [x] Temp artifacts: none. Durable artifacts: this checklist plus `src/lib/timezone.ts` (stub) and `src/lib/timezone.test.ts` (11 red tests)

**Completion summary:**
- Applied and verified: 2 new files (1 production stub, 1 test file), 11 red-phase Vitest cases, all independently executed and confirmed failing for the right reason
- Deliberately deferred to `dev-story`: all DB-dependent scenarios (Tasks 1, 3, 4, 5's remaining coverage) — each named explicitly, none silently dropped
- Checklist: this file
- Story: `_bmad-output/implementation-artifacts/6-1-pickup-slot-times-interpreted-in-vendors-own-timezone.md`
- Next recommended workflow: `dev-story`
